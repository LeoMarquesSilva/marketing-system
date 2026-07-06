"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, ListChecks, Copy, Check, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  toggleChecklistItem,
  updateChecklistItemContent,
  promoteReelToContentBankIfReady,
  getReelChecklistFieldConfig,
  reelChecklistItemRequiresContent,
  type ChecklistItem,
} from "@/lib/request-checklist";
import { uploadReelCoverImage } from "@/lib/storage-buckets";

interface RequestChecklistSectionProps {
  requestId?: string;
  items: ChecklistItem[];
  onItemsChange: (items: ChecklistItem[]) => void;
  userId: string | null;
  sectionClass: string;
  sectionTitleClass: string;
  onRefresh?: () => void;
}

export function RequestChecklistSection({
  requestId,
  items,
  onItemsChange,
  userId,
  sectionClass,
  sectionTitleClass,
  onRefresh,
}: RequestChecklistSectionProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [contentErrorId, setContentErrorId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadErrorId, setUploadErrorId] = useState<string | null>(null);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (getReelChecklistFieldConfig(item.label)) {
          next[item.id] = item.content ?? "";
        }
      }
      return next;
    });
  }, [items]);

  const tryPromoteReel = useCallback(
    async (nextItems: ChecklistItem[]) => {
      if (!requestId) return;
      const allComplete = nextItems.every((i) => i.completed_at);
      const allContent = nextItems.every((i) => {
        if (!i.completed_at) return false;
        if (!reelChecklistItemRequiresContent(i.label)) return true;
        return Boolean((i.content ?? drafts[i.id] ?? "").trim());
      });
      if (!allComplete || !allContent) return;

      const { promoted, error: promoteError } = await promoteReelToContentBankIfReady(
        requestId,
        nextItems
      );
      if (promoteError) return;
      if (promoted) onRefresh?.();
    },
    [requestId, drafts, onRefresh]
  );

  const handleToggle = async (item: ChecklistItem) => {
    const nextCompleted = !item.completed_at;
    const draft = (drafts[item.id] ?? item.content ?? "").trim();

    if (nextCompleted && reelChecklistItemRequiresContent(item.label) && !draft) {
      setContentErrorId(item.id);
      return;
    }

    setContentErrorId(null);
    setTogglingId(item.id);

    if (nextCompleted && draft && draft !== (item.content ?? "")) {
      const { error: saveError } = await updateChecklistItemContent(item.id, draft);
      if (saveError) {
        setTogglingId(null);
        return;
      }
    }

    const { error } = await toggleChecklistItem(item.id, nextCompleted, userId);
    setTogglingId(null);
    if (error) return;

    const nextItems = items.map((i) =>
      i.id === item.id
        ? {
            ...i,
            content: draft || i.content,
            completed_at: nextCompleted ? new Date().toISOString() : null,
            completed_by_id: nextCompleted ? userId : null,
          }
        : i
    );
    onItemsChange(nextItems);
    void tryPromoteReel(nextItems);
  };

  const handleSaveContent = async (item: ChecklistItem) => {
    const value = (drafts[item.id] ?? "").trim();
    setSavingId(item.id);
    const { error } = await updateChecklistItemContent(item.id, value);
    setSavingId(null);
    if (error) return;

    const nextItems = items.map((i) => (i.id === item.id ? { ...i, content: value || null } : i));
    onItemsChange(nextItems);
    void tryPromoteReel(nextItems);
  };

  const handleCopy = async (item: ChecklistItem) => {
    const text = drafts[item.id] ?? item.content ?? "";
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleMediaUpload = async (item: ChecklistItem, file: File | null) => {
    if (!file || !requestId) return;
    setUploadErrorId(null);
    setUploadingId(item.id);
    try {
      const { publicUrl } = await uploadReelCoverImage(requestId, file);
      setDrafts((prev) => ({ ...prev, [item.id]: publicUrl }));
      setSavingId(item.id);
      const { error } = await updateChecklistItemContent(item.id, publicUrl);
      setSavingId(null);
      if (error) {
        setUploadErrorId(item.id);
        return;
      }
      const nextItems = items.map((i) =>
        i.id === item.id ? { ...i, content: publicUrl } : i
      );
      onItemsChange(nextItems);
      void tryPromoteReel(nextItems);
    } catch {
      setUploadErrorId(item.id);
    } finally {
      setUploadingId(null);
    }
  };

  if (items.length === 0) return null;

  const completedCount = items.filter((i) => i.completed_at).length;
  const total = items.length;
  const allDone = completedCount === total;

  return (
    <section aria-labelledby="checklist-heading" className={sectionClass}>
      <div className="flex items-center justify-between gap-2">
        <h4 id="checklist-heading" className={`${sectionTitleClass} flex items-center gap-2`}>
          <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
          Checklist
        </h4>
        <span
          className={cn(
            "text-xs font-medium rounded-full px-2 py-0.5",
            allDone
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {completedCount}/{total}
        </span>
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const done = !!item.completed_at;
          const busy = togglingId === item.id;
          const fieldConfig = getReelChecklistFieldConfig(item.label);
          const draft = drafts[item.id] ?? item.content ?? "";
          const showContentError = contentErrorId === item.id;

          return (
            <li key={item.id} className="space-y-2">
              <div
                className={cn(
                  "rounded-xl border transition-colors",
                  done
                    ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30"
                    : "bg-white/50 dark:bg-background/40 border-white/30 dark:border-border/30"
                )}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  disabled={busy}
                  className={cn(
                    "w-full flex items-start gap-2.5 px-3 py-2.5 text-left text-sm",
                    !done && "hover:bg-muted/40 rounded-xl",
                    busy && "opacity-60"
                  )}
                >
                  {done ? (
                    <CheckCircle2
                      className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5"
                      aria-hidden
                    />
                  ) : (
                    <Circle
                      className="h-4 w-4 shrink-0 text-muted-foreground/60 mt-0.5"
                      aria-hidden
                    />
                  )}
                  <span className={cn("font-medium", done && "line-through opacity-80")}>
                    {item.label}
                  </span>
                </button>

                {fieldConfig && (
                  <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2 mx-0">
                    {fieldConfig.contentType === "media" ? (
                      <div className="space-y-3">
                        {draft.trim() ? (
                          <a
                            href={draft}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-lg border border-border/40 overflow-hidden bg-muted/20"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={draft}
                              alt="Capa do reel"
                              className="w-full max-h-48 object-contain bg-black/5"
                            />
                          </a>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            Nenhuma capa enviada ainda.
                          </p>
                        )}
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" aria-hidden />
                            {uploadingId === item.id ? "Enviando capa…" : "Arquivo da capa"}
                          </span>
                          <Input
                            type="file"
                            accept={fieldConfig.accept}
                            disabled={uploadingId === item.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              void handleMediaUpload(item, file);
                              e.target.value = "";
                            }}
                            className="text-sm h-9"
                          />
                        </label>
                        {uploadingId === item.id && (
                          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                            Enviando…
                          </p>
                        )}
                        {uploadErrorId === item.id && (
                          <p className="text-xs text-destructive" role="alert">
                            Erro ao enviar a capa. Tente novamente.
                          </p>
                        )}
                      </div>
                    ) : fieldConfig.contentType === "url" ? (
                      <Input
                        type="url"
                        value={draft}
                        placeholder={fieldConfig.placeholder}
                        onChange={(e) => {
                          setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }));
                          if (contentErrorId === item.id) setContentErrorId(null);
                        }}
                        onBlur={() => void handleSaveContent(item)}
                        className="text-sm h-9"
                      />
                    ) : (
                      <textarea
                        value={draft}
                        rows={4}
                        placeholder={fieldConfig.placeholder}
                        onChange={(e) => {
                          setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }));
                          if (contentErrorId === item.id) setContentErrorId(null);
                        }}
                        onBlur={() => void handleSaveContent(item)}
                        className="flex w-full resize-y min-h-[88px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    )}
                    {fieldConfig.contentType !== "media" && (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        {savingId === item.id ? "Salvando…" : "Salva ao sair do campo"}
                      </p>
                      <div className="flex gap-1">
                        {draft.trim() && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => void handleCopy(item)}
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="h-3 w-3 mr-1" aria-hidden />
                                Copiado
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 mr-1" aria-hidden />
                                Copiar
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={savingId === item.id}
                          onClick={() => void handleSaveContent(item)}
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                    )}
                    {showContentError && (
                      <p className="text-xs text-destructive" role="alert">
                        Preencha o conteúdo antes de marcar como concluído.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
