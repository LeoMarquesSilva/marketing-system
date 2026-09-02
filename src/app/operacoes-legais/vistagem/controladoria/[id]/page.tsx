import { MatchForm } from "@/components/operacoes-legais/vistagem/MatchForm";
import { PublicationDetail } from "@/components/operacoes-legais/vistagem/PublicationDetail";
import { VistagemShell } from "@/components/operacoes-legais/vistagem/VistagemShell";
import { requireVistagemAccess } from "@/lib/operacoes-legais/vistagem/db";
import type { Publication } from "@/lib/operacoes-legais/vistagem/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ControladoriaDetailPage({ params }: Props) {
  const { id } = await params;
  let data: Publication | null = null;
  try {
    const { supabase } = await requireVistagemAccess();
    const res = await supabase.from("publications").select("*").eq("id", id).single();
    data = (res.data as Publication | null) ?? null;
  } catch {
    notFound();
  }
  if (!data) notFound();

  return (
    <VistagemShell title="Controladoria · Item">
      <div className="grid gap-6 lg:grid-cols-2">
        <PublicationDetail publication={data} />
        <MatchForm publication={data} />
      </div>
    </VistagemShell>
  );
}
