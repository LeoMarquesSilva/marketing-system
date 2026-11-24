import { FeedbackClient } from "@/components/rh/feedback/feedback-client";
import { getOverview } from "@/lib/rh/feedback/server";
import type { FeedbackOverview } from "@/lib/rh/feedback/types";
import { RhHttpError } from "@/lib/rh/qualifications/server";

export const dynamic = "force-dynamic";

type PageData = { forbidden: string } | { forbidden: null; overview: FeedbackOverview };

async function loadPageData(): Promise<PageData> {
  try {
    return { forbidden: null, overview: await getOverview() };
  } catch (error) {
    if (error instanceof RhHttpError && error.status === 403) return { forbidden: error.message };
    throw error;
  }
}

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ f?: string; aba?: string }> }) {
  const params = await searchParams;
  const data = await loadPageData();
  if (data.forbidden !== null) {
    return <div className="rounded-2xl border border-[#e1ebee] bg-white px-6 py-10 text-center text-sm text-muted-foreground">{data.forbidden}</div>;
  }
  return <FeedbackClient initial={data.overview} initialTab={params.aba} initialFeedbackId={params.f ?? null} />;
}
