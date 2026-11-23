import "server-only";

import { tokenGraph } from "@/lib/vistagem/sharepoint";
import { lerConfig, modoOutlook } from "./config-server";
import { eventoDoConvite, respostaDoGraph, versaoDoEvento } from "./outlook";
import { carregarAudiencias, carregarPessoas, db } from "./server";
import type { Audiencia, Papel, PessoaPauta } from "./tipos";

/**
 * Convites do Outlook (Microsoft Graph, permissão de aplicação Calendars.ReadWrite na caixa organizadora).
 * Um convite por papel em cada audiência dos próximos 45 dias. Em modo teste (padrão), grava o convite que
 * mandaria e não chama o Graph.
 */

const JANELA_DIAS = 45;
const GRAPH = "https://graph.microsoft.com/v1.0";

interface LinhaConvite {
  id: string;
  audiencia_id: string;
  papel: Papel;
  pessoa_id: string | null;
  graph_event_id: string | null;
  versao: string | null;
  status: string;
}

async function graph(token: string, caminho: string, init: RequestInit = {}): Promise<Record<string, unknown> | null> {
  const resposta = await fetch(`${GRAPH}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (resposta.status === 204 || resposta.status === 202) return null;
  const corpo = (await resposta.json().catch(() => null)) as Record<string, unknown> | null;
  if (!resposta.ok) throw new Error(`Graph ${resposta.status}: ${String((corpo?.error as { message?: string } | undefined)?.message ?? "").slice(0, 200)}`);
  return corpo;
}

export interface ResumoConvites {
  modo: "real" | "simulado";
  criados: number;
  atualizados: number;
  cancelados: number;
  erros: number;
}

export async function sincronizarConvites(): Promise<ResumoConvites> {
  const config = await lerConfig();
  const real = modoOutlook() === "real" && config.outlook.ligado;
  const organizador = config.outlook.organizador || process.env.MICROSOFT_MAIL_SENDER?.trim() || "";
  const resumo: ResumoConvites = { modo: real ? "real" : "simulado", criados: 0, atualizados: 0, cancelados: 0, erros: 0 };
  if (real && !organizador) throw new Error("Defina a caixa organizadora dos convites (configuração ou MICROSOFT_MAIL_SENDER).");

  const agora = new Date();
  const ate = new Date(agora.getTime() + JANELA_DIAS * 24 * 60 * 60 * 1000);
  const auds = await carregarAudiencias(agora.toISOString(), ate.toISOString());
  const pessoas = new Map((await carregarPessoas()).map((p) => [p.id, p]));
  const { data } = await db()
    .from("aud_convites")
    .select("id, audiencia_id, papel, pessoa_id, graph_event_id, versao, status")
    .in("audiencia_id", auds.map((a) => a.id).slice(0, 1000));
  const existentes = new Map(((data ?? []) as LinhaConvite[]).map((c) => [`${c.audiencia_id}:${c.papel}`, c]));
  const token = real ? await tokenGraph() : "";
  const urlPauta = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/operacoes-legais/pauta` : undefined;

  for (const aud of auds) {
    for (const papel of ["titular", "backup"] as const) {
      const pessoaId = papel === "titular" ? aud.titularId : aud.backupId;
      const pessoa = pessoaId ? pessoas.get(pessoaId) ?? null : null;
      const atual = existentes.get(`${aud.id}:${papel}`) ?? null;
      try {
        const r = await sincronizarUm(aud, papel, pessoa, atual, pessoas, { real, token, organizador, urlPauta, duracoes: config.duracoes });
        if (r) resumo[r] += 1;
      } catch (erro) {
        resumo.erros += 1;
        await db()
          .from("aud_convites")
          .upsert({ audiencia_id: aud.id, papel, pessoa_id: pessoa?.id ?? null, status: "erro", erro: erro instanceof Error ? erro.message : String(erro) }, { onConflict: "audiencia_id,papel" });
      }
    }
  }
  return resumo;
}

async function sincronizarUm(
  aud: Audiencia,
  papel: Papel,
  pessoa: PessoaPauta | null,
  atual: LinhaConvite | null,
  pessoas: Map<string, PessoaPauta>,
  ctx: { real: boolean; token: string; organizador: string; urlPauta?: string; duracoes: Partial<Record<Audiencia["tipo"], number>> }
): Promise<"criados" | "atualizados" | "cancelados" | null> {
  const base = `/users/${encodeURIComponent(ctx.organizador)}/events`;
  const deveExistir = aud.situacao === "designada" && Boolean(pessoa?.email) && Boolean(pessoa?.ativo);
  const trocouPessoa = atual && atual.pessoa_id !== (pessoa?.id ?? null);

  if (atual && atual.status !== "cancelado" && (!deveExistir || trocouPessoa)) {
    if (ctx.real && atual.graph_event_id) {
      await graph(ctx.token, `${base}/${atual.graph_event_id}/cancel`, { method: "POST", body: JSON.stringify({ comment: aud.situacao === "cancelada" ? "Audiência cancelada no tribunal." : "Você saiu desta audiência na pauta." }) });
    }
    await db().from("aud_convites").update({ status: "cancelado", graph_event_id: null, versao: null }).eq("id", atual.id);
    if (!deveExistir) return "cancelados";
  }
  if (!deveExistir || !pessoa) return null;

  const evento = eventoDoConvite(aud, papel, pessoa, pessoas, { urlPauta: ctx.urlPauta, duracoes: ctx.duracoes });
  const versao = versaoDoEvento(evento);
  const vivo = atual && !trocouPessoa && atual.status !== "cancelado" ? atual : null;
  if (vivo && vivo.versao === versao) return null;

  let graphId: string | null = vivo?.graph_event_id ?? null;
  if (ctx.real) {
    if (graphId) await graph(ctx.token, `${base}/${graphId}`, { method: "PATCH", body: JSON.stringify(evento) });
    else {
      const criado = await graph(ctx.token, base, { method: "POST", body: JSON.stringify({ ...evento, transactionId: `aud-${aud.id}-${papel}-${pessoa.id}` }) });
      graphId = (criado?.id as string | undefined) ?? null;
    }
  }
  await db()
    .from("aud_convites")
    .upsert(
      { audiencia_id: aud.id, papel, pessoa_id: pessoa.id, graph_event_id: graphId, versao, status: ctx.real ? "enviado" : "simulado", erro: null, payload: evento, ...(vivo ? {} : { resposta: "sem_resposta" }) },
      { onConflict: "audiencia_id,papel" }
    );
  return vivo ? "atualizados" : "criados";
}

/** Lê no Graph se cada pessoa aceitou, recusou ou não respondeu (só no modo real). */
export async function lerRespostas(): Promise<number> {
  const config = await lerConfig();
  if (!(modoOutlook() === "real" && config.outlook.ligado)) return 0;
  const organizador = config.outlook.organizador || process.env.MICROSOFT_MAIL_SENDER?.trim() || "";
  const { data } = await db().from("aud_convites").select("id, graph_event_id, resposta").eq("status", "enviado").not("graph_event_id", "is", null).limit(300);
  const token = await tokenGraph();
  let lidas = 0;
  for (const c of (data ?? []) as { id: string; graph_event_id: string; resposta: string | null }[]) {
    try {
      const ev = await graph(token, `/users/${encodeURIComponent(organizador)}/events/${c.graph_event_id}?$select=attendees`);
      const attendee = ((ev?.attendees as { status?: { response?: string } }[] | undefined) ?? [])[0];
      const resposta = respostaDoGraph(attendee?.status?.response);
      if (resposta !== c.resposta) await db().from("aud_convites").update({ resposta }).eq("id", c.id);
      lidas += 1;
    } catch (erro) {
      console.error("[pauta] resposta do convite:", erro instanceof Error ? erro.message : erro);
    }
  }
  return lidas;
}
