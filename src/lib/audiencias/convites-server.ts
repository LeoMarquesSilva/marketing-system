import "server-only";

import { z } from "zod";
import { tokenGraph } from "@/lib/vistagem/sharepoint";
import { geraAvisos, respostasDosConvites, type RespostasDosConvites } from "./agenda";
import { lerConfig, modoOutlook, type ConfigPauta } from "./config-server";
import { eventoDoConvite, respostaDoGraph, versaoDoEvento } from "./outlook";
import { AudienciasError, carregarAudiencias, carregarPessoas, COLUNAS_AUDIENCIA, db, falhou, paraAudiencia, registrarHistorico } from "./server";
import type { Audiencia, ConvitePauta, Papel, PessoaPauta } from "./tipos";

/**
 * Convites do Outlook (Microsoft Graph, permissão de aplicação Calendars.ReadWrite na caixa organizadora).
 * Um convite por papel em cada audiência dos próximos 45 dias. Em modo teste (padrão), grava o convite que
 * mandaria e não chama o Graph.
 *
 * Quando sai: na rotina (7h e 17h) e logo depois do que muda a audiência (troca de titular ou backup, o que a
 * equipe completa, a leitura do robô), só para as audiências mexidas — como no desenho da pauta, o convite sai "ao
 * distribuir", sem esperar a próxima rotina.
 */

const JANELA_DIAS = 45;
const GRAPH = "https://graph.microsoft.com/v1.0";
/** Convites em paralelo: no primeiro dia saem uns 170 de uma vez; em série passaria do tempo da função. */
const SIMULTANEOS = 4;

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
  const resposta = await fetch(caminho.startsWith("http") ? caminho : `${GRAPH}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (resposta.status === 204 || resposta.status === 202) return null;
  const corpo = (await resposta.json().catch(() => null)) as Record<string, unknown> | null;
  if (!resposta.ok) throw new Error(`Graph ${resposta.status}: ${String((corpo?.error as { message?: string } | undefined)?.message ?? "").slice(0, 200)}`);
  return corpo;
}

function organizadorDe(config: ConfigPauta): string {
  return config.outlook.organizador || process.env.MICROSOFT_MAIL_SENDER?.trim() || "";
}

function urlDaPauta(): string | undefined {
  return process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/operacoes-legais/pauta` : undefined;
}

/** Roda `fn` em todos os itens, `n` por vez. */
async function emLotes<T>(itens: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let proximo = 0;
  async function trabalhador() {
    while (proximo < itens.length) {
      const item = itens[proximo]!;
      proximo += 1;
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, trabalhador));
}

/** As audiências pelo id, só as que ainda não começaram (o convite de uma audiência passada não muda mais). */
async function audienciasPorId(ids: string[]): Promise<Audiencia[]> {
  const unicos = [...new Set(ids)].filter(Boolean);
  if (!unicos.length) return [];
  const { data, error } = await db().from("aud_audiencias").select(COLUNAS_AUDIENCIA).in("id", unicos.slice(0, 300)).gte("inicio", new Date().toISOString());
  if (error) falhou("carregar as audiências do convite", error);
  return ((data ?? []) as Parameters<typeof paraAudiencia>[0][]).map(paraAudiencia);
}

async function convitesDas(ids: string[]): Promise<Map<string, LinhaConvite>> {
  const mapa = new Map<string, LinhaConvite>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await db()
      .from("aud_convites")
      .select("id, audiencia_id, papel, pessoa_id, graph_event_id, versao, status")
      .in("audiencia_id", ids.slice(i, i + 300));
    if (error) falhou("ler os convites", error);
    for (const c of (data ?? []) as LinhaConvite[]) mapa.set(`${c.audiencia_id}:${c.papel}`, c);
  }
  return mapa;
}

export interface ResumoConvites {
  modo: "real" | "simulado";
  criados: number;
  atualizados: number;
  cancelados: number;
  erros: number;
}

