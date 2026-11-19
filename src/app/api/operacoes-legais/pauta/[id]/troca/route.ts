import { comAcesso, lerJson } from "@/lib/audiencias/http";
import { trocarPessoa } from "@/lib/audiencias/pauta-server";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

/** Corpo: { papel: "titular" | "backup", pessoaId, motivo }. */
export async function POST(request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async (ator) => ({ audiencia: await trocarPessoa(id, await lerJson(request), ator) }));
}
