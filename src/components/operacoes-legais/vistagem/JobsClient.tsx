"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function JobsClient({
  initialJobs,
  initialResults,
}: {
  initialJobs: Array<Record<string, unknown>>;
  initialResults: Array<Record<string, unknown>>;
}) {
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(false);

  async function processJobs(dryRun: boolean) {
    setLoading(true);
    setLog("Processando…");
    const res = await fetch("/api/operacoes-legais/schedule/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 20, dry_run: dryRun }),
    });
    const json = await res.json();
    setLog(JSON.stringify(json, null, 2));
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={loading} onClick={() => processJobs(true)}>
          Processar fila (dry-run)
        </Button>
        <Button type="button" variant="outline" disabled={loading} onClick={() => processJobs(false)}>
          Processar (respeita VIOS_DRY_RUN)
        </Button>
      </div>
      {log && (
        <pre className="overflow-auto rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
          {log}
        </pre>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Jobs</h3>
        <div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>CI / Tipo</TableHead>
                <TableHead>Dry-run</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Nenhum job na fila.
                  </TableCell>
                </TableRow>
              ) : (
                initialJobs.map((j) => {
                  const pub = j.publications as
                    | { ci?: string; tipo_agendamento_label?: string }
                    | null;
                  return (
                    <TableRow key={String(j.id)}>
                      <TableCell>{String(j.status)}</TableCell>
                      <TableCell className="text-xs">
                        {pub?.ci || "—"} · {pub?.tipo_agendamento_label || "—"}
                      </TableCell>
                      <TableCell>{j.dry_run ? "sim" : "não"}</TableCell>
                      <TableCell className="text-xs text-red-700">
                        {j.error ? String(j.error) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Últimos resultados</h3>
        {initialResults.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum resultado ainda.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {initialResults.map((r) => (
              <li
                key={String(r.id)}
                className="rounded-lg border border-border/80 bg-card px-3 py-2 shadow-sm"
              >
                <span className="font-medium text-[#285f7a]">{String(r.review_status)}</span>
                {" · "}pxe {String(r.vios_pxe_id || "—")} · {String(r.review_notes || "")}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
