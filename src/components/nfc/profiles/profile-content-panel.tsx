"use client";

import { useState } from "react";
import { Eye, EyeOff, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProfileContentItem, ProfileContentSourceType } from "@/lib/profiles/types";

const SOURCE_LABELS: Record<ProfileContentSourceType, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  reel_studio: "Reel Studio",
};

function formatPublishedAt(value: string | null): string {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function ProfileContentPanel({
  profileId,
  initialItems,
  initialHiddenKeys,
}: {
  profileId: string;
  initialItems: ProfileContentItem[];
  initialHiddenKeys: string[];
}) {
  const [items] = useState(initialItems);
  const [hiddenKeys, setHiddenKeys] = useState(() => new Set(initialHiddenKeys));
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = items.filter((item) => !hiddenKeys.has(item.key));
  const hidden = items.filter((item) => hiddenKeys.has(item.key));

  async function setHidden(item: ProfileContentItem, hidden: boolean) {
    setBusyKey(item.key);
    setError(null);
    try {
      const response = await fetch(`/api/nfc/profiles/${profileId}/content-overrides`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          hidden,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível atualizar a visibilidade.");
      }
      setHiddenKeys((current) => {
        const next = new Set(current);
        if (hidden) next.add(item.key);
        else next.delete(item.key);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar conteúdo.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-[#dce9eb] bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Conteúdo recente</h3>
        <p className="text-xs text-muted-foreground">
          Associado automaticamente às publicações do colaborador. Ocultar só muda a
          página pública — a publicação original permanece intacta.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum conteúdo recente encontrado para este colaborador.
        </p>
      ) : (
        <div className="space-y-4">
          <ContentGroup
            title="Visíveis na página pública"
            emptyLabel="Nenhum item visível no momento."
            items={visible}
            busyKey={busyKey}
            hidden={false}
            onToggle={setHidden}
          />
          <ContentGroup
            title="Ocultos"
            emptyLabel="Nenhum item oculto."
            items={hidden}
            busyKey={busyKey}
            hidden
            onToggle={setHidden}
          />
        </div>
      )}
    </section>
  );
}

function ContentGroup({
  title,
  emptyLabel,
  items,
  busyKey,
  hidden,
  onToggle,
}: {
  title: string;
  emptyLabel: string;
  items: ProfileContentItem[];
  busyKey: string | null;
  hidden: boolean;
  onToggle: (item: ProfileContentItem, hidden: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        <span className="ml-1 font-normal normal-case">({items.length})</span>
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex gap-3 rounded-md border border-[#eef5f6] bg-[#f8fbfc] p-3"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-[#dce9eb]">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                    Sem imagem
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#285f7a] ring-1 ring-inset ring-[#dce9eb]">
                    {SOURCE_LABELS[item.sourceType]}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatPublishedAt(item.publishedAt)}
                  </span>
                  {hidden && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                      Oculto
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-foreground">{item.title}</p>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-[#285f7a] underline underline-offset-2"
                  >
                    Abrir original
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 shrink-0 self-start border-[#dce9eb]"
                disabled={busyKey === item.key}
                onClick={() => onToggle(item, !hidden)}
                aria-label={hidden ? `Restaurar ${item.title}` : `Ocultar ${item.title}`}
              >
                {busyKey === item.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : hidden ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
                {hidden ? "Restaurar" : "Ocultar"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
