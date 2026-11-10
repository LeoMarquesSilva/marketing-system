import { FeriasAcessoNegado } from "@/components/ferias/acesso-negado";
import { CommitteeClient } from "@/components/rh/bp-awards/committee/committee-client";
import { getCommitteeView } from "@/lib/rh/bp-awards/server";
import type { CommitteeView } from "@/lib/rh/bp-awards/types";
import { RhHttpError } from "@/lib/rh/qualifications/server";

export const dynamic = "force-dynamic";

async function loadView(): Promise<CommitteeView | null> {
  try {
    return await getCommitteeView();
  } catch (error) {
    if (error instanceof RhHttpError && error.status === 403) return null;
    throw error;
  }
}

/** Comitê do BP Awards: participação, apuração por valor, finalistas e vencedores (só RH). */
export default async function BpAwardsCommitteePage() {
  const view = await loadView();
  if (!view) return <FeriasAcessoNegado />;
  return <CommitteeClient initial={view} />;
}