/**
 * Cria, atualiza ou cancela os convites. Sem `ids`, todas as audiências dos próximos 45 dias (rotina); com `ids`,
 * só essas (troca, completar, leitura do robô).
 */
export async function sincronizarConvites(opcoes: { ids?: string[] } = {}): Promise<ResumoConvites> {
  const config = await lerConfig();
  const real = modoOutlook() === "real" && config.outlook.ligado;
  const organizador = organizadorDe(config);
  const resumo: ResumoConvites = { modo: real ? "real" : "simulado", criados: 0, atualizados: 0, cancelados: 0, erros: 0 };
  if (real && !organizador) throw new Error("Defina a caixa organizadora dos convites (configuração ou MICROSOFT_MAIL_SENDER).");

  const agora = new Date();
  const auds = opcoes.ids
    ? await audienciasPorId(opcoes.ids)
    : await carregarAudiencias(agora.toISOString(), new Date(agora.getTime() + JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString());
  if (!auds.length) return resumo;
  const pessoas = new Map((await carregarPessoas()).map((p) => [p.id, p]));
  const existentes = await convitesDas(auds.map((a) => a.id));
  const token = real ? await tokenGraph() : "";
  const ctx = { real, token, organizador, urlPauta: urlDaPauta(), duracoes: config.duracoes };

  const tarefas = auds.flatMap((aud) => (["titular", "backup"] as const).map((papel) => ({ aud, papel })));
  await emLotes(tarefas, SIMULTANEOS, async ({ aud, papel }) => {
    const pessoaId = papel === "titular" ? aud.titularId : aud.backupId;
    const pessoa = pessoaId ? pessoas.get(pessoaId) ?? null : null;
    const atual = existentes.get(`${aud.id}:${papel}`) ?? null;
    try {
      const r = await sincronizarUm(aud, papel, pessoa, atual, pessoas, ctx);
      if (r) resumo[r] += 1;
    } catch (erro) {
      resumo.erros += 1;
      await db()
        .from("aud_convites")
        .upsert({ audiencia_id: aud.id, papel, pessoa_id: pessoa?.id ?? null, status: "erro", erro: erro instanceof Error ? erro.message : String(erro) }, { onConflict: "audiencia_id,papel" });
    }
  });
  return resumo;
}

/**
 * Para depois de uma troca (`ids` da audiência) ou de uma leitura do tribunal (sem `ids`: a janela toda, e só sai o
 * que mudou). Nunca derruba quem chamou, só registra o erro.
 */
export async function sincronizarConvitesDe(ids?: string[]): Promise<void> {
  try {
    await sincronizarConvites(ids ? { ids } : {});
  } catch (erro) {
    console.error("[pauta] convites depois da mudança:", erro instanceof Error ? erro.message : erro);
  }
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
  const deveExistir = aud.situacao === "designada" && geraAvisos(aud) && Boolean(pessoa?.email) && Boolean(pessoa?.ativo);
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
  // Mesmo convite e mesma versão: nada a fazer. No modo real, o convite que só foi simulado ainda precisa sair.
  if (vivo && vivo.versao === versao && (!ctx.real || vivo.graph_event_id)) return null;

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
      { audiencia_id: aud.id, papel, pessoa_id: pessoa.id, graph_event_id: graphId, versao, status: ctx.real ? "enviado" : "simulado", erro: null, payload: evento, ...(vivo?.graph_event_id ? {} : { resposta: "sem_resposta" }) },
      { onConflict: "audiencia_id,papel" }
    );
  return vivo?.graph_event_id || (vivo && !ctx.real) ? "atualizados" : "criados";
}

/**
 * Lê no Graph se cada pessoa aceitou, recusou ou não respondeu (só no modo real). Uma consulta à agenda da caixa
 * organizadora (calendarView) traz todos os convites com a resposta de cada convidado, em vez de uma por convite.
 * Recusa fica no histórico da audiência; a Distribuição mostra em vermelho.
 */
