import { FeriasAcessoNegado } from "@/components/ferias/acesso-negado";
import { QualificacoesClient } from "@/components/rh/qualificacoes-client";
import {
  listQualificationRequirementHistoryForHr,
  listQualificationsForHr,
  RhHttpError,
} from "@/lib/rh/qualifications/server";
import type { QualificationListItem } from "@/lib/rh/qualifications/types";
import type { QualificationRequirementHistoryItem } from "@/lib/rh/qualifications/requirements";

export const dynamic = "force-dynamic";

type PageData =
  | { forbidden: true }
  | {
      forbidden: false;
      items: QualificationListItem[];
      history: QualificationRequirementHistoryItem[];
    };

async function loadPageData(): Promise<PageData> {
  try {
    const [items, history] = await Promise.all([
      listQualificationsForHr(),
      listQualificationRequirementHistoryForHr(),
    ]);
    return { forbidden: false, items, history };
  } catch (error) {
    if (error instanceof RhHttpError && error.status === 403) return { forbidden: true };
    throw error;
  }
}

export default async function QualificacoesPage() {
  const data = await loadPageData();
  if (data.forbidden) return <FeriasAcessoNegado />;
  return <QualificacoesClient items={data.items} history={data.history} />;
}
