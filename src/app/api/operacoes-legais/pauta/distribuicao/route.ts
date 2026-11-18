import { comAcesso } from "@/lib/audiencias/http";
import { dadosDaDistribuicao } from "@/lib/audiencias/pauta-server";

export const dynamic = "force-dynamic";

/** A tela da reunião diária: hoje e os próximos dois dias úteis. */
export async function GET() {
  return comAcesso(async () => dadosDaDistribuicao());
}