export async function lerRespostas(): Promise<{ lidas: number; mudaram: number; recusas: number }> {
  const config = await lerConfig();
  if (!(modoOutlook() === "real" && config.outlook.ligado)) return { lidas: 0, mudaram: 0, recusas: 0 };
  const organizador = organizadorDe(config);
  const { data, error } = await db()
    .from("aud_convites")
    .select("id, audiencia_id, papel, pessoa_id, graph_event_id, resposta")
    .eq("status", "enviado")
    .not("graph_event_id", "is", null)
    .limit(2000);
  if (error) falhou("ler os convites enviados", error);
  const convites = (data ?? []) as { id: string; audiencia_id: string; papel: Papel; pessoa_id: string | null; graph_event_id: string; resposta: string | null }[];
  if (!convites.length) return { lidas: 0, mudaram: 0, recusas: 0 };

  const token = await tokenGraph();
  const agora = Date.now();
  const de = new Date(agora - 2 * 24 * 60 * 60 * 1000).toISOString();
  const ate = new Date(agora + 180 * 24 * 60 * 60 * 1000).toISOString();
  const respostas = new Map<string, string | undefined>();
  let pagina: string | null = `/users/${encodeURIComponent(organizador)}/calendarView?startDateTime=${de}&endDateTime=${ate}&$select=id,attendees&$top=500`;
  for (let i = 0; pagina && i < 20; i += 1) {
    const corpo = await graph(token, pagina);
    for (const ev of (corpo?.value as { id: string; attendees?: { status?: { response?: string } }[] }[] | undefined) ?? []) respostas.set(ev.id, ev.attendees?.[0]?.status?.response);
    pagina = (corpo?.["@odata.nextLink"] as string | undefined) ?? null;
  }

  const pessoas = new Map((await carregarPessoas()).map((p) => [p.id, p]));
  let lidas = 0;
  let mudaram = 0;
  let recusas = 0;
  for (const c of convites) {
    if (!respostas.has(c.graph_event_id)) continue;
    lidas += 1;
    const resposta = respostaDoGraph(respostas.get(c.graph_event_id));
    if (resposta === c.resposta) continue;
    mudaram += 1;
    if (resposta === "recusado") recusas += 1;
    await db().from("aud_convites").update({ resposta }).eq("id", c.id);
    if (resposta === "recusado" || resposta === "aceito")
      await registrarHistorico(c.audiencia_id, resposta === "recusado" ? "recusou o convite" : "aceitou o convite", {
        para: `${c.papel === "titular" ? "Titular" : "Backup"}: ${(c.pessoa_id && pessoas.get(c.pessoa_id)?.nomeCurto) || "—"}`,
        feitoPor: "Outlook",
      });
  }
  return { lidas, mudaram, recusas };
}

const RESPOSTAS_LIDAS_EM = "respostas_lidas_em";

/**
 * Lê as respostas se a última leitura tem mais de `minutos` (a data fica em aud_config). Para ler "na hora" sem pesar:
 * depois de cada leitura do robô e quando alguém abre a Pauta ou a Distribuição. null = não leu (modo teste ou recente).
 */
export async function lerRespostasSeDevido(minutos = 10): Promise<{ lidas: number; mudaram: number; recusas: number } | null> {
  const config = await lerConfig();
  if (!(modoOutlook() === "real" && config.outlook.ligado)) return null;
  const { data } = await db().from("aud_config").select("valor").eq("chave", RESPOSTAS_LIDAS_EM).maybeSingle();
  const ultima = typeof data?.valor === "string" ? Date.parse(data.valor) : 0;
  if (Date.now() - ultima < minutos * 60 * 1000) return null;
  const agora = new Date().toISOString();
  await db().from("aud_config").upsert({ chave: RESPOSTAS_LIDAS_EM, valor: agora, atualizado_em: agora, atualizado_por: "sistema" }, { onConflict: "chave" });
  return lerRespostas();
}

