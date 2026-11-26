import { after } from "next/server";
import { reagirAMudanca } from "@/lib/audiencias/rotina-server";
import { comAcesso, lerJson } from "@/lib/audiencias/http";
import { trocarPessoa } from "@/lib/audiencias/pauta-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Contexto = { params: Promise<{ id: string }> };

/** Corpo: { papel: "titular" | "backup", pessoaId, motivo }. Depois de responder, refaz o convite do Outlook. */
export async function POST(request: Request, { params }: Contexto) {
  const { id } = await params;
  return comAcesso(async (ator) => {
    const audiencia = await trocarPessoa(id, await lerJson(request), ator);
    after(() => reagirAMudanca({ ids: [id] }));
    return { audiencia };
  });
}
