import "server-only";

import { evolutionFetch, getEvolutionConfig } from "@/lib/evolution-whatsapp";
import { criarCalendario } from "@/lib/vistagem/dias-uteis";
import { carregarFeriados } from "@/lib/vistagem/feriados";
import { alertasDaAudiencia, geraAvisos, hojeEmBrasilia, local, proximosDiasUteis, somarDias } from "./agenda";
import { lerConfig, modoWhatsapp } from "./config-server";
import { respostasDasAudiencias } from "./convites-server";
import { mensagemDaPauta, mensagemDeAlertas, mensagemDeMudanca, mensagemDeTroca, type Mensagem } from "./mensagens";
import { carregarAudiencias, carregarPessoas, db } from "./server";
import type { Audiencia, Papel } from "./tipos";

/**
 * Avisos no grupo de WhatsApp da área. Cada aviso tem uma chave (dedupe_key): o mesmo aviso nunca sai duas vezes.
 * Sem PAUTA_WHATSAPP_MODO=real e o liga/desliga da tela, o aviso fica registrado como "simulado" (modo teste).
 * O número do grupo e a instância ficam na configuração, nunca no código (repositório público).
 */

const INSTANCIA_PADRAO = "RESPONSUM - BP";

export async function ehDiaUtil(): Promise<(iso: string) => boolean> {
  try {
    return criarCalendario(await carregarFeriados());
  } catch {
    return criarCalendario([]);
  }
}

