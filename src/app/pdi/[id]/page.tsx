import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PlanView } from "@/components/rh/pdi/plan-view";
import { getPdiOverview, getPlanDetail } from "@/lib/rh/pdi/server";
import { RhHttpError } from "@/lib/rh/qualifications/server";
import type { PdiOverview, PdiPlanDetail } from "@/lib/rh/pdi/types";

export const dynamic = "force-dynamic";

type PageData =
  | { blocked: 403 | 404 }
  | { blocked: null; plan: PdiPlanDetail; overview: PdiOverview };

async function loadPageData(id: string): Promise<PageData> {
  try {
    const [plan, overview] = await Promise.all([getPlanDetail(id), getPdiOverview()]);
    return { blocked: null, plan, overview };
  } catch (error) {
    if (error instanceof RhHttpError && (error.status === 403 || error.status === 404)) return { blocked: error.status };
    throw error;
  }
}

export default async function PdiPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadPageData(id);

  if (data.blocked) {
    return (
      <div className="rounded-lg border border-[#dce9eb] bg-white px-6 py-10 text-center">
        <p className="text-base font-semibold text-foreground">
          {data.blocked === 404 ? "PDI não encontrado" : "Você não tem acesso a este PDI"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Só a própria pessoa, quem a lidera e Pessoas e Cultura veem o plano.</p>
        <Link href="/pdi" className="mt-4 inline-block text-sm text-[#285f7a] hover:underline">
          Voltar para Meu PDI
        </Link>
      </div>
    );
  }

  const { plan, overview } = data;
  const back =
    plan.viewer_role === "rh"
      ? { href: "/rh/pdi", label: "Gestão de PDI" }
      : plan.viewer_role === "gestor"
        ? { href: "/pdi?aba=equipe", label: "Minha equipe" }
        : { href: "/pdi", label: "Meu PDI" };
  return (
    <div className="space-y-4">
      <Link
        href={back.href}
        className="inline-flex items-center gap-1.5 rounded text-sm text-[#285f7a] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {back.label}
      </Link>
      <PlanView plan={plan} types={overview.types} managerOptions={overview.isHr ? overview.creatable : undefined} />
    </div>
  );
}
