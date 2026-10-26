import { facilitiesResponse } from "@/lib/facilities/api";
import { contractAiKey, extractContract } from "@/lib/facilities/contract-ai";
import { downloadDocument, FacilitiesHttpError } from "@/lib/facilities/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Lê o contrato com IA e devolve os campos para pré-preencher (nada é gravado). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return facilitiesResponse(async () => {
    const { id } = await params;
    const apiKey = contractAiKey();
    if (!apiKey) throw new FacilitiesHttpError("Chave da OpenAI não configurada.", 503, "AI_UNAVAILABLE");
    const file = await downloadDocument(id);
    return { extraction: await extractContract({ apiKey, ...file }) };
  });
}
