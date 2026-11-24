import { FeriasAcessoNegado } from "@/components/ferias/acesso-negado";
import { GestaoFeedbackClient } from "@/components/rh/feedback/gestao-feedback-client";
import { getHrOverview } from "@/lib/rh/feedback/server";
import type { FeedbackHrOverview } from "@/lib/rh/feedback/types";
import { RhHttpError } from "@/lib/rh/qualifications/server";

export const dynamic = "force-dynamic";

type PageData = { forbidden: true } | { forbidden: false; data: FeedbackHrOverview };

async function loadPageData(): Promise<PageData> {
  try {
    return { forbidden: false, data: await getHrOverview() };
  } catch (error) {
    if (error instanceof RhHttpError && error.status === 403) return { forbidden: true };
    throw error;
  }
}

export default async function GestaoFeedbackPage() {
  const result = await loadPageData();
  if (result.forbidden) return <FeriasAcessoNegado />;
  return <GestaoFeedbackClient data={result.data} />;
}
