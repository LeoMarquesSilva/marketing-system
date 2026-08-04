"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileSignature,
  HelpCircle,
  Loader2,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  Unlock,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getAllowedLegalAreas,
  getAreaDotColor,
  LEGAL_AREAS,
  type LegalArea,
} from "@/lib/content-areas";
import { getRoteiroDate } from "@/lib/content-utils";
import type {
  Newsletter,
  NewsletterItem,
  NewsletterWithItems,
} from "@/lib/content-newsletter";
import {
  NewsletterTour,
  startNewsletterTour,
} from "@/components/conteudo/newsletter-tour";

const DEFAULT_AREA: LegalArea = "Reestruturação (Insolvência)";

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  assinado: "Assinado",
};

const STATUS_STYLES: Record<string, string> = {
  rascunho: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  em_revisao: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  assinado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
};

interface NewsOption {
  id: string;
  title: string;
  link: string | null;
  content_snippet: string | null;
  image_url?: string | null;
  area: string;
  published_at: string | null;
  created_at: string;
  boletim_score?: number | null;
  boletim_scored_by_name?: string | null;
  boletim_scored_at?: string | null;
}

function sortNewsForBoletim(items: NewsOption[]): NewsOption[] {
  return [...items].sort((a, b) => {
    const scoreA = a.boletim_score ?? -1;
    const scoreB = b.boletim_score ?? -1;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return getRoteiroDate(b).getTime() - getRoteiroDate(a).getTime();
  });
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Erro na requisição.");
  }
  return data as T;
}

export function BoletimClient() {
  return (
    <Suspense fallback={null}>
      <BoletimClientInner />
    </Suspense>
  );
}

