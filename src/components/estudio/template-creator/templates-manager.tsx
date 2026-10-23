"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PIECE_KIND_LABEL, type StudioTemplateDef } from "@/lib/estudio/types";
import { ScaledBox, SlideArtboard, slideSize } from "../slide-artboard";
import { newSlide } from "@/lib/estudio/domain";

/** Modelos da coleção criados na tela: miniatura com o exemplo, ativar/desativar e excluir. */
export function TemplatesManager({ templates, onChanged }: { templates: StudioTemplateDef[]; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, run: () => Promise<Response>) {
    setBusy(id);
    setError(null);
    try {
      const res = await run();
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Não foi possível mudar o modelo.");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível mudar o modelo.");
    } finally {
      setBusy(null);
    }
  }

  if (templates.length === 0) return <p className="text-sm text-muted-foreground">Nenhum modelo criado na tela nesta coleção.</p>;

  return (
    <div className="space-y-2">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {templates.map((t) => {
          const slide = newSlide(t);
          const size = slideSize(slide);
          return (
            <li key={t.id} className={cn("border border-black/[0.1] bg-white", t.inativo && "opacity-60")}>
              <ScaledBox artWidth={size.width} artHeight={size.height}>
                <SlideArtboard slide={slide} indice={0} total={1} tipo={t.usoEm[0] ?? "feed"} />
              </ScaledBox>
              <div className="space-y-1 p-2.5">
                <p className="truncate text-sm font-medium">{t.nome}</p>
                <p className="text-[11px] text-muted-foreground">{t.usoEm.map((u) => PIECE_KIND_LABEL[u]).join(" · ")}</p>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={!t.inativo}
                      disabled={busy === t.id}
                      onChange={(e) =>
                        void act(t.id, () =>
                          fetch(`/api/estudio/modelos/${t.id}`, {
                            method: "PATCH",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ ativo: e.target.checked }),
                          })
                        )
                      }
                      className="h-3.5 w-3.5 accent-[#04202f]"
                    />
                    Ativo
                  </label>
                  <button
                    type="button"
                    disabled={busy === t.id}
                    onClick={() => {
                      if (window.confirm(`Excluir o modelo "${t.nome}"? Só dá para excluir modelo que nenhuma peça usa.`)) {
                        void act(t.id, () => fetch(`/api/estudio/modelos/${t.id}`, { method: "DELETE", credentials: "include" }));
                      }
                    }}
                    className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
                    aria-label={`Excluir ${t.nome}`}
                  >
                    {busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
