import { FeriasAcessoNegado } from "@/components/ferias/acesso-negado";
import { BoasPraticasClient } from "@/components/rh/boas-praticas/boas-praticas-client";
import { listFeedbackPeople, listFeedbacks } from "@/lib/rh/boas-praticas/server";
import { RhHttpError } from "@/lib/rh/qualifications/server";
import type { FeedbackPerson, GoodPracticeFeedback } from "@/lib/rh/boas-praticas/types";

export const dynamic = "force-dynamic";

type PageData =
  | { forbidden: true }
  | { forbidden: false; items: GoodPracticeFeedback[]; people: FeedbackPerson[] };

async function loadPageData(): Promise<PageData> {
  try {
    const [items, people] = await Promise.all([listFeedbacks(), listFeedbackPeople()]);
    return { forbidden: false, items, people };
  } catch (error) {
    if (error instanceof RhHttpError && error.status === 403) return { forbidden: true };
    throw error;
  }
}

export default async function BoasPraticasPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; mes?: string }>;
}) {
  const [data, params] = await Promise.all([loadPageData(), searchParams]);
  if (data.forbidden) return <FeriasAcessoNegado />;
  return (
    <BoasPraticasClient
      initialItems={data.items}
      people={data.people}
      initialTab={params.aba === "registros" ? "registros" : "dashboard"}
      initialMonth={params.mes}
    />
  );
}