function BoletimClientInner() {
  const { profile, loading: authLoading } = useAuth();
  const allowedAreas = useMemo(() => getAllowedLegalAreas(profile), [profile]);

  const availableAreas = useMemo<LegalArea[]>(
    () => (allowedAreas === null ? [...LEGAL_AREAS] : allowedAreas),
    [allowedAreas]
  );
  const defaultArea = useMemo<LegalArea>(
    () =>
      availableAreas.includes(DEFAULT_AREA) ? DEFAULT_AREA : (availableAreas[0] ?? DEFAULT_AREA),
    [availableAreas]
  );

  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tourKey, setTourKey] = useState(0);

  const [newTitle, setNewTitle] = useState("");
  const [newEdition, setNewEdition] = useState("");
  const [newArea, setNewArea] = useState<LegalArea>(defaultArea);
  const [showNewForm, setShowNewForm] = useState(false);

  const restartTour = () => {
    startNewsletterTour();
    setTourKey((k) => k + 1);
  };

  useEffect(() => setNewArea(defaultArea), [defaultArea]);

  const loadNewsletters = useCallback(async () => {
    setLoading(true);
    try {
      setNewsletters(await api<Newsletter[]>("/api/content-newsletters"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar boletins.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) void loadNewsletters();
  }, [authLoading, loadNewsletters]);

  const createNewsletter = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api<Newsletter>("/api/content-newsletters", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          edition_label: newEdition || null,
          area: newArea,
        }),
      });
      setNewTitle("");
      setNewEdition("");
      setShowNewForm(false);
      await loadNewsletters();
      setOpenId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar edição.");
    } finally {
      setCreating(false);
    }
  };

  if (openId) {
    return (
      <>
        <NewsletterEditor
          newsletterId={openId}
          onBack={() => {
            setOpenId(null);
            void loadNewsletters();
          }}
          onRestartTour={restartTour}
        />
        <NewsletterTour key={`editor-${tourKey}`} editionOpen />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <div
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        data-tour="nl-list-header"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Newsletter</h1>
          <p className="text-sm text-muted-foreground">
            Monte a newsletter informativa da sua área a partir das notícias já coletadas,
            revise o texto e assine a edição.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={restartTour}>
            <HelpCircle className="mr-2 h-4 w-4" />
            Ver guia
          </Button>
          <Button data-tour="nl-new-edition" onClick={() => setShowNewForm((v) => !v)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova edição
          </Button>
        </div>
      </div>
      <NewsletterTour key={`list-${tourKey}`} editionOpen={false} />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {showNewForm && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Título da edição
                </label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Newsletter de Reestruturação e Insolvência"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Edição (opcional)
                </label>
                <Input
                  value={newEdition}
                  onChange={(e) => setNewEdition(e.target.value)}
                  placeholder="1ª Edição | 2026"
                />
              </div>
            </div>
            {availableAreas.length > 1 && (
              <div className="space-y-1.5 sm:max-w-xs">
                <label className="text-xs font-medium text-muted-foreground">Área</label>
                <Select value={newArea} onValueChange={(v) => setNewArea(v as LegalArea)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAreas.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={createNewsletter} disabled={creating || !newTitle.trim()}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar edição
              </Button>
              <Button variant="ghost" onClick={() => setShowNewForm(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : newsletters.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-muted/10 py-20 text-center">
          <div className="rounded-full bg-muted/60 p-5">
            <Newspaper className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <div className="max-w-sm space-y-1 px-4">
            <p className="font-medium">Nenhuma edição ainda</p>
            <p className="text-sm text-muted-foreground">
              Crie a primeira edição e escolha as notícias que vão compor a newsletter.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {newsletters.map((n) => (
            <button
              key={n.id}
              onClick={() => setOpenId(n.id)}
              className="flex w-full items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/30 hover:bg-muted/30"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{n.title}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("h-1.5 w-1.5 rounded-full", getAreaDotColor(n.area))} />
                    {n.area}
                  </span>
                  {n.edition_label && <span>· {n.edition_label}</span>}
                  <span>
                    · Criada em {format(new Date(n.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </p>
              </div>
              <StatusBadge status={n.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status] ?? STATUS_STYLES.rascunho
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1">{message}</p>
      <button onClick={onDismiss} className="text-xs underline">
        fechar
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor de uma edição
// ---------------------------------------------------------------------------

function NewsletterEditor({
  newsletterId,
  onBack,
  onRestartTour,
}: {
  newsletterId: string;
  onBack: () => void;
  onRestartTour?: () => void;
}) {
  const [newsletter, setNewsletter] = useState<NewsletterWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [news, setNews] = useState<NewsOption[]>([]);
  const [selectedNews, setSelectedNews] = useState<string[]>([]);
  const [manualUrl, setManualUrl] = useState("");
  const [newsSearch, setNewsSearch] = useState("");
  const [previewNews, setPreviewNews] = useState<NewsOption | null>(null);

  const locked = newsletter?.status === "assinado";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setNewsletter(
        await api<NewsletterWithItems>(`/api/content-newsletters/${newsletterId}`)
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar a edição.");
    } finally {
      setLoading(false);
    }
  }, [newsletterId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Notícias candidatas: as já coletadas pela IA na área desta edição.
  const area = newsletter?.area;
  useEffect(() => {
    if (!area) return;
    void (async () => {
      try {
        const data = await api<NewsOption[]>(
          `/api/content-roteiros?area=${encodeURIComponent(area)}`
        );
        setNews(sortNewsForBoletim(data));
      } catch {
        // Sem candidatas, o usuário ainda pode colar links avulsos.
      }
    })();
  }, [area]);

  const setNewsScore = async (id: string, score: number | null) => {
    const result = await api<{
      boletim_score: number | null;
      boletim_scored_by_name: string | null;
      boletim_scored_at: string | null;
    }>("/api/content-roteiros", {
      method: "PATCH",
      body: JSON.stringify({ id, action: "boletim_score", score }),
    });
    setNews((prev) =>
      sortNewsForBoletim(
        prev.map((n) => (n.id === id ? { ...n, ...result } : n))
      )
    );
    setPreviewNews((prev) => (prev?.id === id ? { ...prev, ...result } : prev));
  };

  const usedRoteiroIds = useMemo(
    () =>
      new Set((newsletter?.items ?? []).map((i) => i.roteiro_id).filter(Boolean) as string[]),
    [newsletter?.items]
  );

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setBusy(null);
    }
  };

  const patchNewsletter = (payload: Record<string, unknown>) =>
    run("newsletter", async () => {
      setNewsletter(
        await api<NewsletterWithItems>(`/api/content-newsletters/${newsletterId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      );
    });

  const addRoteiros = (roteiroIds: string[]) =>
    run("add", async () => {
      const result = await api<{
        created: NewsletterItem[];
        errors: { title: string; message: string }[];
      }>(`/api/content-newsletters/${newsletterId}/items`, {
        method: "POST",
        body: JSON.stringify({ roteiro_ids: roteiroIds }),
      });
      setSelectedNews((prev) => prev.filter((id) => !roteiroIds.includes(id)));
      setPreviewNews(null);
      await load();
      if (result.errors.length > 0) {
        setError(
          result.errors.map((e) => `"${e.title}": ${e.message}`).join(" · ")
        );
      } else {
        setNotice(
          result.created.length === 1
            ? "Notícia adicionada. A IA redigiu a seção."
            : `${result.created.length} seções adicionadas e redigidas.`
        );
      }
    });

  const addSelectedNews = () => addRoteiros(selectedNews);

  const toggleSelected = (id: string) => {
    setSelectedNews((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const addManualLink = () =>
    run("manual", async () => {
      await api(`/api/content-newsletters/${newsletterId}/items`, {
        method: "POST",
        body: JSON.stringify({ url: manualUrl }),
      });
      setManualUrl("");
      await load();
    });

  const moveItem = (index: number, delta: number) => {
    if (!newsletter) return;
    const ids = newsletter.items.map((i) => i.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run("reorder", async () => {
      setNewsletter(
        await api<NewsletterWithItems>(
          `/api/content-newsletters/${newsletterId}/items`,
          { method: "PATCH", body: JSON.stringify({ ordered_ids: ids }) }
        )
      );
    });
  };

  const candidates = useMemo(
    () => news.filter((n) => !usedRoteiroIds.has(n.id)),
    [news, usedRoteiroIds]
  );
  const filteredCandidates = useMemo(() => {
    const q = newsSearch.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.content_snippet ?? "").toLowerCase().includes(q)
    );
  }, [candidates, newsSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!newsletter) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 pb-8">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Button variant="ghost" size="sm" className="-ml-3" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Todas as edições
          </Button>
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {newsletter.title}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className={cn("h-1.5 w-1.5 rounded-full", getAreaDotColor(newsletter.area))}
              />
              {newsletter.area}
            </span>
            {newsletter.edition_label && <span>· {newsletter.edition_label}</span>}
            <span>· {newsletter.items.length} notícia(s)</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-tour="nl-actions">
          <StatusBadge status={newsletter.status} />
          {onRestartTour && (
            <Button variant="outline" size="sm" onClick={onRestartTour}>
              <HelpCircle className="mr-2 h-4 w-4" />
              Ver guia
            </Button>
          )}
          <Button variant="outline" asChild>
            <a href={`/api/content-newsletters/${newsletterId}/word`}>
              <Download className="mr-2 h-4 w-4" />
              Baixar Word
            </a>
          </Button>
          {locked ? (
            <Button
              variant="outline"
              onClick={() => patchNewsletter({ action: "reopen" })}
              disabled={busy !== null}
            >
              <Unlock className="mr-2 h-4 w-4" />
              Reabrir para edição
            </Button>
          ) : (
            <Button
              onClick={() => patchNewsletter({ action: "sign" })}
              disabled={busy !== null || newsletter.items.length === 0}
            >
              {busy === "newsletter" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSignature className="mr-2 h-4 w-4" />
              )}
              Assinar newsletter
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {notice}
          <button
            type="button"
            className="ml-3 text-xs underline"
            onClick={() => setNotice(null)}
          >
            fechar
          </button>
        </div>
      )}
      {locked && newsletter.signed_by_name && newsletter.signed_at && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Assinado por <strong>{newsletter.signed_by_name}</strong> em{" "}
          {format(new Date(newsletter.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.
          Reabra a edição para alterar qualquer texto.
        </div>
      )}

      {/* 1º passo: escolher as notícias — vem acima de abertura, textos e assinatura. */}
      <Card className="overflow-hidden border-primary/15" data-tour="nl-pick-news">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
                Passo 1
              </p>
              <h2 className="text-lg font-semibold tracking-tight">Escolher notícias</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Clique para ler e pontuar · use + para marcar várias e redigir em lote
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {candidates.length} disponíveis
              </span>
              {newsletter.items.length > 0 && (
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  {newsletter.items.length} já na edição
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {candidates.length > 0 && (
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={newsSearch}
                  onChange={(e) => setNewsSearch(e.target.value)}
                  placeholder="Buscar por título ou assunto…"
                  className="h-9 pl-8 text-sm"
                  disabled={locked}
                />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
              <Input
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="Ou cole um link avulso (https://…)"
                disabled={locked}
                className="h-9"
              />
              <Button
                variant="outline"
                className="shrink-0"
                onClick={addManualLink}
                disabled={locked || busy !== null || !manualUrl.trim()}
              >
                {busy === "manual" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Do link
              </Button>
            </div>
          </div>

          {candidates.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
              Nenhuma notícia disponível para incluir nesta área.
            </p>
          ) : filteredCandidates.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
              Nenhuma notícia corresponde à busca.
            </p>
          ) : (
            <div className="grid max-h-[min(520px,55vh)] gap-3 overflow-y-auto pr-0.5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCandidates.map((n, index) => {
                const checked = selectedNews.includes(n.id);
                return (
                  <NewsCandidateCard
                    key={n.id}
                    news={n}
                    checked={checked}
                    locked={locked}
                    onToggle={() => toggleSelected(n.id)}
                    onOpen={() => setPreviewNews(n)}
                    tourAnchor={index === 0}
                  />
                );
              })}
            </div>
          )}

          <div
            className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
            data-tour="nl-add-batch"
          >
            <p className="text-xs text-muted-foreground">
              {selectedNews.length === 0
                ? "Abra uma notícia para decidir, ou marque várias para redigir juntas."
                : `${selectedNews.length} notícia(s) marcada(s) para redigir.`}
            </p>
            <Button
              onClick={addSelectedNews}
              disabled={locked || busy !== null || selectedNews.length === 0}
            >
              {busy === "add" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {selectedNews.length === 0
                ? "Selecione notícias para redigir"
                : `Adicionar e redigir ${selectedNews.length}`}
            </Button>
          </div>
          {busy === "add" && (
            <p className="text-center text-xs text-muted-foreground">
              A IA está escrevendo. Isso pode levar alguns minutos.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2º passo: revisar textos já incluídos na edição. */}
      <div className="space-y-6" data-tour="nl-build">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Passo 2
          </p>
          <h2 className="text-lg font-semibold tracking-tight">Montar a newsletter</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Abertura, textos das seções e assinatura
          </p>
        </div>

        {/* A chave remonta o bloco quando a edição muda no servidor, para o
            rascunho local refletir o texto salvo sem efeito de sincronização. */}
        <IntroBlock
          key={`intro-${newsletter.updated_at}`}
          newsletter={newsletter}
          locked={locked}
          busy={busy}
          onSave={(intro_title, intro_body) =>
            patchNewsletter({ intro_title, intro_body })
          }
          onGenerate={() => patchNewsletter({ action: "generate_intro" })}
        />

        {newsletter.items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/10 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
              <Newspaper className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="font-medium">Nenhuma notícia nesta edição</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Escolha as notícias acima para a IA redigir as seções da newsletter.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {newsletter.items.map((item, index) => (
              <ItemEditor
                key={item.id}
                item={item}
                index={index}
                total={newsletter.items.length}
                newsletterId={newsletterId}
                locked={locked}
                onMove={moveItem}
                onChanged={load}
                onError={setError}
              />
            ))}
          </div>
        )}

        <SignatureBlock
          key={`signature-${newsletter.updated_at}`}
          newsletter={newsletter}
          locked={locked}
          busy={busy}
          onSave={(signature_names, collaborator_names) =>
            patchNewsletter({ signature_names, collaborator_names })
          }
        />
      </div>

      <NewsPreviewDialog
        news={previewNews}
        open={!!previewNews}
        locked={locked}
        busy={busy === "add"}
        selected={previewNews ? selectedNews.includes(previewNews.id) : false}
        onOpenChange={(open) => {
          if (!open) setPreviewNews(null);
        }}
        onToggleSelect={() => {
          if (previewNews) toggleSelected(previewNews.id);
        }}
        onAddNow={() => {
          if (previewNews) void addRoteiros([previewNews.id]);
        }}
        onScore={async (score) => {
          if (!previewNews) return;
          try {
            await setNewsScore(previewNews.id, score);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao salvar a nota.");
          }
        }}
      />
    </div>
  );
}

function ScoreStars({
  score,
  onChange,
  disabled,
  size = "md",
}: {
  score: number | null | undefined;
  onChange?: (score: number | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const current = score ?? 0;

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Nota da newsletter">
      {[1, 2, 3, 4, 5].map((value) => {
        const active = value <= current;
        return (
          <button
            key={value}
            type="button"
            disabled={disabled || !onChange}
            aria-label={`${value} estrela${value > 1 ? "s" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!onChange) return;
              // Clicar de novo na mesma nota limpa a avaliação.
              onChange(current === value ? null : value);
            }}
            className={cn(
              "rounded p-0.5 transition-colors",
              onChange && !disabled
                ? "hover:text-amber-500"
                : "cursor-default",
              active ? "text-amber-500" : "text-muted-foreground/35"
            )}
          >
            <Star className={cn(iconClass, active && "fill-current")} />
          </button>
        );
      })}
    </div>
  );
}

function NewsCandidateCard({
  news,
  checked,
  locked,
  onToggle,
  onOpen,
  tourAnchor,
}: {
  news: NewsOption;
  checked: boolean;
  locked: boolean;
  onToggle: () => void;
  onOpen: () => void;
  tourAnchor?: boolean;
}) {
  const dateLabel = format(getRoteiroDate(news), "dd MMM yyyy", { locale: ptBR });
  const snippet = (news.content_snippet ?? "").trim();

  return (
    <div
      data-tour={tourAnchor ? "nl-news-card" : undefined}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card transition-colors",
        checked
          ? "border-primary/45 bg-primary/[0.04] shadow-[inset_0_0_0_1px_rgba(var(--primary),0.08)]"
          : "hover:border-primary/25 hover:bg-muted/30",
        locked && "opacity-60"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full gap-3 p-3 pr-11 text-left"
      >
        <div className="relative h-24 w-[4.75rem] shrink-0 overflow-hidden rounded-lg bg-[#04202f]">
          {news.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={news.image_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Newspaper className="h-5 w-5 text-white/40" />
            </div>
          )}
        </div>
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="line-clamp-2 block text-sm font-medium leading-snug">
            {news.title}
          </span>
          {snippet ? (
            <span className="line-clamp-4 block text-xs leading-relaxed text-muted-foreground">
              {snippet}
            </span>
          ) : (
            <span className="block text-xs text-muted-foreground/70">
              Sem resumo — abra para ler o texto da matéria
            </span>
          )}
          <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{dateLabel}</span>
            {news.boletim_score ? (
              <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                <Star className="h-3 w-3 fill-current" />
                {news.boletim_score}/5
              </span>
            ) : null}
          </span>
        </span>
      </button>

      <div className="absolute right-2 top-2 flex items-center gap-1">
        <button
          type="button"
          aria-label={checked ? "Remover da seleção" : "Marcar para adicionar"}
          onClick={(e) => {
            e.stopPropagation();
            if (!locked) onToggle();
          }}
          disabled={locked}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border text-xs transition-colors",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background/90 text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          {checked ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function NewsPreviewDialog({
  news,
  open,
  locked,
  busy,
  selected,
  onOpenChange,
  onToggleSelect,
  onAddNow,
  onScore,
}: {
  news: NewsOption | null;
  open: boolean;
  locked: boolean;
  busy: boolean;
  selected: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleSelect: () => void;
  onAddNow: () => void;
  onScore: (score: number | null) => void | Promise<void>;
}) {
  return (
    <Dialog open={open && !!news} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {news && (
          <NewsPreviewBody
            key={news.id}
            news={news}
            locked={locked}
            busy={busy}
            selected={selected}
            onOpenChange={onOpenChange}
            onToggleSelect={onToggleSelect}
            onAddNow={onAddNow}
            onScore={onScore}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewsPreviewBody({
  news,
  locked,
  busy,
  selected,
  onOpenChange,
  onToggleSelect,
  onAddNow,
  onScore,
}: {
  news: NewsOption;
  locked: boolean;
  busy: boolean;
  selected: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleSelect: () => void;
  onAddNow: () => void;
  onScore: (score: number | null) => void | Promise<void>;
}) {
  const initialSnippet = (news.content_snippet ?? "").trim();
  const [excerpt, setExcerpt] = useState(initialSnippet);
  const [excerptSource, setExcerptSource] = useState<"article" | "snippet" | "empty" | null>(
    initialSnippet ? "snippet" : null
  );
  const [loadingExcerpt, setLoadingExcerpt] = useState(true);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void api<{
      excerpt: string;
      source: "article" | "snippet" | "empty";
    }>(`/api/content-roteiros/article-preview?id=${encodeURIComponent(news.id)}`)
      .then((data) => {
        if (cancelled) return;
        setExcerpt(data.excerpt);
        setExcerptSource(data.source);
      })
      .catch(() => {
        // Mantém o snippet inicial.
      })
      .finally(() => {
        if (!cancelled) setLoadingExcerpt(false);
      });

    return () => {
      cancelled = true;
    };
  }, [news.id]);

  const dateLabel = format(getRoteiroDate(news), "dd 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });

  return (
    <>
      <div className="relative h-40 shrink-0 overflow-hidden bg-[#04202f] sm:h-48">
        {news.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={news.image_url}
            alt=""
            className="h-full w-full object-cover opacity-80"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#04202f] via-[#04202f]/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 p-5 pr-12 sm:p-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
            <span className={cn("h-1.5 w-1.5 rounded-full", getAreaDotColor(news.area))} />
            {news.area}
          </span>
          <DialogTitle className="text-lg font-semibold leading-snug text-white sm:text-xl">
            {news.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-white/75">
            {dateLabel}
          </DialogDescription>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
        <div className="rounded-xl border bg-muted/20 px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Relevância para a newsletter
            </p>
            {news.boletim_scored_by_name && news.boletim_score ? (
              <p className="text-[11px] text-muted-foreground">
                Avaliada por {news.boletim_scored_by_name}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ScoreStars
              score={news.boletim_score}
              disabled={locked || scoring}
              onChange={(score) => {
                setScoring(true);
                void Promise.resolve(onScore(score)).finally(() => setScoring(false));
              }}
            />
            <p className="text-xs text-muted-foreground">
              {news.boletim_score
                ? `${news.boletim_score} de 5 · clique na mesma estrela para limpar`
                : "1 = pouco útil · 5 = deve entrar nesta edição"}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Resumo da notícia
            </p>
            {loadingExcerpt && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            {!loadingExcerpt && excerptSource === "article" && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                Texto da matéria
              </span>
            )}
            {!loadingExcerpt && excerptSource === "snippet" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Resumo do feed
              </span>
            )}
          </div>
          {excerpt ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {excerpt}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Não foi possível ler o texto desta matéria. Abra o link original para avaliar
              antes de incluir na newsletter.
            </p>
          )}
        </div>

        {news.link && (
          <a
            href={news.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir matéria original
          </a>
        )}
      </div>

      <DialogFooter className="shrink-0 gap-2 border-t px-5 py-4 sm:justify-between sm:px-6">
        <div className="flex flex-wrap gap-2">
          {!locked && (
            <Button variant="outline" size="sm" onClick={onToggleSelect}>
              {selected ? (
                <>
                  <Check className="mr-2 h-3.5 w-3.5" />
                  Selecionada
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Marcar para lote
                </>
              )}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {!locked && (
            <Button size="sm" onClick={onAddNow} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-3.5 w-3.5" />
              )}
              Adicionar e redigir
            </Button>
          )}
        </div>
      </DialogFooter>
    </>
  );
}

function IntroBlock({
  newsletter,
  locked,
  busy,
  onSave,
  onGenerate,
}: {
  newsletter: NewsletterWithItems;
  locked: boolean;
  busy: string | null;
  onSave: (title: string, body: string) => void;
  onGenerate: () => void;
}) {
  const [title, setTitle] = useState(newsletter.intro_title ?? "");
  const [body, setBody] = useState(newsletter.intro_body ?? "");

  const dirty =
    title !== (newsletter.intro_title ?? "") || body !== (newsletter.intro_body ?? "");

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Abertura
          </p>
          {!locked && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onGenerate}
              disabled={busy !== null || newsletter.items.length === 0}
            >
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Sugerir com IA
            </Button>
          )}
        </div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da abertura"
          disabled={locked}
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Texto de apresentação da edição."
          rows={5}
          disabled={locked}
        />
        {!locked && dirty && (
          <Button size="sm" onClick={() => onSave(title, body)} disabled={busy !== null}>
            Salvar abertura
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SignatureBlock({
  newsletter,
  locked,
  busy,
  onSave,
}: {
  newsletter: NewsletterWithItems;
  locked: boolean;
  busy: string | null;
  onSave: (signature: string, collaborators: string) => void;
}) {
  const [signature, setSignature] = useState(newsletter.signature_names ?? "");
  const [collaborators, setCollaborators] = useState(newsletter.collaborator_names ?? "");

  const dirty =
    signature !== (newsletter.signature_names ?? "") ||
    collaborators !== (newsletter.collaborator_names ?? "");

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Assinatura
        </p>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">
            Responsáveis pelo conteúdo
          </label>
          <Input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Nome do sócio responsável"
            disabled={locked}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">
            Colaborou para esta newsletter
          </label>
          <Input
            value={collaborators}
            onChange={(e) => setCollaborators(e.target.value)}
            placeholder="Nome e cargo de quem colaborou"
            disabled={locked}
          />
        </div>
        {!locked && dirty && (
          <Button
            size="sm"
            onClick={() => onSave(signature, collaborators)}
            disabled={busy !== null}
          >
            Salvar assinatura
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ItemEditor({
  item,
  index,
  total,
  newsletterId,
  locked,
  onMove,
  onChanged,
  onError,
}: {
  item: NewsletterItem;
  index: number;
  total: number;
  newsletterId: string;
  locked: boolean;
  onMove: (index: number, delta: number) => void;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [headline, setHeadline] = useState(item.headline);
  const [body, setBody] = useState(item.body);
  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setHeadline(item.headline);
    setBody(item.body);
  }, [item.headline, item.body]);

  const dirty = headline !== item.headline || body !== item.body;

  const call = async (key: string, init: RequestInit) => {
    setBusy(key);
    try {
      await api(`/api/content-newsletters/${newsletterId}/items/${item.id}`, init);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Erro ao atualizar a seção.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start justify-between gap-2">
          <span className="mt-1 text-xs font-semibold text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="flex items-center gap-1">
            {!locked && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMove(index, -1)}
                  disabled={index === 0}
                  aria-label="Mover para cima"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMove(index, 1)}
                  disabled={index === total - 1}
                  aria-label="Mover para baixo"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowInstructions((v) => !v)}
                  aria-label="Regerar com IA"
                >
                  {busy === "regenerate" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => call("delete", { method: "DELETE" })}
                  aria-label="Remover seção"
                >
                  {busy === "delete" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
            {item.source_link && (
              <Button variant="ghost" size="icon" asChild aria-label="Abrir notícia">
                <a href={item.source_link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>

        <Input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className="font-medium"
          disabled={locked}
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          disabled={locked}
        />

        {showInstructions && !locked && (
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <Input
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="O que ajustar? Ex.: encurte e foque no impacto para credores."
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  call("regenerate", {
                    method: "PATCH",
                    body: JSON.stringify({ action: "regenerate", instructions }),
                  }).then(() => {
                    setInstructions("");
                    setShowInstructions(false);
                  })
                }
                disabled={busy !== null}
              >
                Regerar texto
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowInstructions(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {item.edited_by_name && item.edited_at
              ? `Editado por ${item.edited_by_name} em ${format(
                  new Date(item.edited_at),
                  "dd/MM/yyyy 'às' HH:mm",
                  { locale: ptBR }
                )}`
              : "Texto original da IA"}
          </p>
          {!locked && dirty && (
            <Button
              size="sm"
              onClick={() =>
                call("save", {
                  method: "PATCH",
                  body: JSON.stringify({ headline, body }),
                })
              }
              disabled={busy !== null}
            >
              {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar texto
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
