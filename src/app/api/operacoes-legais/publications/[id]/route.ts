import { NextResponse } from "next/server";
import { toOperacoesLegaisApiError } from "@/lib/operacoes-legais/server";
import { requireVistagemAccess } from "@/lib/operacoes-legais/vistagem/db";
import type { PublicationStatus } from "@/lib/operacoes-legais/vistagem/types";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const { actor, supabase } = await requireVistagemAccess();

    const { data: current } = await supabase.from("publications").select("*").eq("id", id).single();
    if (!current) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const allowed = [
      "escritorio_responsavel",
      "grupo",
      "demanda_risco",
      "pasta",
      "ci",
      "juridico_texto",
      "controladoria_texto",
      "tipo_agendamento_id",
      "tipo_agendamento_label",
      "data_conclusao",
      "data_limite",
      "data_fatal",
      "hora_inicio",
      "hora_fim",
      "prioridade_agendamento",
      "status",
      "responsavel_principal",
      "cliente_principal",
    ] as const;

    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (updates.data_conclusao && !updates.data_limite) {
      updates.data_limite = updates.data_conclusao;
    }
    if (updates.data_limite && !updates.data_conclusao) {
      updates.data_conclusao = updates.data_limite;
    }
    if (
      updates.data_conclusao &&
      updates.data_limite &&
      updates.data_conclusao !== updates.data_limite
    ) {
      updates.data_limite = updates.data_conclusao;
    }

    if (
      current.status === "MATCH_PENDENTE" &&
      updates.escritorio_responsavel &&
      updates.escritorio_responsavel !== "POSSÍVEL ABERTURA DE PASTA" &&
      (updates.pasta || current.pasta) &&
      (updates.pasta || current.pasta) !== "POSSÍVEL ABERTURA DE PASTA"
    ) {
      updates.status = "JURIDICO_VISTAR";
    }

    const { data, error } = await supabase
      .from("publications")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message, code: "UPDATE_FAILED" }, { status: 400 });
    }

    await supabase.from("publication_events").insert({
      publication_id: id,
      event_type: "update",
      from_status: current.status as PublicationStatus,
      to_status: (data.status as PublicationStatus) || current.status,
      actor_id: actor.id,
      payload: updates,
    });

    if (data.status === "AGENDAR" && current.status !== "AGENDAR") {
      await supabase.from("schedule_jobs").insert({
        publication_id: id,
        status: "queued",
        dry_run: (process.env.VIOS_DRY_RUN ?? "true") !== "false",
      });
    }

    return NextResponse.json({ ok: true, publication: data });
  } catch (error) {
    const api = toOperacoesLegaisApiError(error);
    return NextResponse.json(api.body, { status: api.status });
  }
}
