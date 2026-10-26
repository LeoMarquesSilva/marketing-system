import "server-only";

import { FacilitiesHttpError, listFacilitiesPeople, listSuppliers } from "./server";
import type { FacilitiesPerson, FacilitiesSupplier } from "./types";

export type FacilitiesPageData =
  | { forbidden: true }
  | { forbidden: false; suppliers: FacilitiesSupplier[]; people: FacilitiesPerson[] };

/** Dados das telas de Facilities; sem a permissão, a página mostra o aviso de acesso restrito. */
export async function loadFacilitiesPageData(): Promise<FacilitiesPageData> {
  try {
    const [suppliers, people] = await Promise.all([listSuppliers(), listFacilitiesPeople()]);
    return { forbidden: false, suppliers, people };
  } catch (error) {
    if (error instanceof FacilitiesHttpError && error.status === 403) return { forbidden: true };
    throw error;
  }
}
