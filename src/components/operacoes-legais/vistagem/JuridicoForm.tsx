"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Publication } from "@/lib/operacoes-legais/vistagem/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function JuridicoForm({ publication }: { publication: Publication }) {
  const router = useRouter();
  const [texto, setTexto] = useState(publication.juridico_texto || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(advance: boolean) {
    setSaving(true);
    const res = await fetch(`/api/operacoes-legais/publications/${publication.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        juridico_texto: texto,
        ...(advance ? { status: "PRAZO_PENDENTE" } : {}),
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMsg(json.error || "Erro");
      return;
    }
    setMsg(advance ? "Enviado para prazos" : "Salvo");
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/80 bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">Vistagem jurídica</h3>
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={8}
        placeholder="Considerações do jurídico…"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={saving} onClick={() => save(false)}>
          Salvar rascunho
        </Button>
        <Button type="button" disabled={saving || !texto.trim()} onClick={() => save(true)}>
          Concluir vistagem → prazos
        </Button>
      </div>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}
