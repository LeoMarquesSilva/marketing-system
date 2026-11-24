import { FeriasAcessoNegado } from "@/components/ferias/acesso-negado";
import { GestaoClient } from "@/components/rh/one-on-one/gestao-client";
import { getHrOverview } from "@/lib/rh/one-on-one/server";
import type { OneOnOneHrOverview } from "@/lib/rh/one-on-one/types";
import { RhHttpError } from "@/lib/rh/qualifications/server";

export const dynamic = "force-dynamic";

type PageData = { forbidden: true } | { forbidden: false; data: OneOnOneHrOverview };

async function loadPageData(): Promise<PageData> {
  try {
    return { forbidden: false, data: await getHrOverview() };
  } catch (error) {
    if (error instanceof RhHttpError && error.status === 403) return { forbidden: true };
    throw error;
  }
}

export default async function GestaoUmAUmPage() {
  const result = await loadPageData();
  if (result.forbidden) return <FeriasAcessoNegado />;
  return <GestaoClient data={result.data} />;
}
