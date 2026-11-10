import { comAcesso } from "@/lib/processos/http";
import { listarProcessos } from "@/lib/processos/processos-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return comAcesso(async () => ({ processos: await listarProcessos() }));
}
