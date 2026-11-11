import "server-only";

import { FacilitiesHttpError, getOpexSyncedAt, listFacilitiesPeople, listSuppliers } from "./server";
import type { FacilitiesPerson, FacilitiesSupplier } from "./types";

export type FacilitiesPageData =
  | { forbidden: true }
  | { forbidden: false; suppliers: FacilitiesSupplier[]; people: FacilitiesPerson[]; opexSyncedAt: string | null };

/** Dados das telas de Facilities; sem a permissão, a página mostra o aviso de acesso restrito. */
export async function loadFacilitiesPageData(): Promise<FacilitiesPageData> {
  try {
    const [suppliers, people, opexSyncedAt] = await Promise.all([listSuppliers(), listFacilitiesPeople(), getOpexSyncedAt()]);
    return { forbidden: false, suppliers, people, opexSyncedAt };
  } catch (error) {
    if (error instanceof FacilitiesHttpError && error.status === 403) return { forbidden: true };
    throw error;
  }
}
