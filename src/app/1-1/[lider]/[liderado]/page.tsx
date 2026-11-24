import Link from "next/link";
import { PairClient } from "@/components/rh/one-on-one/pair-client";
import { getPairDetail } from "@/lib/rh/one-on-one/server";
import type { OneOnOnePairDetail } from "@/lib/rh/one-on-one/types";
import { RhHttpError } from "@/lib/rh/qualifications/server";

export const dynamic = "force-dynamic";

type PageData = { blocked: { status: number; message: string } } | { blocked: null; detail: OneOnOnePairDetail };

async function loadPageData(leaderId: string, memberId: string): Promise<PageData> {
  try {
    return { blocked: null, detail: await getPairDetail(leaderId, memberId) };
  } catch (error) {
    if (error instanceof RhHttpError && [400, 403, 404].includes(error.status)) {
      return { blocked: { status: error.status, message: error.message } };
    }
    throw error;
  }
}

export default async function DuplaUmAUmPage({ params }: { params: Promise<{ lider: string; liderado: string }> }) {
  const { lider, liderado } = await params;
  const data = await loadPageData(lider, liderado);
  if (data.blocked) {
    return (
      <div className="rounded-lg border border-[#dce9eb] bg-white px-6 py-10 text-center">
        <p className="text-base font-semibold text-foreground">
          {data.blocked.status === 403 ? "Você não tem acesso a estas 1:1" : "Dupla não encontrada"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{data.blocked.message}</p>
        <Link href="/1-1" className="mt-4 inline-block text-sm text-[#285f7a] hover:underline">
          Voltar para Minhas 1:1
        </Link>
      </div>
    );
  }
  return <PairClient initial={data.detail} me={data.detail.viewer_employee_id} />;
}
