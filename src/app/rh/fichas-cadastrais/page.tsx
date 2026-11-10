import { FeriasAcessoNegado } from "@/components/ferias/acesso-negado";
import { FichasCadastraisClient } from "@/components/rh/registration/fichas-cadastrais-client";
import { listEmployeeRegistrations } from "@/lib/rh/registration/employees-server";
import { listRegistrationForms, RhHttpError } from "@/lib/rh/registration/server";
import type { EmployeeRegistrationRow, RegistrationListItem } from "@/lib/rh/registration/types";
import { getWelcomeOverview } from "@/lib/rh/welcome/server";
import type { WelcomeOverview } from "@/lib/rh/welcome/types";

export const dynamic = "force-dynamic";

type PageData =
  | { forbidden: true }
  | {
      forbidden: false;
      items: RegistrationListItem[];
      employees: EmployeeRegistrationRow[];
      welcome: WelcomeOverview;
    };

async function loadPageData(): Promise<PageData> {
  try {
    const [items, employees, welcome] = await Promise.all([
      listRegistrationForms(),
      listEmployeeRegistrations(),
      getWelcomeOverview(),
    ]);
    return { forbidden: false, items, employees, welcome };
  } catch (error) {
    if (error instanceof RhHttpError && error.status === 403) return { forbidden: true };
    throw error;
  }
}

export default async function FichasCadastraisPage() {
  const data = await loadPageData();
  if (data.forbidden) return <FeriasAcessoNegado />;
  return (
    <FichasCadastraisClient initialItems={data.items} initialEmployees={data.employees} initialWelcome={data.welcome} />
  );
}
