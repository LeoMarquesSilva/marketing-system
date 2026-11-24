import { mandarConviteDeTeste } from "@/lib/audiencias/convites-server";
import { comAdmin, lerJson } from "@/lib/audiencias/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Corpo: { email }. Admin: manda o convite de titular da próxima audiência designada só para esse e-mail, com
 * "[TESTE]" no título, para ver no Outlook antes de ligar os convites para a equipe. Sai mesmo em modo teste.
 */
export async function POST(request: Request) {
  return comAdmin(async () => mandarConviteDeTeste(await lerJson(request)));
}
