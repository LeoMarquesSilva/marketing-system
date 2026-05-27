"use client";

import { useMemo, useState } from "react";
import { Plus, Tag, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WHATSAPP_TAG_PRESETS, normalizeWhatsappTags } from "@/lib/evolution-tags";
import { cn } from "@/lib/utils";

const TAG_COLORS = [
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-sky-100 text-sky-800 border-sky-200",
  "bg-violet-100 text-violet-800 border-violet-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-slate-100 text-slate-800 border-slate-200",
];

function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) hash = (hash + tag.charCodeAt(i) * (i + 1)) % TAG_COLORS.length;
  return TAG_COLORS[hash];
}

interface WhatsappConversationTagsProps {
  tags: string[];
  suggestions: string[];
  saving?: boolean;
  compact?: boolean;
  onChange: (tags: string[]) => void;
}

export function WhatsappConversationTags({
  tags,
  suggestions,
  saving = false,
  compact = false,
  onChange,
}: WhatsappConversationTagsProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const availablePresets = useMemo(() => {
    const current = new Set(tags.map((t) => t.toLowerCase()));
    const merged = [...WHATSAPP_TAG_PRESETS, ...suggestions];
    const seen = new Set<string>();
    return merged.filter((tag) => {
      const key = tag.toLowerCase();
      if (current.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [tags, suggestions]);

  function addTag(raw: string) {
    const next = normalizeWhatsappTags([...tags, raw]);
    if (next.length === tags.length) return;
    onChange(next);
    setDraft("");
    if (compact) setOpen(false);
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
  }

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {tags.length === 0 && (
          <span className="text-xs text-muted-foreground">Sem tags</span>
        )}
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className={cn("rounded-full gap-1 pr-1", tagColor(tag))}
          >
            {tag}
            <button
              type="button"
              disabled={saving}
              onClick={() => removeTag(tag)}
              className="rounded-full p-0.5 hover:bg-black/5 disabled:opacity-50"
              aria-label={`Remover tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {!compact && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-full px-2 text-xs gap-1"
            disabled={saving}
            onClick={() => setOpen((v) => !v)}
          >
            <Plus className="h-3 w-3" />
            Tag
          </Button>
        )}
        {compact && (
          <button
            type="button"
            disabled={saving}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-6 items-center rounded-full border px-2 text-[10px] text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
          >
            + tag
          </button>
        )}
      </div>

      {open && (
        <div className="rounded-xl border bg-background p-3 space-y-2 shadow-sm">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) addTag(draft);
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Nova tag…"
              className="h-8 text-sm"
              disabled={saving}
            />
            <Button type="submit" size="sm" disabled={saving || !draft.trim()}>
              Adicionar
            </Button>
          </form>
          {availablePresets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {availablePresets.slice(0, 12).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  disabled={saving}
                  onClick={() => addTag(tag)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] hover:opacity-80 disabled:opacity-50",
                    tagColor(tag)
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WhatsappTagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.slice(0, 3).map((tag) => (
        <span
          key={tag}
          className={cn(
            "rounded-full border px-1.5 py-0 text-[10px] leading-5",
            tagColor(tag)
          )}
        >
          {tag}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>
      )}
    </div>
  );
}
