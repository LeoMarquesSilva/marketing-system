"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { isTourDemoStep, useContentTour } from "@/contexts/content-tour-context";
import { ContentTourRoteiroDemo } from "@/components/conteudo/content-tour-roteiro-demo";
import { ManualLinkCard } from "@/components/conteudo/manual-link-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  Clock,
  LayoutGrid,
  List,
  ChevronDown,
  FileCheck,
  FileText,
  Pencil,
  Send,
  Download,
  Link2,
  Clapperboard,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RoteiroCard, PerformanceHint, RoteiroCover, type RoteiroItem } from "@/components/conteudo/roteiro-card";
import { parseCarousel, buildRoteiroWordHtml, roteiroWordSlug } from "@/lib/content-word";
import { RoteiroListRow } from "@/components/conteudo/roteiro-list-row";
import {
  getAllowedLegalAreas,
  getAreaDotColor,
  getLegalAreasForDepartment,
  canCreateRoteiroFromLink,
  isContentCollaborator,
  isContentManager,
  LEGAL_AREAS,
  STATUS_LABELS,
} from "@/lib/content-areas";
import { getRoteiroDate, isRecentRoteiro, isWithinContentWindow, sortByDateDesc, CONTENT_MAX_AGE_DAYS, CONTENT_HIGHLIGHT_DAYS } from "@/lib/content-utils";

interface ContentTopic {
  id: string;
  name: string;
  rss_query: string;
  legal_area: string;
  is_active: boolean;
  created_at: string;
}

type ViewTab = "recentes" | "aguardando" | "todos";
type ViewMode = "list" | "grid";

interface ViosTaskOption {
  id: string;
  vios_id: string;
  tarefa: string;
  area_processo: string | null;
  data_limite: string | null;
  status: string;
  already_linked: boolean;
}

