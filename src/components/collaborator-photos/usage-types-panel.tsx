"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";
import {
  createGalleryUsageType,
  deleteGalleryUsageType,
  fetchUsageTypes,
  patchGalleryUsageType,
} from "@/lib/collaborator-photos/api";
import type { PhotoUsageType } from "@/lib/collaborator-photos/types";

export function PhotoUsageTypesPanel() {
  const [types, setTypes] = useState<PhotoUsageType[]>([]);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const next = await fetchUsageTypes(true);
    setTypes(next);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchUsageTypes(true);
        if (!cancelled) setTypes(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar usos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      await createGalleryUsageType(label);
      setLabel("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar uso.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(type: PhotoUsageType) {
    setError(null);
    try {
      await patchGalleryUsageType(type.id, { isActive: !type.isActive });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar uso.");
    }
  }

  async function handleDelete(type: PhotoUsageType) {
    if (!confirm(`Apagar o uso “${type.label}”?`)) return;
    setError(null);
    try {
      await deleteGalleryUsageType(type.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao apagar uso.");
    }
  }

  return (
    <section className="rounded-2xl border border-[#dce9eb] bg-white p-4 shadow-[0_1px_2px_rgba(3,32,47,0.05)]">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#04202f]">Usos das fotos</h3>
          <p className="text-xs text-muted-foreground">
            O uso “Foto dos sistemas do escritório” é fixo. Os demais aparecem como chips em Minhas
            fotos.
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
        >
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Novo uso, ex. Campanhas"
            className="h-9 w-56 text-sm"
          />
          <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={saving || !label.trim()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Adicionar
          </Button>
        </form>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando usos…</p>
      ) : (
        <ul className="mt-4 divide-y divide-[#dce9eb]">
          {types.map((type) => (
            <li key={type.id} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-[#04202f]">
                  {type.label}
                  {type.isOfficial && (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[#1a6b72]">
                      sistema
                    </span>
                  )}
                  {!type.isActive && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                      inativo
                    </span>
                  )}
                </p>
              </div>
              {!type.isOfficial && !type.isSystem && (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleToggleActive(type)}>
                    {type.isActive ? "Desativar" : "Ativar"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void handleDelete(type)}>
                    Apagar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
