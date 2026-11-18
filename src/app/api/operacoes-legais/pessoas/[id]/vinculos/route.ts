import { comAcesso, lerJson } from "@/lib/processos/http";
import { adicionarVinculo } from "@/lib/processos/pessoas-server";

export const dynamic = "force-dynamic";

/** Corpo: { outraId, tipo, direcao: "de" | "para", observacao? }. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comAcesso(async () => ({ pessoa: await adicionarVinculo(id, await lerJson(request)) }));
}
