"use client";

import { useState } from "react";
import { VistagemShell } from "@/components/operacoes-legais/vistagem/VistagemShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <VistagemShell
      title="Captura Kurrier"
      description="Envie os xlsx do dia para o bucket e rode a captura. A base VIOS deve estar em process_base_rows."
    >
      <div className="max-w-xl space-y-4 rounded-lg border border-border/80 bg-card p-5 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="capture-date">Data da captura</Label>
          <Input
            id="capture-date"
            type="date"
            value={captureDate}
            onChange={(e) => setCaptureDate(e.target.value)}
          />
        </div>
        <Button type="button" disabled={loading} onClick={runCapture}>
          {loading ? "Processando…" : "Rodar captura"}
        </Button>
        {log && (
          <pre className="overflow-auto rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
            {log}
          </pre>
        )}
      </div>
    </VistagemShell>
  );
}
