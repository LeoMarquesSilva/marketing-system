"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Publication } from "@/lib/operacoes-legais/vistagem/types";

export function MatchForm({ publication }: { publication: Publication }) {
  const router = useRouter();
  const [escritorio, setEscritorio] = useState(
    publication.escritorio_responsavel || "",
  );
  const [grupo, setGrupo] = useState(publication.grupo || "");
  const [pasta, setPasta] = useState(publication.pasta || "");
  const [ci, setCi] = useState(publication.ci || "");
  const [risco, setRisco] = useState(publication.demanda_risco);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch(`/api/operacoes-legais/publications/${publication.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        escritorio_responsavel: escritorio.toUpperCase(),
        grupo,
        pasta,
        ci: ci || null,
        demanda_risco: risco,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMsg(json.error || "Erro ao salvar");
      return;
    }
    setMsg("Salvo");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="font-medium text-[#c9a227]">Classificação (Controladoria)</h3>
      <label className="block text-sm">
        Escritório responsável
        <input
          value={escritorio}
          onChange={(e) => setEscritorio(e.target.value)}
          className="mt-1 w-full rounded border border-white/20 bg-[#0b1c2c] px-3 py-2"
          placeholder="CÍVEL | INSOLVÊNCIA"
        />
      </label>
      <label className="block text-sm">
        Grupo
        <input
          value={grupo}
          onChange={(e) => setGrupo(e.target.value)}
          className="mt-1 w-full rounded border border-white/20 bg-[#0b1c2c] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Pasta
        <input
          value={pasta}
          onChange={(e) => setPasta(e.target.value)}
          className="mt-1 w-full rounded border border-white/20 bg-[#0b1c2c] px-3 py-2"
          placeholder="PROCESSO PRINCIPAL - CI 12345"
        />
      </label>
      <label className="block text-sm">
        CI
        <input
          value={ci}
          onChange={(e) => setCi(e.target.value)}
          className="mt-1 w-full rounded border border-white/20 bg-[#0b1c2c] px-3 py-2"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={risco}
          onChange={(e) => setRisco(e.target.checked)}
        />
        Demanda de risco
      </label>
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="rounded-md bg-[#c9a227] px-4 py-2 text-sm font-medium text-[#0b1c2c]"
      >
        {saving ? "Salvando…" : "Salvar e liberar para jurídico"}
      </button>
      {msg && <p className="text-sm text-zinc-300">{msg}</p>}
    </div>
  );
}
