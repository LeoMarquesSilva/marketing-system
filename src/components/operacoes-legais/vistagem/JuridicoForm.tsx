"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Publication } from "@/lib/operacoes-legais/vistagem/types";

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
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="font-medium text-[#c9a227]">Vistagem jurídica</h3>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={8}
        className="w-full rounded border border-white/20 bg-[#0b1c2c] px-3 py-2 text-sm"
        placeholder="Considerações do jurídico…"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => save(false)}
          className="rounded-md border border-white/20 px-4 py-2 text-sm"
        >
          Salvar rascunho
        </button>
        <button
          type="button"
          disabled={saving || !texto.trim()}
          onClick={() => save(true)}
          className="rounded-md bg-[#c9a227] px-4 py-2 text-sm font-medium text-[#0b1c2c] disabled:opacity-40"
        >
          Concluir vistagem → prazos
        </button>
      </div>
      {msg && <p className="text-sm text-zinc-300">{msg}</p>}
    </div>
  );
}
