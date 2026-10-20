import { FeriasAcessoNegado } from "@/components/ferias/acesso-negado";
import { FichasCadastraisClient } from "@/components/rh/registration/fichas-cadastrais-client";
import { listEmployeeRegistrations } from "@/lib/rh/registration/employees-server";
import { listRegistrationForms, RhHttpError } from "@/lib/rh/registration/server";
import type { EmployeeRegistrationRow, RegistrationListItem } from "@/lib/rh/registration/types";

export const dynamic = "force-dynamic";

type PageData =
  | { forbidden: true }
  | { forbidden: false; items: RegistrationListItem[]; employees: EmployeeRegistrationRow[] };

async function loadPageData(): Promise<PageData> {
  try {
    const [items, employees] = await Promise.all([listRegistrationForms(), listEmployeeRegistrations()]);
    return { forbidden: false, items, employees };
  } catch (error) {
    if (error instanceof RhHttpError && error.status === 403) return { forbidden: true };
    throw error;
  }
}

export default async function FichasCadastraisPage() {
  const data = await loadPageData();
  if (data.forbidden) return <FeriasAcessoNegado />;
  return <FichasCadastraisClient initialItems={data.items} initialEmployees={data.employees} />;
}
