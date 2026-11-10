import "server-only";

import { loadMaintenanceData } from "./maintenance-server";
import { FacilitiesHttpError } from "./server";
import type { MaintenanceData } from "./types";

/** Dados das telas de manutenção; null quando a pessoa não tem acesso a Facilities. */
export async function loadMaintenancePageData(): Promise<MaintenanceData | null> {
  try {
    return await loadMaintenanceData();
  } catch (error) {
    if (error instanceof FacilitiesHttpError && error.status === 403) return null;
    throw error;
  }
}
