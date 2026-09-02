import { PrazoForm } from "@/components/operacoes-legais/vistagem/PrazoForm";
import { PublicationDetail } from "@/components/operacoes-legais/vistagem/PublicationDetail";
import { VistagemShell } from "@/components/operacoes-legais/vistagem/VistagemShell";
import { requireVistagemAccess } from "@/lib/operacoes-legais/vistagem/db";
import type { Publication, TaskType } from "@/lib/operacoes-legais/vistagem/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PrazosDetailPage({ params }: Props) {
  const { id } = await params;
  let data: Publication | null = null;
  let types: TaskType[] = [];
  try {
    const { supabase } = await requireVistagemAccess();
    const res = await supabase.from("publications").select("*").eq("id", id).single();
    data = (res.data as Publication | null) ?? null;
    const { data: typeRows } = await supabase
      .from("task_types")
      .select("*")
      .eq("active", true)
      .order("label_vios");
    types = (typeRows || []) as TaskType[];
  } catch {
    notFound();
  }
  if (!data) notFound();

  return (
    <VistagemShell title="Ops · Definir prazo">
      <div className="grid gap-6 lg:grid-cols-2">
        <PublicationDetail publication={data} />
        <PrazoForm publication={data} taskTypes={types} />
      </div>
    </VistagemShell>
  );
}
