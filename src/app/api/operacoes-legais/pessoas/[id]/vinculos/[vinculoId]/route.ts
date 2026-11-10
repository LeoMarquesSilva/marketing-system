import { comAcesso } from "@/lib/processos/http";
import { removerVinculo } from "@/lib/processos/pessoas-server";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; vinculoId: string }> }) {
  const { id, vinculoId } = await params;
  return comAcesso(async () => ({ pessoa: await removerVinculo(id, vinculoId) }));
}
