import { comAcesso } from "@/lib/processos/http";
import { painelDoRobo } from "@/lib/processos/painel-robo-server";

export const dynamic = "force-dynamic";

/** GET — o painel de gestão do robô de autos: fila, projeção, downloads, leitura pela IA e cobertura dos processos. */
export async function GET() {
  return comAcesso(async () => painelDoRobo());
}
