import { comAcesso, lerJson } from "@/lib/audiencias/http";
import { conferirMudancas } from "@/lib/audiencias/pauta-server";

export const dynamic = "force-dynamic";

/** Corpo: { ids: [...] } das audiências cuja mudança ou cancelamento foi conferido no VIOS. */
export async function POST(request: Request) {
  return comAcesso(async (ator) => conferirMudancas(await lerJson(request), ator));
}
