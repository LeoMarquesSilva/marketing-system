"use client";

import { useState } from "react";

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
        <button
          type="button"
          disabled={loading}
          onClick={() => processJobs(true)}
          className="rounded-md bg-[#c9a227] px-4 py-2 text-sm font-medium text-[#0b1c2c]"
        >
          Processar fila (dry-run)
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => processJobs(false)}
          className="rounded-md border border-white/20 px-4 py-2 text-sm"
        >
          Processar (respeita VIOS_DRY_RUN)
        </button>
      </div>
      {log && (
        <pre className="overflow-auto rounded bg-black/40 p-3 text-xs text-zinc-300">
          {log}
        </pre>
      )}

      <section>
        <h2 className="mb-2 text-sm uppercase tracking-wide text-zinc-400">Jobs</h2>
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#152b40] text-xs text-zinc-400">
              <tr>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">CI / Tipo</th>
                <th className="px-3 py-2">Dry-run</th>
                <th className="px-3 py-2">Erro</th>
              </tr>
            </thead>
            <tbody>
              {initialJobs.map((j) => {
                const pub = j.publications as
                  | { ci?: string; tipo_agendamento_label?: string }
                  | null;
                return (
                  <tr key={String(j.id)} className="border-t border-white/5">
                    <td className="px-3 py-2">{String(j.status)}</td>
                    <td className="px-3 py-2 text-xs">
                      {pub?.ci || "—"} · {pub?.tipo_agendamento_label || "—"}
                    </td>
                    <td className="px-3 py-2">{j.dry_run ? "sim" : "não"}</td>
                    <td className="px-3 py-2 text-xs text-red-300">
                      {j.error ? String(j.error) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm uppercase tracking-wide text-zinc-400">
          Últimos resultados
        </h2>
        <ul className="space-y-2 text-sm">
          {initialResults.map((r) => (
            <li
              key={String(r.id)}
              className="rounded border border-white/10 bg-white/5 px-3 py-2"
            >
              <span className="text-[#c9a227]">{String(r.review_status)}</span>{" "}
              · pxe {String(r.vios_pxe_id || "—")} · {String(r.review_notes || "")}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
