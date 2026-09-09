import { FeriasClient } from "@/components/ferias/ferias-client";
import { FeriasAcessoNegado } from "@/components/ferias/acesso-negado";
import { parseFeriasListQuery } from "@/lib/ferias/filters";
import {
  FeriasHttpError,
  listEmployeesWithBalance,
  listRecessWithApplicationStatus,
  requireFeriasAccess,
} from "@/lib/ferias/server";
import { isFeriasEditor } from "@/lib/ferias/access";
import type { CompanyRecessWithStatus, EmployeeWithBalance } from "@/lib/ferias/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type PageData =
  | { forbidden: true }
  | {
      forbidden: false;
      employees: EmployeeWithBalance[];
      recess: CompanyRecessWithStatus[];
      canManage: boolean;
      scopeAreas: string[] | null;
    };

async function loadPageData(): Promise<PageData> {
  try {
    const actor = await requireFeriasAccess();
    const canManage = isFeriasEditor(actor.access);
    const [employees, recess] = await Promise.all([
      listEmployeesWithBalance(undefined, actor),
      listRecessWithApplicationStatus(actor),
    ]);
    return {
      forbidden: false,
      employees,
      recess,
      canManage,
      scopeAreas: actor.access.areas,
    };
  } catch (error) {
    if (error instanceof FeriasHttpError && error.status === 403) return { forbidden: true };
    throw error;
  }
}

export default async function FeriasPage({ searchParams }: PageProps) {
  const [data, query] = await Promise.all([loadPageData(), searchParams]);
  if (data.forbidden) return <FeriasAcessoNegado />;
  const colaboradorParam = query.colaborador;
  const initialSelectedEmployeeId = Array.isArray(colaboradorParam)
    ? (colaboradorParam[0] ?? null)
    : (colaboradorParam ?? null);
  return (
    <FeriasClient
      employees={data.employees}
      recess={data.recess}
      canManage={data.canManage}
      scopeAreas={data.scopeAreas}
      initialQuery={parseFeriasListQuery(query)}
      initialSelectedEmployeeId={initialSelectedEmployeeId}
    />
  );
}
