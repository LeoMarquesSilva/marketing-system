import { comAcesso } from "@/lib/audiencias/http";
import { pautaDoPeriodo } from "@/lib/audiencias/pauta-server";

export const dynamic = "force-dynamic";

/** Pauta de um período: ?de=AAAA-MM-DD&ate=AAAA-MM-DD (padrão: hoje + 7 dias). */
export async function GET(request: Request) {
  return comAcesso(async () => pautaDoPeriodo(new URL(request.url).searchParams));
}
