import { FeriasClient } from "@/components/ferias/ferias-client";
import { FeriasAcessoNegado } from "@/components/ferias/acesso-negado";
import {
  FeriasHttpError,
  listEmployeesWithBalance,
  listLinkableUsers,
  listRecess,
  listViosSyncAlerts,
} from "@/lib/ferias/server";
import type {
  CompanyRecess,
  EmployeeWithBalance,
  LinkableUser,
  ViosSyncAlerts,
} from "@/lib/ferias/types";

export const dynamic = "force-dynamic";

type PageData =
  | { forbidden: true }
  | {
      forbidden: false;
      employees: EmployeeWithBalance[];
      recess: CompanyRecess[];
      users: LinkableUser[];
      viosAlerts: ViosSyncAlerts;
    };

async function loadPageData(): Promise<PageData> {
  try {
    const [employees, recess, users, viosAlerts] = await Promise.all([
      listEmployeesWithBalance(),
      listRecess(),
      listLinkableUsers(),
      listViosSyncAlerts(),
    ]);
    return { forbidden: false, employees, recess, users, viosAlerts };
  } catch (error) {
    if (error instanceof FeriasHttpError && error.status === 403) return { forbidden: true };
    throw error;
  }
}

export default async function FeriasPage() {
  const data = await loadPageData();
  if (data.forbidden) return <FeriasAcessoNegado />;
  return (
    <FeriasClient
      employees={data.employees}
      recess={data.recess}
      users={data.users}
      viosAlerts={data.viosAlerts}
    />
  );
}
