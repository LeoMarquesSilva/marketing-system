import { pedirAtualizacoes } from "@/lib/processos/autos-server";
import { comAcesso, lerJson } from "@/lib/processos/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST { ids: string[] } — pede ao robô a atualização dos autos de vários processos (os da carteira filtrada).
 * Cada um traz só o que entrou desde o último download; a IA lê só o novo.
 */
export async function POST(request: Request) {
  return comAcesso(async (ator) => {
    const corpo = await lerJson(request);
    const ids = Array.isArray(corpo.ids) ? corpo.ids.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500) : [];
    return { resultado: await pedirAtualizacoes(ids, ator) };
  });
}