/** As respostas ao convite das audiências (para os alertas do servidor: recusa vira aviso à coordenação). */
export async function respostasDasAudiencias(auds: Audiencia[]): Promise<RespostasDosConvites> {
  const convites: ConvitePauta[] = [];
  const ids = auds.map((a) => a.id);
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await db().from("aud_convites").select("audiencia_id, papel, pessoa_id, status, resposta").eq("status", "enviado").in("audiencia_id", ids.slice(i, i + 300));
    if (error) falhou("ler as respostas dos convites", error);
    for (const c of (data ?? []) as { audiencia_id: string; papel: Papel; pessoa_id: string | null; status: string; resposta: string | null }[])
      convites.push({ audienciaId: c.audiencia_id, papel: c.papel, pessoaId: c.pessoa_id, status: c.status, resposta: c.resposta });
  }
  return respostasDosConvites(convites, auds);
}

/**
 * Convite de teste: o convite de titular da próxima audiência designada, com "[TESTE]" no título, mandado só para
 * um e-mail (o de quem está testando), para ver no Outlook como fica antes de ligar para a equipe. Sai mesmo em modo
 * teste e não fica registrado em aud_convites. Só para e-mails do escritório (domínio da organizadora ou da equipe).
 */
export async function mandarConviteDeTeste(entrada: unknown): Promise<{ para: string; assunto: string; processo: string; organizador: string }> {
  const lido = z.object({ email: z.string().trim().toLowerCase().email("Digite um e-mail válido.") }).safeParse(entrada);
  if (!lido.success) throw new AudienciasError(lido.error.issues[0]?.message ?? "Digite um e-mail válido.", 400);
  const para = lido.data.email;
  const config = await lerConfig();
  const organizador = organizadorDe(config).toLowerCase();
  if (!organizador) throw new AudienciasError("Preencha e salve a caixa organizadora antes do teste: é ela quem manda o convite.", 400);
  if (para === organizador) throw new AudienciasError("Use um e-mail diferente da caixa organizadora: ela é quem manda o convite e não recebe convite dela mesma.", 400);
  const lista = await carregarPessoas();
  // Domínios do escritório: o da caixa organizadora e os dos e-mails da equipe (o escritório usa mais de um).
  const dominios = new Set([organizador, ...lista.map((p) => p.email?.toLowerCase() ?? "")].map((e) => e.split("@")[1]).filter(Boolean));
  if (!dominios.has(para.split("@")[1] ?? "")) throw new AudienciasError(`O teste vai só para e-mails do escritório (${[...dominios].map((d) => `@${d}`).join(" ou ")}).`, 400);

  const agora = new Date();
  const auds = await carregarAudiencias(agora.toISOString(), new Date(agora.getTime() + JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString());
  const aud = auds.find((a) => a.situacao === "designada" && a.titularId);
  if (!aud) throw new AudienciasError("Nenhuma audiência designada com titular nos próximos 45 dias para usar no teste.", 404);
  const pessoas = new Map(lista.map((p) => [p.id, p]));
  const titular = pessoas.get(aud.titularId!);
  if (!titular) throw new AudienciasError("A titular da audiência do teste não está na equipe.", 404);

  const evento = eventoDoConvite(aud, "titular", { ...titular, email: para }, pessoas, { urlPauta: urlDaPauta(), duracoes: config.duracoes });
  evento.subject = `[TESTE] ${evento.subject}`;
  evento.attendees = [{ emailAddress: { address: para, name: para }, type: "required" }];
  evento.body.content = `<p style="color:#b42318"><b>Convite de teste.</b> Só você recebeu; a equipe ainda não recebe convites. Pode recusar ou apagar.</p>${evento.body.content}`;
  const token = await tokenGraph();
  await graph(token, `/users/${encodeURIComponent(organizador)}/events`, { method: "POST", body: JSON.stringify({ ...evento, transactionId: `aud-teste-${aud.id}-${agora.getTime()}` }) });
  return { para, assunto: evento.subject, processo: aud.cnj, organizador };
}
