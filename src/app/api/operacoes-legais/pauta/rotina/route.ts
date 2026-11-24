import { comAdmin } from "@/lib/audiencias/http";
import { rodarRotina } from "@/lib/audiencias/rotina-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Roda a rotina agora (admin): conferência com o VIOS (sempre), DJEN, convites, respostas e avisos do horário. */
export async function POST() {
  return comAdmin(async () => rodarRotina(new Date(), { forcarVios: true }));
}
