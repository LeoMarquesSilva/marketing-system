import "server-only";

import { evolutionFetch, getEvolutionConfig } from "@/lib/evolution-whatsapp";
import { mensagemErrosDoRobo, type ErroDoRobo } from "./aviso-erro-robo";

/** Grupo "OPERAÇÕES LEGAIS - GERAL": o número da "RESPONSUM - BP" (a instância dos avisos de automação) está nele. */
const GRUPO_OPERACOES_LEGAIS = "120363402540466773@g.us";
const INSTANCIA_AVISOS = "RESPONSUM - BP";

/**
 * Avisa no grupo de Operações Legais os erros novos do robô. O destino pode ser trocado por
 * VISTAGEM_ERRO_ROBO_WHATSAPP (número com DDI ou id @g.us; "off" desliga) e a instância por
 * VISTAGEM_ALERTA_EVOLUTION_INSTANCE. Nunca lança: o aviso não pode atrapalhar a leitura dos envios.
 */
export async function avisarErrosDoRobo(erros: ErroDoRobo[]): Promise<{ enviado: boolean; motivo?: string }> {
  const texto = mensagemErrosDoRobo(erros);
  if (!texto) return { enviado: false, motivo: "Nenhum erro novo." };
  const destino = process.env.VISTAGEM_ERRO_ROBO_WHATSAPP?.trim() || GRUPO_OPERACOES_LEGAIS;
  if (destino.toLowerCase() === "off") return { enviado: false, motivo: "Aviso desligado (VISTAGEM_ERRO_ROBO_WHATSAPP=off)." };
  const instancia = process.env.VISTAGEM_ALERTA_EVOLUTION_INSTANCE?.trim() || INSTANCIA_AVISOS;
  if (!getEvolutionConfig()) return { enviado: false, motivo: "Evolution API não configurada." };
  try {
    await evolutionFetch(`/message/sendText/${encodeURIComponent(instancia)}`, {
      method: "POST",
      body: { number: destino, text: texto },
    });
    return { enviado: true };
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    console.error("[vistagem] aviso de erro do robô no WhatsApp:", motivo);
    return { enviado: false, motivo };
  }
}
