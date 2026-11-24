import { after } from "next/server";
import { comAcesso } from "@/lib/audiencias/http";
import { reagirAMudanca } from "@/lib/audiencias/rotina-server";
import { dadosDaDistribuicao } from "@/lib/audiencias/pauta-server";

export const dynamic = "force-dynamic";

/**
 * A tela da reunião diária: hoje e os próximos dois dias úteis. Depois de responder, lê as respostas aos convites (no
 * máximo a cada 10 minutos) e, se alguém recusou, avisa a coordenação.
 */
export async function GET() {
  after(() => reagirAMudanca({ convites: false, respostas: true, alertas: "se recusou" }));
  return comAcesso(async () => dadosDaDistribuicao());
}