export function RoteirosClient() {
  const { profile, loading: authLoading } = useAuth();
  const tour = useContentTour();
  const showTourDemo = tour.active && isTourDemoStep(tour.stepId);
  const isManager = isContentManager(profile);
  const isCollaborator = isContentCollaborator(profile);
  const canPasteLink = canCreateRoteiroFromLink(profile);
  const allowedAreas = useMemo(() => getAllowedLegalAreas(profile), [profile]);
  /** Filtro de área: gestores e quem enxerga mais de uma área (ex.: Sócio, Institucional). */
  const canFilterByArea =
    isManager || (Array.isArray(allowedAreas) && allowedAreas.length > 1);
  const userAreas = useMemo(
    () => (profile?.department ? getLegalAreasForDepartment(profile.department) : []),
    [profile?.department]
  );

  const [topics, setTopics] = useState<ContentTopic[]>([]);
  const [roteiros, setRoteiros] = useState<RoteiroItem[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingRoteiros, setLoadingRoteiros] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("todos");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [rssOpen, setRssOpen] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [selectedRoteiro, setSelectedRoteiro] = useState<RoteiroItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(true);

  const dismissOnboarding = () => setShowOnboarding(false);

  const [isEditingPost, setIsEditingPost] = useState(false);
  const [draftPost, setDraftPost] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setIsEditingPost(false);
    setDraftPost(selectedRoteiro?.post ?? "");
  }, [selectedRoteiro?.id, selectedRoteiro?.post]);

  const saveEdit = async () => {
    if (!selectedRoteiro) return;
    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch("/api/content-roteiros", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedRoteiro.id,
          action: "edit",
          post: draftPost,
          edited_by_id: profile?.id,
          edited_by_name: profile?.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Erro ao salvar alterações");
      }
      const altered = Boolean(data.has_alterations);
      const editedAt = new Date().toISOString();
      const patch = {
        post: draftPost,
        has_alterations: altered,
        edited_by_name: profile?.name ?? null,
        edited_at: editedAt,
      };
      setRoteiros((prev) =>
        prev.map((r) => (r.id === selectedRoteiro.id ? { ...r, ...patch } : r))
      );
      setSelectedRoteiro((prev) => (prev ? { ...prev, ...patch } : null));
      setIsEditingPost(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar alterações");
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    if (isCollaborator) {
      setActiveTab("recentes");
      setViewMode("list");
    }
  }, [isCollaborator]);

  const loadTopics = useCallback(async () => {
    if (!isManager) return;
    setLoadingTopics(true);
    try {
      const res = await fetch("/api/content-topics", { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao carregar temas");
      }
      setTopics(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoadingTopics(false);
    }
  }, [isManager]);

  const loadRoteiros = useCallback(async () => {
    setLoadingRoteiros(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (areaFilter) params.set("area", areaFilter);
      if (topicFilter) params.set("topic_id", topicFilter);
      const res = await fetch(`/api/content-roteiros?${params}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar conteúdos de post");
      setRoteiros(Array.isArray(data) ? data : []);
      setLastLoadedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setRoteiros([]);
    } finally {
      setLoadingRoteiros(false);
    }
  }, [statusFilter, areaFilter, topicFilter]);

  useEffect(() => {
    if (!authLoading) loadTopics();
  }, [loadTopics, authLoading]);

  useEffect(() => {
    if (!authLoading) loadRoteiros();
  }, [loadRoteiros, authLoading]);

  const sortedRoteiros = useMemo(
    () => sortByDateDesc(roteiros.filter((r) => isWithinContentWindow(r))),
    [roteiros]
  );

  const filteredRoteiros = useMemo(() => {
    let list = sortedRoteiros;

    if (activeTab === "recentes") {
      list = list.filter((r) => isRecentRoteiro(r, CONTENT_HIGHLIGHT_DAYS));
    } else if (activeTab === "aguardando") {
      list = list.filter((r) => r.status === "aguardando_aprovacao");
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q) ||
        (r.content_snippet ?? "").toLowerCase().includes(q)
    );
  }, [sortedRoteiros, searchQuery, activeTab]);

  const featuredRoteiro = filteredRoteiros[0] ?? null;
  const listWithoutFeatured = featuredRoteiro
    ? filteredRoteiros.filter((r) => r.id !== featuredRoteiro.id)
    : filteredRoteiros;

  const recentHighlights = useMemo(
    () => sortedRoteiros.filter((r) => isRecentRoteiro(r, CONTENT_HIGHLIGHT_DAYS)).slice(0, 6),
    [sortedRoteiros]
  );

  const stats = useMemo(
    () => ({
      total: roteiros.length,
      pending: roteiros.filter((r) => r.status === "aguardando_aprovacao").length,
      inReview: roteiros.filter(
        (r) => r.status === "em_revisao" || r.status === "aprovado_revisor"
      ).length,
      sent: roteiros.filter((r) => r.status === "enviado_mkt").length,
      recent: roteiros.filter((r) => isRecentRoteiro(r, CONTENT_HIGHLIGHT_DAYS)).length,
    }),
    [roteiros]
  );

  const uniqueAreas = useMemo(() => {
    const fromData = Array.from(new Set(roteiros.map((r) => r.area)));
    const base =
      allowedAreas === null
        ? [...LEGAL_AREAS]
        : allowedAreas.length > 0
          ? [...allowedAreas]
          : [...LEGAL_AREAS];
    return [
      ...base,
      ...fromData.filter((a) => !(base as readonly string[]).includes(a)),
    ].sort();
  }, [roteiros, allowedAreas]);

  const handleFetch = async () => {
    setFetching(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch("/api/content-roteiros/fetch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicIds: selectedTopicIds.length > 0 ? selectedTopicIds : undefined,
          accessToken: session.access_token,
          refreshToken: session.refresh_token ?? undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 202) {
        setError(null);
        alert(
          data.message ??
            "Busca iniciada em segundo plano. Atualize a lista em alguns minutos."
        );
        window.setTimeout(() => void loadRoteiros(), 30_000);
        window.setTimeout(() => void loadRoteiros(), 90_000);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar notícias");
      if (data.errors?.length) {
        const skippedTxt = data.skipped ? ` ${data.skipped} repetida(s) ignorada(s).` : "";
        setError(`Criados: ${data.created}.${skippedTxt} Erros: ${data.errors.slice(0, 3).join("; ")}`);
      }
      await loadRoteiros();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setFetching(false);
    }
  };

  const [actionLoading, setActionLoading] = useState(false);

  const patchStatus = async (id: string, status: string, extra?: Record<string, unknown>) => {
    const body: Record<string, unknown> = {
      id,
      status,
      approved_by_id: profile?.id,
      approved_by_name: profile?.name,
      ...extra,
    };
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
    const patch: Partial<RoteiroItem> = { status };
    setRoteiros((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (selectedRoteiro?.id === id) {
      setSelectedRoteiro((prev) => (prev ? { ...prev, ...patch } : null));
    }
  };

  const handleTransition = async (status: string) => {
    if (!selectedRoteiro) return;
    setActionLoading(true);
    setError(null);
    try {
      await patchStatus(selectedRoteiro.id, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setActionLoading(false);
    }
  };

  const sendToMkt = async () => {
    if (!selectedRoteiro) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/content-roteiros", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedRoteiro.id, action: "send_mkt" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar ao marketing");
      const patch: Partial<RoteiroItem> = {
        status: "enviado_mkt",
        sent_to_mkt_at: new Date().toISOString(),
        sent_to_mkt_by_name: profile?.name ?? null,
        marketing_request_id: data.marketing_request_id ?? null,
      };
      setRoteiros((prev) =>
        prev.map((r) => (r.id === selectedRoteiro.id ? { ...r, ...patch } : r))
      );
      setSelectedRoteiro((prev) => (prev ? { ...prev, ...patch } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar ao marketing");
    } finally {
      setActionLoading(false);
    }
  };

  const [viosTasks, setViosTasks] = useState<ViosTaskOption[]>([]);
  const [linkingVios, setLinkingVios] = useState(false);

  useEffect(() => {
    if (authLoading || !profile?.id) return;
    fetch("/api/content-roteiros/vios-tasks", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setViosTasks(Array.isArray(data) ? data : []))
      .catch(() => setViosTasks([]));
  }, [authLoading, profile?.id]);

  const linkVios = async (viosTaskId: string | null) => {
    if (!selectedRoteiro) return;
    setLinkingVios(true);
    setError(null);
    try {
      const res = await fetch("/api/content-roteiros", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedRoteiro.id,
          action: "link_vios",
          vios_task_id: viosTaskId,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Erro ao vincular tarefa");
      }
      const patch: Partial<RoteiroItem> = { vios_task_id: viosTaskId };
      setRoteiros((prev) =>
        prev.map((r) => (r.id === selectedRoteiro.id ? { ...r, ...patch } : r))
      );
      setSelectedRoteiro((prev) => (prev ? { ...prev, ...patch } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao vincular tarefa");
    } finally {
      setLinkingVios(false);
    }
  };

  const downloadWord = () => {
    if (!selectedRoteiro) return;
    const r = selectedRoteiro;
    const html = buildRoteiroWordHtml({
      title: r.title,
      area: r.area,
      link: r.link,
      contentSnippet: r.content_snippet,
      post: r.post,
      hasAlterations: r.has_alterations,
      editedByName: r.edited_by_name,
      editedAt: r.edited_at,
      originalPost: r.original_post,
      authorName: profile?.name,
      authorRole: profile?.department,
    });
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `post-${roteiroWordSlug(r.title)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyPost = (post: string) => {
    navigator.clipboard.writeText(post);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const areaLabel =
    isCollaborator && userAreas.length === 1 ? userAreas[0] : profile?.department ?? "sua área";

  const rejectHandler = (id: string) => {
    patchStatus(id, "rejeitado").catch((e) =>
      setError(e instanceof Error ? e.message : "Erro ao rejeitar")
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" data-tour="roteiros-header">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Portal de conteúdo
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {profile?.name ? `Olá, ${profile.name.split(" ")[0]}` : "Conteúdo para Posts"}
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm max-w-xl">
            {isCollaborator
              ? `Notícias e posts da área ${areaLabel} para revisar e aprovar.`
              : "Notícias jurídicas convertidas em posts para redes sociais."}{" "}
            <span className="text-muted-foreground/80">
              (últimos {CONTENT_MAX_AGE_DAYS} dias)
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/conteudo/reels">
              <Clapperboard className="h-4 w-4" />
              Roteiros de Reels
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => loadRoteiros()}
            disabled={loadingRoteiros}
          >
            <RefreshCw className={cn("h-4 w-4", loadingRoteiros && "animate-spin")} />
            Atualizar
          </Button>
          {lastLoadedAt && !loadingRoteiros && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {stats.total} notícia{stats.total !== 1 ? "s" : ""} ·{" "}
              {format(lastLoadedAt, "HH:mm", { locale: ptBR })}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="A validar" value={stats.pending} warn={stats.pending > 0} />
        <StatCard label="Em revisão" value={stats.inReview} accent />
        <StatCard label="Enviados ao MKT" value={stats.sent} />
        <StatCard label="Total" value={stats.total} />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Onboarding do colaborador (oculto durante o tour interativo) */}
      {isCollaborator && showOnboarding && !tour.active && (
        <div className="relative rounded-xl border border-primary/20 bg-primary/[0.03] p-4 sm:p-5">
          <button
            type="button"
            onClick={dismissOnboarding}
            className="absolute right-3 top-3 text-muted-foreground/70 hover:text-foreground transition-colors"
            title="Dispensar"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold mb-3">Fluxo resumido</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Newspaper,
                title: "1. Escolha e confira",
                desc: "Abra a notícia, valide a fonte e veja o insight de performance da sua área.",
              },
              {
                icon: Pencil,
                title: "2. Ajuste o texto",
                desc: "Edite o carrossel se precisar ou baixe Word para revisar offline.",
              },
              {
                icon: Check,
                title: "3. Enviar ao gestor",
                desc: "Registre em revisão aqui e mande o material ao gestor pelo VIOS ou e-mail da sua área.",
              },
              {
                icon: FileCheck,
                title: "4. Gestor aprovou",
                desc: "Quando o gestor der ok (fora do sistema), você clica em Gestor aprovou neste post.",
              },
              {
                icon: Send,
                title: "5. Enviar ao MKT",
                desc: "No lugar de e-mail ao marketing, um clique e entra no Planner.",
              },
            ].map((step) => (
              <div key={step.title} className="flex gap-2.5">
                <step.icon className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                <div>
                  <p className="text-xs font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showTourDemo && <ContentTourRoteiroDemo />}

      {/* Busca RSS — marketing */}
      {isManager && (
        <Card className="overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
            onClick={() => setRssOpen((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Buscar notícias RSS e gerar posts</span>
              {loadingTopics && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", rssOpen && "rotate-180")} />
          </button>
          {rssOpen && (
            <CardContent className="pt-0 pb-5 px-5 border-t">
              <p className="text-sm text-muted-foreground mb-4">
                Selecione os temas (ou deixe vazio para todos) e execute a busca.
              </p>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1.5 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground">Temas</label>
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
                    <SelectTrigger className="h-9">
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
                  className="gap-2 h-9"
                >
                  {fetching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Buscando…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Executar busca
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Link avulso — marketing e colaboradores de área */}
      {canPasteLink && <ManualLinkCard onCreated={loadRoteiros} />}

      {/* Carrossel recentes — mobile/colaborador */}
      {isCollaborator && recentHighlights.length > 1 && (
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Últimas da sua área
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory -mx-1 px-1">
            {recentHighlights.map((r) => (
              <RoteiroCard
                key={`recent-${r.id}`}
                roteiro={r}
                compact
                onView={setSelectedRoteiro}
                onReject={rejectHandler}
              />
            ))}
          </div>
        </section>
      )}

      {/* Feed principal */}
      <div className="space-y-4" data-tour="roteiros-list">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1" data-tour="roteiros-tabs">
            {(
              [
                { id: "recentes" as const, label: "Recentes", count: stats.recent },
                { id: "aguardando" as const, label: "A validar", count: stats.pending },
                { id: "todos" as const, label: "Todos", count: stats.total },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                <span className="tabular-nums opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] lg:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar notícias..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canFilterByArea && (
              <Select value={areaFilter || "all"} onValueChange={(v) => setAreaFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="Área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas áreas</SelectItem>
                  {uniqueAreas.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isManager && (
              <Select value={topicFilter || "all"} onValueChange={(v) => setTopicFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[140px] h-9 text-xs hidden md:flex">
                  <SelectValue placeholder="Tema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos temas</SelectItem>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex rounded-lg border p-0.5">
              <button
                type="button"
                title="Lista"
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Grade"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        {loadingRoteiros || authLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Carregando notícias...</p>
          </div>
        ) : filteredRoteiros.length === 0 ? (
          <EmptyState
            isCollaborator={isCollaborator}
            areaLabel={areaLabel}
            hasData={roteiros.length > 0}
            isManager={isManager}
            onRefresh={loadRoteiros}
          />
        ) : (
          <div className="space-y-4">
            {featuredRoteiro && activeTab !== "aguardando" && (
              <RoteiroCard
                roteiro={featuredRoteiro}
                featured
                onView={setSelectedRoteiro}
              />
            )}

            {viewMode === "list" ? (
              <div className="space-y-2">
                {listWithoutFeatured.map((r) => (
                  <RoteiroListRow
                    key={r.id}
                    roteiro={r}
                    onView={setSelectedRoteiro}
                    onReject={rejectHandler}
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listWithoutFeatured.map((r) => (
                  <RoteiroCard
                    key={r.id}
                    roteiro={r}
                    onView={setSelectedRoteiro}
                    onReject={rejectHandler}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal detalhe */}
      <Dialog open={!!selectedRoteiro} onOpenChange={() => setSelectedRoteiro(null)}>
        <DialogContent className="w-[96vw] max-w-5xl sm:max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
          {/* Capa com manchete sobreposta */}
          {selectedRoteiro && (
            <RoteiroCover roteiro={selectedRoteiro} className="h-52 sm:h-64 shrink-0">
              <div className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-6">
                <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                  <span className={cn("h-1.5 w-1.5 rounded-full", getAreaDotColor(selectedRoteiro.area))} />
                  {selectedRoteiro.area}
                </span>
                <DialogTitle className="max-w-2xl text-lg font-bold leading-snug text-white drop-shadow-sm sm:text-2xl line-clamp-3">
                  {selectedRoteiro.title}
                </DialogTitle>
                <p className="mt-2 text-xs text-white/80">
                  {format(getRoteiroDate(selectedRoteiro), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  {" • "}
                  {STATUS_LABELS[selectedRoteiro.status] ?? selectedRoteiro.status}
                </p>
              </div>
            </RoteiroCover>
          )}

          {/* Barra de ações */}
          <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3 shrink-0" data-tour="roteiro-detail-actions">
            {selectedRoteiro?.link && (
              <a href={selectedRoteiro.link} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-2 h-9 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Conferir notícia
                </Button>
              </a>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-2 h-9 text-xs"
              onClick={() => selectedRoteiro && copyPost(selectedRoteiro.post)}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar post"}
            </Button>
            <Button
              size="sm"
              variant={isEditingPost ? "secondary" : "outline"}
              className="gap-2 h-9 text-xs"
              onClick={() => {
                setDraftPost(selectedRoteiro?.post ?? "");
                setIsEditingPost((v) => !v);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              {isEditingPost ? "Cancelar edição" : "Editar texto"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 h-9 text-xs"
              onClick={downloadWord}
            >
              <Download className="h-3.5 w-3.5" />
              Baixar Word
            </Button>
            {/* Ações por etapa do fluxo */}
            {selectedRoteiro?.status === "aguardando_aprovacao" && (
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 h-9 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
                  onClick={() => selectedRoteiro && rejectHandler(selectedRoteiro.id)}
                  disabled={actionLoading}
                >
                  <X className="h-3.5 w-3.5" />
                  Rejeitar
                </Button>
                <Button
                  size="sm"
                  className="gap-2 h-9 text-xs bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleTransition("em_revisao")}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Aprovar e enviar p/ revisão
                </Button>
              </div>
            )}
            {selectedRoteiro?.status === "em_revisao" && (
              <Button
                size="sm"
                className="ml-auto gap-2 h-9 text-xs bg-violet-600 hover:bg-violet-700"
                onClick={() => handleTransition("aprovado_revisor")}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Gestor aprovou
              </Button>
            )}
            {selectedRoteiro?.status === "aprovado_revisor" && (
              <Button
                size="sm"
                className="ml-auto gap-2 h-9 text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={sendToMkt}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Enviar ao marketing
              </Button>
            )}
            {selectedRoteiro?.status === "enviado_mkt" && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <Check className="h-4 w-4" />
                Enviado ao marketing
              </span>
            )}
          </div>

          {/* Corpo */}
          <div className="flex-1 overflow-auto bg-muted/20 px-5 py-5 space-y-5 sm:px-6">
            {selectedRoteiro?.content_snippet && (
              <div className="rounded-xl border bg-card p-4">
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Newspaper className="h-3.5 w-3.5" />
                  Resumo da notícia
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {selectedRoteiro.content_snippet}
                </p>
              </div>
            )}
            {selectedRoteiro?.performance_hint && (
              <PerformanceHint hint={selectedRoteiro.performance_hint} className="text-xs" />
            )}
            {selectedRoteiro?.has_alterations && !isEditingPost && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                <Pencil className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Texto ajustado{selectedRoteiro.edited_by_name ? ` por ${selectedRoteiro.edited_by_name}` : ""}
                  {selectedRoteiro.edited_at
                    ? ` em ${format(new Date(selectedRoteiro.edited_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}`
                    : ""}
                  {" "}(diferente da versão original da IA).
                </span>
              </div>
            )}
            {selectedRoteiro && !isEditingPost && (
              <div className="space-y-2 rounded-xl border bg-card p-4">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5" />
                  Tarefa do VIOS vinculada
                </p>
                {selectedRoteiro.status === "enviado_mkt" ? (
                  <p className="text-sm">
                    {(() => {
                      const t = viosTasks.find((x) => x.id === selectedRoteiro.vios_task_id);
                      if (t) return `${t.vios_id} · ${t.tarefa}`;
                      return selectedRoteiro.vios_task_id ? "Tarefa vinculada" : "Nenhuma";
                    })()}
                  </p>
                ) : viosTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Você não tem tarefas do VIOS em aberto para vincular.
                  </p>
                ) : (
                  <>
                    <Select
                      value={selectedRoteiro.vios_task_id ?? "none"}
                      onValueChange={(v) => linkVios(v === "none" ? null : v)}
                      disabled={linkingVios}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecione uma tarefa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {viosTasks.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.vios_id} · {t.tarefa.length > 48 ? `${t.tarefa.slice(0, 48)}…` : t.tarefa}
                            {t.data_limite
                              ? ` · ${format(new Date(t.data_limite), "dd/MM", { locale: ptBR })}`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Vincule se a sua área envia conteúdo ao gestor pelo VIOS. Ao enviar ao marketing, a
                      tarefa fica ligada ao card no Planner.
                    </p>
                  </>
                )}
              </div>
            )}
            {selectedRoteiro && isEditingPost ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                    Editando o texto do post
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {draftPost.length} caracteres
                  </span>
                </div>
                <textarea
                  value={draftPost}
                  onChange={(e) => setDraftPost(e.target.value)}
                  rows={20}
                  className="w-full resize-y rounded-xl border bg-card p-4 font-mono text-[13px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    Ao confirmar, este passa a ser o texto do post e o marketing é avisado de que você ajustou.
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDraftPost(selectedRoteiro.post);
                        setIsEditingPost(false);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button size="sm" className="gap-2" onClick={saveEdit} disabled={savingEdit}>
                      {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Confirmar este texto
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              selectedRoteiro && (
                <CarouselPost
                  text={selectedRoteiro.post}
                  author={{
                    name: profile?.name,
                    role: profile?.department,
                    avatarUrl: profile?.avatar_url,
                  }}
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Renderiza texto com **negrito** inline. */
function renderInline(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}


function initials(name?: string | null) {
  if (!name) return "BP";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

interface CarouselAuthor {
  name?: string | null;
  role?: string | null;
  avatarUrl?: string | null;
}

function CarouselPost({ text, author }: { text: string; author?: CarouselAuthor }) {
  const slides = parseCarousel(text);

  if (slides.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      </div>
    );
  }

  const [cover, ...rest] = slides;
  const coverSubtitle = cover.body.map((b) => b.content).join(" ");

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        Pré-visualização do carrossel · {slides.length} slides · arraste para o lado →
      </p>
      <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory">
        {/* Slide 01 — capa no padrão da marca */}
        <article className="relative flex aspect-[4/5] w-[230px] shrink-0 snap-start flex-col overflow-hidden rounded-lg bg-gradient-to-br from-[#1a2f44] to-[#1c1c1c] p-5 text-white shadow-md sm:w-[260px]">
          <span className="absolute right-3 top-3 text-[10px] font-bold tracking-widest text-white/40">
            01
          </span>
          <div className="mb-3 h-16 w-16 overflow-hidden rounded-full border-2 border-white/30 bg-white/10">
            {author?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={author.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white/70">
                {initials(author?.name)}
              </div>
            )}
          </div>
          <h4 className="text-lg font-bold leading-tight line-clamp-4">{cover.title}</h4>
          {coverSubtitle && (
            <p className="mt-2 text-xs leading-snug text-white/75 line-clamp-4">{coverSubtitle}</p>
          )}
          <div className="mt-auto border-t border-white/15 pt-3">
            <p className="text-sm font-semibold leading-tight">{author?.name ?? "Seu nome"}</p>
            <p className="text-[11px] text-white/60">{author?.role ?? "Sua área"}</p>
          </div>
        </article>

        {/* Slides de conteúdo */}
        {rest.map((slide, idx) => (
          <article
            key={idx}
            className="flex aspect-[4/5] w-[230px] shrink-0 snap-start flex-col overflow-hidden rounded-lg border bg-card shadow-sm sm:w-[260px]"
          >
            {/* Cabeçalho: referência do slide */}
            <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2">
              <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-primary/70">
                {slide.heading || "Slide"}
              </span>
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground/50">
                {String(idx + 2).padStart(2, "0")}
              </span>
            </div>
            {/* Corpo: título + conteúdo unidos */}
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              <h4 className="text-sm font-bold leading-snug text-foreground">{slide.title}</h4>
              <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                {slide.body.map((b, i) =>
                  b.type === "bullet" ? (
                    <p key={i} className="flex gap-1.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/50" />
                      <span>{renderInline(b.content)}</span>
                    </p>
                  ) : (
                    <p key={i}>{renderInline(b.content)}</p>
                  )
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        O Slide 01 é a capa (sua foto, nome e cargo) — os textos vêm do post; ajuste no botão{" "}
        <span className="font-medium">Editar texto</span> se precisar.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: number;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-4 py-3",
        accent && "border-primary/20 bg-primary/[0.03]",
        warn && "border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20"
      )}
    >
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function EmptyState({
  isCollaborator,
  areaLabel,
  hasData,
  isManager,
  onRefresh,
}: {
  isCollaborator: boolean;
  areaLabel: string;
  hasData: boolean;
  isManager: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center rounded-lg border border-dashed bg-muted/10">
      <div className="rounded-full bg-muted/60 p-5">
        <Newspaper className="h-10 w-10 text-muted-foreground/50" />
      </div>
      <div className="space-y-1 max-w-sm px-4">
        <p className="font-medium text-foreground">
          {hasData ? "Nenhum resultado neste filtro" : "Nenhuma notícia encontrada"}
        </p>
        <p className="text-sm text-muted-foreground">
          {hasData
            ? "Tente outra aba ou limpe os filtros de busca."
            : isCollaborator
              ? `Ainda não há conteúdos para ${areaLabel}. A equipe de marketing publicará em breve.`
              : isManager
                ? "Execute a busca RSS acima para importar notícias e gerar posts."
                : "Aguarde a publicação de novos conteúdos pela equipe de marketing."}
        </p>
      </div>
      <Button variant="outline" size="sm" className="gap-2" onClick={onRefresh}>
        <RefreshCw className="h-4 w-4" />
        Atualizar lista
      </Button>
    </div>
  );
}
