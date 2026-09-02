"use client";

import { useState } from "react";
import { VistagemShell } from "@/components/operacoes-legais/vistagem/VistagemShell";

export default function CapturaPage() {
  const [captureDate, setCaptureDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(false);

  async function runCapture() {
    setLoading(true);
    setLog("Rodando captura…");
    try {
      const res = await fetch("/api/operacoes-legais/capture/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capture_date: captureDate, path_prefix: captureDate }),
      });
      const json = await res.json();
      setLog(JSON.stringify(json, null, 2));
    } catch (e) {
      setLog(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <VistagemShell title="Captura Kurrier">
      <div className="max-w-xl space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm text-zinc-400">
          Envie os xlsx do dia para o bucket <code>kurrier-inbox/&lt;data&gt;/</code> e rode a
          captura. A base VIOS deve estar em <code>process_base_rows</code>.
        </p>
        <label className="block text-sm">
          Data da captura
          <input
            type="date"
            value={captureDate}
            onChange={(e) => setCaptureDate(e.target.value)}
            className="mt-1 w-full rounded border border-white/20 bg-[#0b1c2c] px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={runCapture}
          className="rounded-md bg-[#c9a227] px-4 py-2 text-sm font-medium text-[#0b1c2c] disabled:opacity-50"
        >
          {loading ? "Processando…" : "Rodar captura"}
        </button>
        {log && (
          <pre className="overflow-auto rounded bg-black/40 p-3 text-xs text-zinc-300">{log}</pre>
        )}
      </div>
    </VistagemShell>
  );
}
