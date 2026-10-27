import "server-only";

import { evolutionFetch, getEvolutionConfig } from "@/lib/evolution-whatsapp";
import { mensagemArquivoAtrasado, situacaoDoDia, type ArquivoDoDia } from "./alerta-arquivo";
import { carregarFeriados } from "./feriados";
import { admin, falhou, hojeEmSaoPaulo } from "./server";

function horaEmSaoPaulo(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
}

/** O arquivo da Kurier de hoje chegou? (Faixa nas abas Captura e Controladoria e alerta do cron.) */
export async function situacaoArquivoDoDia(): Promise<ArquivoDoDia> {
  const hoje = hojeEmSaoPaulo();
  const [feriados, { data, error }] = await Promise.all([
    carregarFeriados().catch(() => [] as string[]),
    admin().from("vistagem_kurier_arquivos").select("status, erro").eq("data_arquivo", hoje),
  ]);
  if (error) falhou("consultar o arquivo do dia", error);
  return situacaoDoDia({ hoje, hora: horaEmSaoPaulo(), feriados, arquivosDeHoje: data ?? [] });
}

/**
 * Grupo e instância dos avisos de automação do SIOE (sioe-aviso-sync e notify-error.js do VIOS):
 * o número da "RESPONSUM - BP" está no grupo; o da instância comercial do Orquestra, não.
 */
const GRUPO_AVISOS = "120363410106016262@g.us";
const INSTANCIA_AVISOS = "RESPONSUM - BP";

/**
 * Avisa no grupo de WhatsApp das automações que o arquivo do dia não chegou. Destino e instância
 * podem ser trocados por VISTAGEM_ALERTA_WHATSAPP (número com DDI ou id @g.us) e
 * VISTAGEM_ALERTA_EVOLUTION_INSTANCE.
 */
export async function alertarArquivoAtrasado(situacao: ArquivoDoDia): Promise<{ enviado: boolean; motivo?: string }> {
  const destino = process.env.VISTAGEM_ALERTA_WHATSAPP?.trim() || GRUPO_AVISOS;
  const instancia = process.env.VISTAGEM_ALERTA_EVOLUTION_INSTANCE?.trim() || INSTANCIA_AVISOS;
  if (!getEvolutionConfig()) return { enviado: false, motivo: "Evolution API não configurada." };
  await evolutionFetch(`/message/sendText/${encodeURIComponent(instancia)}`, {
    method: "POST",
    body: { number: destino, text: mensagemArquivoAtrasado(situacao) },
  });
  return { enviado: true };
}
