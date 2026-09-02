import { CatalogClient } from "@/components/operacoes-legais/vistagem/CatalogClient";
import { VistagemShell } from "@/components/operacoes-legais/vistagem/VistagemShell";
import { requireVistagemAccess } from "@/lib/operacoes-legais/vistagem/db";

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  let types: Array<{
    id: string;
    code: string;
    label_vios: string;
    kind: string;
    requires_hora: boolean;
    notes: string | null;
    aliases: string[];
    flows: Array<{
      name: string;
      steps: Array<{ step_order: number; label: string; offset_rule: string }>;
    }>;
  }> = [];

  try {
    const { supabase } = await requireVistagemAccess();
    const { data: taskTypes } = await supabase.from("task_types").select("*").order("label_vios");
    const { data: aliases } = await supabase.from("task_type_aliases").select("*");
    const { data: flows } = await supabase.from("task_flows").select("*");
    const { data: steps } = await supabase.from("task_flow_steps").select("*").order("step_order");

    types = (taskTypes || []).map((t) => ({
      id: t.id,
      code: t.code,
      label_vios: t.label_vios,
      kind: t.kind,
      requires_hora: t.requires_hora,
      notes: t.notes,
      aliases: (aliases || []).filter((a) => a.task_type_id === t.id).map((a) => a.alias),
      flows: (flows || [])
        .filter((f) => f.task_type_id === t.id)
        .map((f) => ({
          name: f.name,
          steps: (steps || [])
            .filter((s) => s.flow_id === f.id)
            .map((s) => ({
              step_order: s.step_order,
              label: s.label,
              offset_rule: s.offset_rule,
            })),
        })),
    }));
  } catch {
    types = [];
  }

  return (
    <VistagemShell title="Catálogo de tipos VIOS">
      <p className="mb-4 text-sm text-zinc-400">
        Tipos canônicos, aliases e fluxos vinculados (FATAL / UNA).
      </p>
      <CatalogClient initialTypes={types} />
    </VistagemShell>
  );
}
