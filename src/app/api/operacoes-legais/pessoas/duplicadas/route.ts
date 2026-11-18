import { comAcesso } from "@/lib/processos/http";
import { listarDuplicadas } from "@/lib/processos/pessoas-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return comAcesso(async () => ({ grupos: await listarDuplicadas() }));
}
