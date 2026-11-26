import { after } from "next/server";
import { comAcesso } from "@/lib/audiencias/http";
import { reagirAMudanca } from "@/lib/audiencias/rotina-server";
import { pautaDoPeriodo } from "@/lib/audiencias/pauta-server";

export const dynamic = "force-dynamic";

/**
 * Pauta de um período: ?de=AAAA-MM-DD&ate=AAAA-MM-DD (padrão: hoje + 7 dias). Depois de responder, lê as respostas aos
 * convites (no máximo a cada 10 minutos) e, se alguém recusou, avisa a coordenação.
 */
export async function GET(request: Request) {
  after(() => reagirAMudanca({ convites: false, respostas: true, alertas: "se recusou" }));
  return comAcesso(async () => pautaDoPeriodo(new URL(request.url).searchParams));
}
