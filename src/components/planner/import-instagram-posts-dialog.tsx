"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { InstagramPostThumbnail } from "@/components/instagram/instagram-post-thumbnail";
import type { InstagramPost } from "@/lib/instagram-posts";
import { captionToPostTitle } from "@/lib/planner-posts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Download, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type ImportableInstagramPost = InstagramPost & { already_imported?: boolean };

interface ImportInstagramPostsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportInstagramPostsDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportInstagramPostsDialogProps) {
  const [dateFrom, setDateFrom] = useState(() =>
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [posts, setPosts] = useState<ImportableInstagramPost[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResultMessage(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", `${dateFrom}T00:00:00.000Z`);
      if (dateTo) params.set("to", `${dateTo}T23:59:59.999Z`);
      const res = await fetch(`/api/planner/import-instagram-posts?${params}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar posts.");
      setPosts(data.posts ?? []);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar posts.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (open) void loadPosts();
  }, [open, loadPosts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) => {
      const title = captionToPostTitle(post.caption).toLowerCase();
      const caption = (post.caption ?? "").toLowerCase();
      const area = (post.area ?? post.areas?.join(" ") ?? "").toLowerCase();
      return title.includes(q) || caption.includes(q) || area.includes(q);
    });
  }, [posts, search]);

  const importable = useMemo(
    () => filtered.filter((post) => !post.already_imported),
    [filtered]
  );

  const toggleSelect = (igMediaId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(igMediaId)) next.delete(igMediaId);
      else next.add(igMediaId);
      return next;
    });
  };

  const selectAllImportable = () => {
    setSelected(new Set(importable.map((post) => post.ig_media_id)));
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    setError(null);
    setResultMessage(null);
    try {
      const res = await fetch("/api/planner/import-instagram-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ig_media_ids: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao importar posts.");

      const parts = [`${data.imported} importado(s)`];
      if (data.skipped) parts.push(`${data.skipped} ignorado(s)`);
      setResultMessage(parts.join(", ") + ".");
      if (data.errors?.length) {
        setError(data.errors.slice(0, 3).join(" "));
      }
      await loadPosts();
      if (data.imported > 0) onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar posts.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar posts do Instagram</DialogTitle>
          <DialogDescription>
            Selecione posts já publicados (sincronizados da API) para adicionar ao calendário do Planner.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 py-1">
          <DatePickerField
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="De"
            className="w-[130px] h-9"
          />
          <DatePickerField
            value={dateTo}
            onChange={setDateTo}
            placeholder="Até"
            className="w-[130px] h-9"
          />
          <Button variant="outline" size="sm" onClick={() => void loadPosts()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Atualizar"}
          </Button>
          <div className="relative flex-1 min-w-[180px]">
            <Search
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar legenda ou área..."
              className="pl-8 h-9"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {resultMessage && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
            {resultMessage}
          </p>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden />
              Carregando posts...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">
              Nenhum post encontrado no período.
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((post) => {
                const isImported = Boolean(post.already_imported);
                const isSelected = selected.has(post.ig_media_id);
                const title = captionToPostTitle(post.caption);
                const publishedLabel = post.published_at
                  ? format(new Date(post.published_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : "Sem data";

                return (
                  <li key={post.ig_media_id}>
                    <button
                      type="button"
                      disabled={isImported}
                      onClick={() => !isImported && toggleSelect(post.ig_media_id)}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 text-left transition-colors",
                        isImported
                          ? "opacity-60 cursor-not-allowed bg-muted/20"
                          : "hover:bg-muted/40",
                        isSelected && !isImported && "bg-primary/5"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-1 h-4 w-4 shrink-0 rounded border flex items-center justify-center",
                          isImported
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/40"
                        )}
                        aria-hidden
                      >
                        {(isImported || isSelected) && <CheckCircle2 className="h-3 w-3" />}
                      </div>
                      <InstagramPostThumbnail post={post} size="list" showBadge={false} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium line-clamp-2">{title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {publishedLabel}
                          {(post.area || post.areas?.length) && (
                            <> · {post.area ?? post.areas?.join(", ")}</>
                          )}
                        </p>
                        {isImported && (
                          <span className="inline-flex mt-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                            Já no Planner
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={selectAllImportable}
            disabled={loading || importable.length === 0}
            className="sm:mr-auto"
          >
            Selecionar todos ({importable.length})
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button
              onClick={() => void handleImport()}
              disabled={importing || selected.size === 0}
              className="inline-flex items-center gap-1.5"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Download className="h-4 w-4" aria-hidden />
              )}
              Importar {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
