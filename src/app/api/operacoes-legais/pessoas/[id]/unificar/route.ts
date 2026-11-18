import { comAcesso, lerJson } from "@/lib/processos/http";
import { unificarGrupo } from "@/lib/processos/pessoas-server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Corpo: { origens: string[] } — as pessoas absorvidas por esta (a do endereço é a que fica). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comAcesso(async (ator) => ({ pessoa: await unificarGrupo(id, (await lerJson(request)).origens, ator) }));
}
