"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Newspaper,
  Check,
  X,
  Copy,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Search,
  LayoutGrid,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ApprovalRoteiroModal } from "@/components/conteudo/approval-roteiro-modal";
import type { User } from "@/lib/users";

interface ContentTopic {
  id: string;
  name: string;
  rss_query: string;
  legal_area: string;
  is_active: boolean;
  created_at: string;
}

interface ContentRoteiro {
  id: string;
  topic_id: string;
  title: string;
  link: string | null;
  content_snippet: string | null;
  area: string;
  post: string;
  status: string;
  published_at: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  aguardando_aprovacao: "Aguardando",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

const AREA_COLORS: Record<string, string> = {
  Cível: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200/60",
  Trabalhista: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/60",
  "Reestruturação (Insolvência)": "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200/60",
  "Societário e Contrato": "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200/60",
  "Operações Legais (Legal Ops)": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/60",
  "Distressed Deals": "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200/60",
};

const DEFAULT_AREA_STYLE = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200/60";

const LEGAL_AREAS = [
  "Cível",
  "Trabalhista",
  "Reestruturação (Insolvência)",
  "Societário e Contrato",
  "Operações Legais (Legal Ops)",
  "Distressed Deals",
] as const;

function getAreaStyle(area: string) {
  return AREA_COLORS[area] ?? DEFAULT_AREA_STYLE;
}

interface RoteirosClientProps {
  users: User[];
}

export function RoteirosClient({ users }: RoteirosClientProps) {
  const [topics, setTopics] = useState<ContentTopic[]>([]);
  const [roteiros, setRoteiros] = useState<ContentRoteiro[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingRoteiros, setLoadingRoteiros] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoteiro, setSelectedRoteiro] = useState<ContentRoteiro | null>(null);
  const [roteiroToApprove, setRoteiroToApprove] = useState<ContentRoteiro | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    setLoadingTopics(true);
    setError(null);
    try {
      const res = await fetch("/api/content-topics", { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao carregar temas");
      }
      const data = await res.json();
      setTopics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoadingTopics(false);
    }
  }, []);

  const loadRoteiros = useCallback(async () => {
    setLoadingRoteiros(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (areaFilter) params.set("area", areaFilter);
      if (topicFilter) params.set("topic_id", topicFilter);
      const res = await fetch(`/api/content-roteiros?${params}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao carregar conteúdos de post");
      }
      const data = await res.json();
      setRoteiros(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoadingRoteiros(false);
    }
  }, [statusFilter, areaFilter, topicFilter]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    loadRoteiros();
  }, [loadRoteiros]);

  const filteredRoteiros = useMemo(() => {
    if (!searchQuery.trim()) return roteiros;
    const q = searchQuery.toLowerCase().trim();
    return roteiros.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q) ||
        (r.content_snippet ?? "").toLowerCase().includes(q)
    );
  }, [roteiros, searchQuery]);

  const uniqueAreas = useMemo(() => {
    const fromData = Array.from(new Set(roteiros.map((r) => r.area)));
    const combined = [...LEGAL_AREAS, ...fromData.filter((a) => !(LEGAL_AREAS as readonly string[]).includes(a))];
    return combined.sort();
  }, [roteiros]);

  const handleFetch = async () => {
    setFetching(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch("/api/content-roteiros/fetch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicIds:
            selectedTopicIds.length > 0 ? selectedTopicIds : undefined,
          accessToken: session.access_token,
          refreshToken: session.refresh_token ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar notícias");
      if (data.errors?.length) {
        setError(`Criados: ${data.created}. Erros: ${data.errors.slice(0, 3).join("; ")}`);
      }
      await loadRoteiros();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setFetching(false);
    }
  };

  const handleStatusChange = async (
    id: string,
    status: "aprovado" | "rejeitado",
    approvalData?: {
      approved_by_id: string;
      approved_by_name: string;
      has_alterations: boolean;
      alterations_notes: string | null;
      sent_for_manager_review: boolean;
      post?: string;
    }
  ) => {
    try {
      const body: Record<string, unknown> = { id, status };
      if (status === "aprovado" && approvalData) {
        body.approved_by_id = approvalData.approved_by_id;
        body.approved_by_name = approvalData.approved_by_name;
        body.has_alterations = approvalData.has_alterations;
        body.alterations_notes = approvalData.alterations_notes;
        body.sent_for_manager_review = approvalData.sent_for_manager_review;
        if (approvalData.post !== undefined) body.post = approvalData.post;
      }
      const res = await fetch("/api/content-roteiros", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao atualizar");
      }
      setRoteiros((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
      if (selectedRoteiro?.id === id) {
        setSelectedRoteiro((prev) => (prev ? { ...prev, status } : null));
      }
      setRoteiroToApprove(null);
    } catch (err) {
      throw err;
    }
  };

  const handleApproveWithModal = async (data: {
    approved_by_id: string;
    approved_by_name: string;
    has_alterations: boolean;
    alterations_notes: string | null;
    sent_for_manager_review: boolean;
    post?: string;
  }) => {
    if (!roteiroToApprove) return;
    await handleStatusChange(roteiroToApprove.id, "aprovado", data);
  };

  const copyPost = (post: string) => {
    navigator.clipboard.writeText(post);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loadingTopics) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Newspaper className="h-4 w-4" />
            Buscar notícias e gerar conteúdo para posts
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Selecione os temas RSS (ou deixe vazio para todos) e clique em Executar.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2 min-w-[200px]">
              <label className="text-sm font-medium">Temas</label>
              <Select
                value={
                  selectedTopicIds.length === 0
                    ? "all"
                    : selectedTopicIds.length === 1
                      ? selectedTopicIds[0]
                      : "multiple"
                }
                onValueChange={(v) => {
                  if (v === "all") setSelectedTopicIds([]);
                  else setSelectedTopicIds([v]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os temas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os temas</SelectItem>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleFetch}
              disabled={fetching || topics.length === 0}
              className="gap-2"
            >
              {fetching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Executar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4" />
              Posts gerados
              {filteredRoteiros.length > 0 && (
                <Badge variant="secondary" className="font-normal">
                  {filteredRoteiros.length}
                </Badge>
              )}
            </CardTitle>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou área..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={areaFilter || "all"} onValueChange={(v) => setAreaFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as áreas</SelectItem>
                {uniqueAreas.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={topicFilter || "all"} onValueChange={(v) => setTopicFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os temas</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loadingRoteiros ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRoteiros.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <div className="rounded-full bg-muted/50 p-4">
                <Newspaper className="h-10 w-10 opacity-50" />
              </div>
              <p className="text-sm font-medium">
                {roteiros.length === 0
                  ? "Nenhum conteúdo de post ainda. Execute a busca acima."
                  : "Nenhum resultado para os filtros selecionados."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRoteiros.map((r) => (
                <article
                  key={r.id}
                  className={cn(
                    "group flex flex-col rounded-xl border bg-card text-card-foreground",
                    "shadow-sm transition-all duration-200",
                    "hover:shadow-md hover:border-primary/20",
                    "overflow-hidden"
                  )}
                >
                  <div className="flex flex-1 flex-col p-4 gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={cn("text-xs font-medium border", getAreaStyle(r.area))}
                      >
                        {r.area}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-medium",
                          r.status === "aprovado" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800",
                          r.status === "rejeitado" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800",
                          r.status === "aguardando_aprovacao" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800"
                        )}
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-sm line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {r.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-auto">
                      {r.published_at
                        ? format(new Date(r.published_at), "dd MMM yyyy", { locale: ptBR })
                        : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-3 border-t bg-muted/30">
                    {r.link && (
                      <a
                        href={r.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
                        title="Abrir notícia original"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </a>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 gap-2 text-xs"
                      onClick={() => setSelectedRoteiro(r)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Ver post
                    </Button>
                    {r.status === "aguardando_aprovacao" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                          onClick={() => setRoteiroToApprove(r)}
                          title="Aprovar"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                          onClick={() => handleStatusChange(r.id, "rejeitado")}
                          title="Rejeitar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRoteiro} onOpenChange={() => setSelectedRoteiro(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg leading-tight pr-8">
                  {selectedRoteiro?.title}
                </DialogTitle>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedRoteiro && (
                    <Badge
                      variant="outline"
                      className={cn("text-xs", getAreaStyle(selectedRoteiro.area))}
                    >
                      {selectedRoteiro.area}
                    </Badge>
                  )}
                  {selectedRoteiro && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        selectedRoteiro.status === "aprovado" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
                        selectedRoteiro.status === "rejeitado" && "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400",
                        selectedRoteiro.status === "aguardando_aprovacao" && "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                      )}
                    >
                      {STATUS_LABELS[selectedRoteiro.status] ?? selectedRoteiro.status}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedRoteiro?.link && (
                  <a
                    href={selectedRoteiro.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Notícia original
                  </a>
                )}
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => selectedRoteiro && copyPost(selectedRoteiro.post)}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar conteúdo
                    </>
                  )}
                </Button>
                {selectedRoteiro?.status === "aguardando_aprovacao" && (
                  <>
                    <Button
                      size="sm"
                      className="gap-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                      variant="outline"
                      onClick={() => {
                        setRoteiroToApprove(selectedRoteiro);
                        setSelectedRoteiro(null);
                      }}
                    >
                      <Check className="h-4 w-4" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                      onClick={() => handleStatusChange(selectedRoteiro.id, "rejeitado")}
                    >
                      <X className="h-4 w-4" />
                      Rejeitar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 pb-6">
            <div className="mt-4 rounded-xl border bg-muted/20 p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Post em formato carrossel (slides)
              </p>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-transparent p-0 border-0 overflow-visible">
                  {selectedRoteiro?.post}
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ApprovalRoteiroModal
        open={!!roteiroToApprove}
        onOpenChange={(open) => !open && setRoteiroToApprove(null)}
        roteiro={roteiroToApprove}
        users={users}
        onApprove={handleApproveWithModal}
      />
    </div>
  );
}
