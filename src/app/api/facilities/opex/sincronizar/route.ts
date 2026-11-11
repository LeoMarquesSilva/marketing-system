import { facilitiesResponse } from "@/lib/facilities/api";
import { syncOpexSupplierPayments } from "@/lib/facilities/opex-sync-server";
import { FacilitiesHttpError, requireFacilitiesUser } from "@/lib/facilities/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** "Atualizar agora": traz os pagamentos do OPEX sem esperar o cron da madrugada. */
export async function POST() {
  return facilitiesResponse(async () => {
    await requireFacilitiesUser();
    try {
      return await syncOpexSupplierPayments("manual");
    } catch (error) {
      throw new FacilitiesHttpError(error instanceof Error ? error.message : "Falha ao atualizar o OPEX.", 502, "OPEX_SYNC_FAILED");
    }
  });
}
