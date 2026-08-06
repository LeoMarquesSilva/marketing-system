import { FeriasClient } from "@/components/ferias/ferias-client";
import { FeriasAcessoNegado } from "@/components/ferias/acesso-negado";
import {
  FeriasHttpError,
  listEmployeesWithBalance,
  listLinkableUsers,
  listRecessWithApplicationStatus,
} from "@/lib/ferias/server";
import type {
  CompanyRecessWithStatus,
  EmployeeWithBalance,
  LinkableUser,
} from "@/lib/ferias/types";

export const dynamic = "force-dynamic";

type PageData =
  | { forbidden: true }
  | {
      forbidden: false;
      employees: EmployeeWithBalance[];
      recess: CompanyRecessWithStatus[];
      users: LinkableUser[];
    };

async function loadPageData(): Promise<PageData> {
  try {
    const [employees, recess, users] = await Promise.all([
      listEmployeesWithBalance(),
      listRecessWithApplicationStatus(),
      listLinkableUsers(),
    ]);
    return { forbidden: false, employees, recess, users };
  } catch (error) {
    if (error instanceof FeriasHttpError && error.status === 403) return { forbidden: true };
    throw error;
  }
}

export default async function FeriasPage() {
  const data = await loadPageData();
  if (data.forbidden) return <FeriasAcessoNegado />;
  return (
    <FeriasClient employees={data.employees} recess={data.recess} users={data.users} />
  );
}
