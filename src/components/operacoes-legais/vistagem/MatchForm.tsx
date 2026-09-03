"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Publication } from "@/lib/operacoes-legais/vistagem/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MatchForm({ publication }: { publication: Publication }) {
  const router = useRouter();
  const [escritorio, setEscritorio] = useState(publication.escritorio_responsavel || "");
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
    <div className="space-y-4 rounded-lg border border-border/80 bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">Classificação (Controladoria)</h3>
      <div className="space-y-2">
        <Label htmlFor="escritorio">Escritório responsável</Label>
        <Input
          id="escritorio"
          value={escritorio}
          onChange={(e) => setEscritorio(e.target.value)}
          placeholder="CÍVEL | INSOLVÊNCIA"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="grupo">Grupo</Label>
        <Input id="grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pasta">Pasta</Label>
        <Input
          id="pasta"
          value={pasta}
          onChange={(e) => setPasta(e.target.value)}
          placeholder="PROCESSO PRINCIPAL - CI 12345"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ci">CI</Label>
        <Input id="ci" value={ci} onChange={(e) => setCi(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#347796]"
          checked={risco}
          onChange={(e) => setRisco(e.target.checked)}
        />
        Demanda de risco
      </label>
      <Button type="button" disabled={saving} onClick={save}>
        {saving ? "Salvando…" : "Salvar e liberar para jurídico"}
      </Button>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}
