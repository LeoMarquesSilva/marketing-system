import { NextResponse } from "next/server";
import { toOperacoesLegaisApiError } from "@/lib/operacoes-legais/server";
import { requireVistagemAccess } from "@/lib/operacoes-legais/vistagem/db";
import { buildSchedulePayload } from "@/lib/operacoes-legais/vistagem/schedule/engine";
import { reviewScheduledChain, scheduleOnVios } from "@/lib/operacoes-legais/vistagem/vios/connector";
import type { Publication, TaskType } from "@/lib/operacoes-legais/vistagem/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase } = await requireVistagemAccess();
    const body = await request.json().catch(() => ({}));
    const limit = Number(body.limit || 10);
    const forceDryRun = body.dry_run === true;

    const { data: jobs, error } = await supabase
      .from("schedule_jobs")
      .select("*")
      .eq("status", "queued")
      .order("queued_at", { ascending: true })
      .limit(limit);
    if (error) {
      return NextResponse.json({ error: error.message, code: "JOBS_QUERY_FAILED" }, { status: 500 });
    }

    const results = [];

    for (const job of jobs || []) {
      await supabase
        .from("schedule_jobs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", job.id);

      const { data: pub } = await supabase
        .from("publications")
        .select("*")
        .eq("id", job.publication_id)
        .single();

      if (!pub) {
        await supabase
          .from("schedule_jobs")
          .update({
            status: "failed",
            error: "publication missing",
            finished_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        continue;
      }

      await supabase.from("publications").update({ status: "AGENDANDO" }).eq("id", pub.id);

      try {
        let taskType: TaskType | null = null;
        if (pub.tipo_agendamento_id) {
          const { data } = await supabase
            .from("task_types")
            .select("*")
            .eq("id", pub.tipo_agendamento_id)
            .single();
          taskType = data as TaskType | null;
        }

        const payload = buildSchedulePayload(pub as Publication, taskType);
        const dryRun = forceDryRun || job.dry_run;

        if (payload.idempotency_key) {
          const { data: existing } = await supabase
            .from("publications")
            .select("id, status, vios_pxe_id")
            .eq("idempotency_key", payload.idempotency_key)
            .neq("id", pub.id)
            .maybeSingle();
          if (existing?.vios_pxe_id) {
            await supabase
              .from("publications")
              .update({
                status: "SKIP",
                schedule_error: `Duplicado de ${existing.id}`,
                idempotency_key: payload.idempotency_key,
              })
              .eq("id", pub.id);
            await supabase
              .from("schedule_jobs")
              .update({
                status: "done",
                finished_at: new Date().toISOString(),
                error: "duplicate idempotency",
              })
              .eq("id", job.id);
            results.push({ job_id: job.id, status: "SKIP", reason: "duplicate" });
            continue;
          }
        }

        const scheduled = await scheduleOnVios(payload, { dryRun });
        await supabase.from("schedule_attempts").insert({
          job_id: job.id,
          attempt_no: 1,
          request_payload: payload,
          response_payload: scheduled,
          success: scheduled.success,
        });

        const review = scheduled.review || (await reviewScheduledChain(payload, scheduled.pxe_id));

        const finalStatus =
          review.status === "SKIP"
            ? "SKIP"
            : review.status === "ERRO"
              ? "ERRO"
              : review.status === "SIM_OK_AJUSTE"
                ? "SIM_OK_AJUSTE"
                : "SIM_OK";

        await supabase
          .from("publications")
          .update({
            status: finalStatus,
            vios_pxe_id: scheduled.pxe_id,
            schedule_error: scheduled.success ? null : scheduled.message,
            idempotency_key: payload.idempotency_key,
            data_conclusao: payload.data_prevista,
            data_limite: payload.data_limite,
          })
          .eq("id", pub.id);

        await supabase.from("schedule_results").insert({
          job_id: job.id,
          publication_id: pub.id,
          vios_pxe_id: scheduled.pxe_id,
          review_status: review.status,
          review_notes: review.notes,
          chain_snapshot: review.chain,
        });

        await supabase
          .from("schedule_jobs")
          .update({
            status: scheduled.success ? "done" : "failed",
            dry_run: dryRun,
            error: scheduled.success ? null : scheduled.message,
            finished_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        results.push({
          job_id: job.id,
          publication_id: pub.id,
          status: finalStatus,
          pxe_id: scheduled.pxe_id,
          dry_run: dryRun,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await supabase
          .from("publications")
          .update({ status: "ERRO", schedule_error: message })
          .eq("id", pub.id);
        await supabase
          .from("schedule_jobs")
          .update({
            status: "failed",
            error: message,
            finished_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        results.push({ job_id: job.id, status: "ERRO", error: message });
      }
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (error) {
    const api = toOperacoesLegaisApiError(error);
    return NextResponse.json(api.body, { status: api.status });
  }
}
