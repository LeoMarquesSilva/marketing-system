import { comAcesso, lerJson } from "@/lib/processos/http";
import { detalharPessoa, salvarPessoa } from "@/lib/processos/pessoas-server";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async () => ({ pessoa: await detalharPessoa(id) }));
}

export async function PUT(request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async () => ({ pessoa: await salvarPessoa(id, await lerJson(request)) }));
}
