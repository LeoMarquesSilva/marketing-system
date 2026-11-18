import "server-only";

import { evolutionFetch, getEvolutionConfig } from "@/lib/evolution-whatsapp";
import { criarCalendario } from "@/lib/vistagem/dias-uteis";
import { carregarFeriados } from "@/lib/vistagem/feriados";
import { alertasDaAudiencia, hojeEmBrasilia, local, proximosDiasUteis, somarDias } from "./agenda";
import { lerConfig, modoWhatsapp } from "./config-server";
import { mensagemDaPauta, mensagemDeAlerta, mensagemDeMudanca, mensagemDeTroca, type Mensagem } from "./mensagens";
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
  if (!proxima(aud) || (!aud.mudancas.length && aud.situacao !== "cancelada")) return;
  const pessoas = new Map((await carregarPessoas()).map((p) => [p.id, p]));
  const chave = `mudanca:${aud.id}:${[...aud.mudancas].sort().join(",")}:${aud.situacao}`;
  await enviarAviso(chave, mensagemDeMudanca(aud, pessoas), aud.id);
}

export async function avisarTroca(aud: Audiencia, papel: Papel, de: string | null, para: string, motivo: string | null): Promise<void> {
  if (!proxima(aud, 60)) return;
  const pessoas = new Map((await carregarPessoas()).map((p) => [p.id, p]));
  await enviarAviso(`troca:${aud.id}:${papel}:${para}:${Date.now()}`, mensagemDeTroca(aud, papel, de, para, motivo, pessoas), aud.id);
}

/** "Pauta de hoje" (7h) ou "Pauta do próximo dia útil" (17h): uma vez por dia cada. */
export async function avisarPautaDoDia(qual: "hoje" | "proximo", agora = new Date()): Promise<string> {
  const util = await ehDiaUtil();
  const hoje = hojeEmBrasilia(agora);
  if (!util(hoje)) return "hoje não é dia útil";
  const dia = qual === "hoje" ? hoje : proximosDiasUteis(hoje, 1, util)[0]!;
  const auds = await carregarAudiencias(`${dia}T00:00:00-03:00`, `${somarDias(dia, 1)}T00:00:00-03:00`);
  const pessoas = new Map((await carregarPessoas()).map((p) => [p.id, p]));
  const titulo = qual === "hoje" ? "Pauta de hoje" : dia === somarDias(hoje, 1) ? "Pauta de amanhã" : "Pauta do próximo dia útil";
  const mensagem = mensagemDaPauta(titulo, dia, auds, pessoas);
  if (!mensagem) return "sem audiências";
  return enviarAviso(`pauta:${qual}:${dia}`, mensagem);
}

/** Sem titular, choque e deslocamento nos próximos dois dias úteis: marca a coordenação (uma vez por dia). */
export async function avisarAlertasGraves(agora = new Date()): Promise<number> {
  const util = await ehDiaUtil();
  const hoje = hojeEmBrasilia(agora);
  const dias = [hoje, ...proximosDiasUteis(hoje, 2, util)].filter((d) => util(d));
  if (!dias.length) return 0;
  const auds = await carregarAudiencias(`${dias[0]}T00:00:00-03:00`, `${somarDias(dias[dias.length - 1]!, 1)}T00:00:00-03:00`);
  const lista = await carregarPessoas();
  const pessoas = new Map(lista.map((p) => [p.id, p]));
  const coordenacao = lista.filter((p) => p.coordenacao && p.ativo).map((p) => p.id);
  let enviados = 0;
  for (const aud of auds) {
    if (aud.situacao !== "designada" || new Date(aud.inicio).getTime() < agora.getTime()) continue;
    for (const alerta of alertasDaAudiencia(aud, { pessoas, todas: auds })) {
      if (!["sem_titular", "choque", "deslocamento"].includes(alerta.tipo)) continue;
      const r = await enviarAviso(`alerta:${aud.id}:${alerta.tipo}:${hoje}`, mensagemDeAlerta(aud, alerta.texto, coordenacao, pessoas), aud.id);
      if (r !== "repetido") enviados += 1;
    }
  }
  return enviados;
}

export function horaDeBrasilia(agora = new Date()): number {
  return Number(local(agora.toISOString()).hora.slice(0, 2));
}
