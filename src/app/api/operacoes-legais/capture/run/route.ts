import { NextResponse } from "next/server";
import { toOperacoesLegaisApiError } from "@/lib/operacoes-legais/server";
import { requireVistagemAccess } from "@/lib/operacoes-legais/vistagem/db";
import { parseKurrierXlsx } from "@/lib/operacoes-legais/vistagem/capture/parse-kurrier";
import { applyTributarioRules, matchKurrierRow } from "@/lib/operacoes-legais/vistagem/capture/match";
import type { ProcessBaseRow } from "@/lib/operacoes-legais/vistagem/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { actor, supabase } = await requireVistagemAccess();
    const body = await request.json().catch(() => ({}));
    const captureDate = (body.capture_date as string) || new Date().toISOString().slice(0, 10);
    const pathPrefix = (body.path_prefix as string) || captureDate;

    const { data: files, error: listErr } = await supabase.storage
      .from("kurrier-inbox")
      .list(pathPrefix, { limit: 100 });
    if (listErr) throw listErr;

    const xlsxFiles = (files || []).filter((f) => f.name.toLowerCase().endsWith(".xlsx"));
    if (!xlsxFiles.length) {
      return NextResponse.json(
        {
          ok: false,
          error: `Nenhum .xlsx em kurrier-inbox/${pathPrefix}. Faça upload dos lotes Kurrier.`,
          code: "NO_XLSX",
        },
        { status: 400 }
      );
    }

    const { data: diarioRows } = await supabase.from("diario_map").select("*");
    const diarioMap = Object.fromEntries((diarioRows || []).map((r) => [r.from_text, r.to_text]));

    const { data: processRows, error: procErr } = await supabase
      .from("process_base_rows")
      .select("*")
      .eq("snapshot_date", captureDate);
    if (procErr) throw procErr;

    let baseRows = (processRows || []) as ProcessBaseRow[];
    if (!baseRows.length) {
      const { data: latest } = await supabase
        .from("process_base_rows")
        .select("*")
        .order("snapshot_date", { ascending: false })
        .limit(5000);
      baseRows = (latest || []) as ProcessBaseRow[];
    }

    const byCnj = new Map<string, ProcessBaseRow[]>();
    for (const row of baseRows) {
      if (!row.cnj) continue;
      const list = byCnj.get(row.cnj) || [];
      list.push(row);
      byCnj.set(row.cnj, list);
    }

    let inserted = 0;
    let matchPend = 0;
    const errors: string[] = [];

    for (const file of xlsxFiles) {
      const fullPath = `${pathPrefix}/${file.name}`;
      const { data: blob, error: dlErr } = await supabase.storage
        .from("kurrier-inbox")
        .download(fullPath);
      if (dlErr || !blob) {
        errors.push(`${fullPath}: ${dlErr?.message || "download fail"}`);
        continue;
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      const rows = await parseKurrierXlsx(buffer, file.name);

      for (const row of rows) {
        let matched = matchKurrierRow(row, byCnj, diarioMap);
        const trib = applyTributarioRules(matched);
        matched = {
          ...matched,
          escritorio_responsavel: trib.escritorio_responsavel,
        };

        const { error: insErr } = await supabase.from("publications").insert({
          capture_date: captureDate,
          ...matched,
        });
        if (insErr) {
          errors.push(`${file.name}/${row.numero_processo}: ${insErr.message}`);
          continue;
        }
        inserted += 1;
        if (matched.status === "MATCH_PENDENTE") matchPend += 1;
      }
    }

    await supabase.from("audit_events").insert({
      actor_id: actor.id,
      action: "capture.run",
      entity_type: "capture",
      payload: { captureDate, inserted, matchPend, errors },
    });

    return NextResponse.json({
      ok: true,
      capture_date: captureDate,
      files: xlsxFiles.length,
      inserted,
      match_pendente: matchPend,
      errors,
    });
  } catch (error) {
    const api = toOperacoesLegaisApiError(error);
    return NextResponse.json({ ok: false, ...api.body }, { status: api.status });
  }
}
