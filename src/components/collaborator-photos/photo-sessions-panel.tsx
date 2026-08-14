"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";
import {
  createGalleryPhotoSession,
  fetchPhotoSessions,
} from "@/lib/collaborator-photos/api";
import type { PhotoSession } from "@/lib/collaborator-photos/types";

export function PhotoSessionsPanel() {
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const next = await fetchPhotoSessions(true);
    setSessions(next);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchPhotoSessions(true);
        if (!cancelled) setSessions(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar sessões.");
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
      const yearMatch = label.match(/(20\d{2})/);
      await createGalleryPhotoSession(label, yearMatch ? Number(yearMatch[1]) : null);
      setLabel("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar sessão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#dce9eb] bg-white p-4 shadow-[0_1px_2px_rgba(3,32,47,0.05)]">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#04202f]">Sessões de fotos</h3>
          <p className="text-xs text-muted-foreground">
            Marque cada upload com a sessão certa (ex.: Fotos Corporativas 2026) para filtrar e
            baixar depois.
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
            placeholder="Nova sessão, ex. Evento Advogados 2026"
            className="h-9 w-72 text-sm"
          />
          <Button type="submit" size="sm" className="h-9 gap-1.5" disabled={saving || !label.trim()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Adicionar
          </Button>
        </form>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando sessões…</p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="rounded-full border border-[#dce9eb] bg-[#f4fbfb] px-3 py-1 text-xs font-medium text-[#04202f]"
            >
              {session.label}
              {!session.isActive && (
                <span className="ml-1 text-muted-foreground">(inativa)</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
