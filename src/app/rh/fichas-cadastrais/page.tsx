import { FeriasAcessoNegado } from "@/components/ferias/acesso-negado";
import { FichasCadastraisClient } from "@/components/rh/registration/fichas-cadastrais-client";
import {
  listLinkableEmployees,
  listRegistrationForms,
  RhHttpError,
} from "@/lib/rh/registration/server";
import type { RegistrationEmployeeRef, RegistrationListItem } from "@/lib/rh/registration/types";

export const dynamic = "force-dynamic";

type PageData =
  | { forbidden: true }
  | { forbidden: false; items: RegistrationListItem[]; employees: RegistrationEmployeeRef[] };

async function loadPageData(): Promise<PageData> {
  try {
    const [items, employees] = await Promise.all([listRegistrationForms(), listLinkableEmployees()]);
    return { forbidden: false, items, employees };
  } catch (error) {
    if (error instanceof RhHttpError && error.status === 403) return { forbidden: true };
    throw error;
  }
}

export default async function FichasCadastraisPage() {
  const data = await loadPageData();
  if (data.forbidden) return <FeriasAcessoNegado />;
  return <FichasCadastraisClient initialItems={data.items} employees={data.employees} />;
}