export async function enviarAviso(dedupeKey: string, mensagem: Mensagem, audienciaId: string | null = null): Promise<"enviado" | "simulado" | "desligado" | "erro" | "repetido"> {
  const modo = modoWhatsapp();
  const config = await lerConfig();
  const real = modo === "real" && config.whatsapp.ligado && Boolean(config.whatsapp.grupo) && Boolean(getEvolutionConfig());
  const status = modo === "off" ? "desligado" : real ? "erro" : "simulado";
  const { data, error } = await db()
    .from("aud_avisos")
    .upsert({ dedupe_key: dedupeKey, audiencia_id: audienciaId, texto: mensagem.texto, mencoes: mensagem.mencoes, status }, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (error) {
    console.error("[pauta] registrar aviso:", error.message);
    return "erro";
  }
  if (!data?.length) return "repetido";
  if (!real) return status;
  try {
    const instancia = config.whatsapp.instancia || INSTANCIA_PADRAO;
    await evolutionFetch(`/message/sendText/${encodeURIComponent(instancia)}`, {
      method: "POST",
      body: { number: config.whatsapp.grupo, text: mensagem.texto, mentioned: mensagem.mencoes },
    });
    await db().from("aud_avisos").update({ status: "enviado", erro: null }).eq("dedupe_key", dedupeKey);
    return "enviado";
  } catch (erro) {
    await db().from("aud_avisos").update({ erro: erro instanceof Error ? erro.message : String(erro) }).eq("dedupe_key", dedupeKey);
    return "erro";
  }
}

function proxima(aud: Audiencia, dias = 30): boolean {
  const ms = new Date(aud.inicio).getTime() - Date.now();
  return ms > -60 * 60 * 1000 && ms < dias * 24 * 60 * 60 * 1000;
}

export async function avisarMudanca(aud: Audiencia): Promise<void> {
  if (!geraAvisos(aud) || !proxima(aud) || (!aud.mudancas.length && aud.situacao !== "cancelada")) return;
  const pessoas = new Map((await carregarPessoas()).map((p) => [p.id, p]));
  const chave = `mudanca:${aud.id}:${[...aud.mudancas].sort().join(",")}:${aud.situacao}`;
  await enviarAviso(chave, mensagemDeMudanca(aud, pessoas), aud.id);
}

export async function avisarTroca(aud: Audiencia, papel: Papel, de: string | null, para: string, motivo: string | null): Promise<void> {
  if (!geraAvisos(aud) || !proxima(aud, 60)) return;
  const pessoas = new Map((await carregarPessoas()).map((p) => [p.id, p]));
  await enviarAviso(`troca:${aud.id}:${papel}:${para}:${Date.now()}`, mensagemDeTroca(aud, papel, de, para, motivo, pessoas), aud.id);
}

/** "Pauta de hoje" (7h) ou "Pauta do próximo dia útil" (17h): uma vez por dia cada. */
export async function avisarPautaDoDia(qual: "hoje" | "proximo", agora = new Date()): Promise<string> {
  const util = await ehDiaUtil();
  const hoje = hojeEmBrasilia(agora);
  if (!util(hoje)) return "hoje não é dia útil";
  const dia = qual === "hoje" ? hoje : proximosDiasUteis(hoje, 1, util)[0]!;
  const auds = (await carregarAudiencias(`${dia}T00:00:00-03:00`, `${somarDias(dia, 1)}T00:00:00-03:00`)).filter(geraAvisos);
  const pessoas = new Map((await carregarPessoas()).map((p) => [p.id, p]));
  const titulo = qual === "hoje" ? "Pauta de hoje" : dia === somarDias(hoje, 1) ? "Pauta de amanhã" : "Pauta do próximo dia útil";
  const mensagem = mensagemDaPauta(titulo, dia, auds, pessoas);
  if (!mensagem) return "sem audiências";
  return enviarAviso(`pauta:${qual}:${dia}`, mensagem);
}

/**
 * Alerta para a coordenação (régua do Samuel: "na hora"): sem titular, conflito de horário, sem tempo de deslocamento
 * ou titular que recusou o convite, nas audiências de hoje e dos próximos dois dias úteis. Roda na rotina e logo
 * depois do que muda a pauta (leitura do robô, troca, resposta ao convite). Só em dia útil, das 7h às 19h: fim de
 * semana e noite não chamam ninguém. Cada alerta sai uma vez por dia (a linha dele em aud_avisos é a trava); os novos
 * de uma vez vão juntos numa mensagem.
 */
export async function avisarAlertasGraves(agora = new Date()): Promise<number> {
  const util = await ehDiaUtil();
  const hoje = hojeEmBrasilia(agora);
  const hora = horaDeBrasilia(agora);
  if (!util(hoje) || hora < 7 || hora >= 19) return 0;
  const dias = [hoje, ...proximosDiasUteis(hoje, 2, util)];
  const auds = await carregarAudiencias(`${dias[0]}T00:00:00-03:00`, `${somarDias(dias[dias.length - 1]!, 1)}T00:00:00-03:00`);
  const lista = await carregarPessoas();
  const pessoas = new Map(lista.map((p) => [p.id, p]));
  const coordenacao = lista.filter((p) => p.coordenacao && p.ativo).map((p) => p.id);
  const respostas = await respostasDasAudiencias(auds);
  const itens: { chave: string; aud: Audiencia; texto: string }[] = [];
  for (const aud of auds) {
    if (aud.situacao !== "designada" || !geraAvisos(aud) || new Date(aud.inicio).getTime() < agora.getTime()) continue;
    for (const alerta of alertasDaAudiencia(aud, { pessoas, todas: auds, respostas })) {
      if (["sem_titular", "choque", "deslocamento", "recusou"].includes(alerta.tipo)) itens.push({ chave: `alerta:${aud.id}:${alerta.tipo}:${hoje}`, aud, texto: alerta.texto });
    }
  }
  if (!itens.length) return 0;
  // Uma linha por alerta: a chave única diz quais ainda não saíram hoje.
  const { data, error } = await db()
    .from("aud_avisos")
    .upsert(
      itens.map((i) => ({ dedupe_key: i.chave, audiencia_id: i.aud.id, texto: i.texto, mencoes: [], status: modoWhatsapp() === "off" ? "desligado" : "simulado" })),
      { onConflict: "dedupe_key", ignoreDuplicates: true }
    )
    .select("dedupe_key");
  if (error) {
    console.error("[pauta] registrar alertas:", error.message);
    return 0;
  }
  const novasChaves = new Set(((data ?? []) as { dedupe_key: string }[]).map((l) => l.dedupe_key));
  const novos = itens.filter((i) => novasChaves.has(i.chave));
  if (!novos.length) return 0;
  const r = await enviarAviso(`alertas:${hoje}:${agora.getTime()}`, mensagemDeAlertas(novos, coordenacao, pessoas), novos.length === 1 ? novos[0]!.aud.id : null);
  if (r === "enviado" || r === "erro") await db().from("aud_avisos").update({ status: r }).in("dedupe_key", novos.map((n) => n.chave));
  return novos.length;
}

export function horaDeBrasilia(agora = new Date()): number {
  return Number(local(agora.toISOString()).hora.slice(0, 2));
}
