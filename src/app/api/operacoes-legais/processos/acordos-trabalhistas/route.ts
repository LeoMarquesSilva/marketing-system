import { comAcesso } from "@/lib/processos/http";
import { carregarPainelDeNegociacao } from "@/lib/processos/negociacao-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Painel de acordos trabalhistas: cada processo da área, os advogados do reclamante, o risco e a negociação. */
export async function GET() {
  return comAcesso(async (ator) => carregarPainelDeNegociacao(ator));
}
