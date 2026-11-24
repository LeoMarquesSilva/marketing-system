import { MinhasClient } from "@/components/rh/one-on-one/minhas-client";
import { getOverview } from "@/lib/rh/one-on-one/server";
import type { OneOnOneOverview } from "@/lib/rh/one-on-one/types";
import { RhHttpError } from "@/lib/rh/qualifications/server";

export const dynamic = "force-dynamic";

type PageData = { forbidden: string } | { forbidden: null; overview: OneOnOneOverview };

async function loadPageData(): Promise<PageData> {
  try {
    return { forbidden: null, overview: await getOverview() };
  } catch (error) {
    if (error instanceof RhHttpError && error.status === 403) return { forbidden: error.message };
    throw error;
  }
}

export default async function MinhasUmAUmPage() {
  const data = await loadPageData();
  if (data.forbidden !== null) {
    return (
      <div className="rounded-lg border border-[#dce9eb] bg-white px-6 py-10 text-center text-sm text-muted-foreground">
        {data.forbidden}
      </div>
    );
  }
  return <MinhasClient overview={data.overview} />;
}
