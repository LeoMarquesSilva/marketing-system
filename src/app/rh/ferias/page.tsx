import { FeriasClient } from "@/components/ferias/ferias-client";
import { FeriasAcessoNegado } from "@/components/ferias/acesso-negado";
import {
  FeriasHttpError,
  listEmployeesWithBalance,
  listLinkableUsers,
  listRecessWithApplicationStatus,
  requireFeriasAccess,
} from "@/lib/ferias/server";
import { isFeriasEditor } from "@/lib/ferias/access";
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
      canManage: boolean;
      scopeAreas: string[] | null;
    };

async function loadPageData(): Promise<PageData> {
  try {
    const actor = await requireFeriasAccess();
    const canManage = isFeriasEditor(actor.access);
    const [employees, recess, users] = await Promise.all([
      listEmployeesWithBalance(undefined, actor),
      listRecessWithApplicationStatus(actor),
      canManage ? listLinkableUsers() : Promise.resolve([]),
    ]);
    return {
      forbidden: false,
      employees,
      recess,
      users,
      canManage,
      scopeAreas: actor.access.areas,
    };
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
      canManage={data.canManage}
      scopeAreas={data.scopeAreas}
    />
  );
}
