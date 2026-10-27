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
 * Avisa pelo WhatsApp (Evolution) que o arquivo do dia não chegou. O destino (número com DDI
 * ou id de grupo terminado em @g.us) fica em VISTAGEM_ALERTA_WHATSAPP.
 */
export async function alertarArquivoAtrasado(situacao: ArquivoDoDia): Promise<{ enviado: boolean; motivo?: string }> {
  const destino = process.env.VISTAGEM_ALERTA_WHATSAPP?.trim();
  if (!destino) return { enviado: false, motivo: "VISTAGEM_ALERTA_WHATSAPP não configurada." };
  const config = getEvolutionConfig();
  if (!config) return { enviado: false, motivo: "Evolution API não configurada." };
  await evolutionFetch(`/message/sendText/${config.instanceName}`, {
    method: "POST",
    body: { number: destino, text: mensagemArquivoAtrasado(situacao) },
  });
  return { enviado: true };
}
