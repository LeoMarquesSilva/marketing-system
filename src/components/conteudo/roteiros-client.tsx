"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { isTourDemoStep, useContentTour } from "@/contexts/content-tour-context";
import { ContentTourRoteiroDemo } from "@/components/conteudo/content-tour-roteiro-demo";
import { ManualLinkForm } from "@/components/conteudo/manual-link-card";
import { ContentSimilarityWarning } from "@/components/conteudo/content-similarity-warning";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  History,
  Info,
  Layers,
  Link2,
  Loader2,
  Newspaper,
  Pencil,
  RefreshCw,
  Repeat,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";
import { REGENERATE_PRESETS } from "@/lib/content-generator/prompt";
import { FollowupAlertsSection, OPEN_POST_EVENT } from "@/components/conteudo/followup-alerts";
import { GeradorNovidadesTour } from "@/components/conteudo/novidades-tour";
import { CONTENT_SETTINGS_PATH } from "@/lib/content-generator/settings";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PerformanceHint, RoteiroCover, type RoteiroItem } from "@/components/conteudo/roteiro-card";
import { parseCarousel, buildRoteiroWordHtml, roteiroWordSlug } from "@/lib/content-word";
import { RoteiroListRow, splitNewsTitle } from "@/components/conteudo/roteiro-list-row";
import { PersonAvatar, RoteiroHistorico, StageBadge } from "@/components/conteudo/escolhas-visuals";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import {
  buildEscolhaItems,
  createPersonResolver,
  type EscolhaItem,
  type EscolhaPerson,
  type EscolhaUserRow,
} from "@/lib/content-escolhas";
import {
  getAllowedLegalAreas,
  getLegalAreasForDepartment,
  canCreateRoteiroFromLink,
  isContentCollaborator,
  isContentManager,
  LEGAL_AREAS,
} from "@/lib/content-areas";
import { getRoteiroDate, isWithinContentWindow, sortByDateDesc, CONTENT_MAX_AGE_DAYS, CONTENT_HIGHLIGHT_DAYS } from "@/lib/content-utils";

interface ContentTopic {
  id: string;
  name: string;
  rss_query: string;
  legal_area: string;
  is_active: boolean;
  created_at: string;
}

interface FetchRun {
  id: string;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  created: number;
  skipped: number;
  low_score?: number;
  error_count: number;
}

interface ViosTaskOption {
  id: string;
  vios_id: string;
  tarefa: string;
  area_processo: string | null;
  data_limite: string | null;
  status: string;
  already_linked: boolean;
}

type StageId = "disponiveis" | "com_gestor" | "gestor_aprovou" | "enviadas" | "descartadas" | "todas";

const FLOW_STAGES: { id: StageId; label: string; icon: LucideIcon; statuses: string[] }[] = [
  { id: "disponiveis", label: "Disponíveis", icon: Newspaper, statuses: ["aguardando_aprovacao"] },
  { id: "com_gestor", label: "Com o gestor", icon: UserCheck, statuses: ["em_revisao", "aprovado"] },
  { id: "gestor_aprovou", label: "Gestor aprovou", icon: ShieldCheck, statuses: ["aprovado_revisor"] },
  { id: "enviadas", label: "Enviadas ao MKT", icon: Send, statuses: ["enviado_mkt"] },
];

const OTHER_STAGES: { id: StageId; label: string; icon: LucideIcon; statuses: string[] | null }[] = [
  { id: "descartadas", label: "Descartadas", icon: Trash2, statuses: ["rejeitado"] },
  { id: "todas", label: "Todas", icon: Layers, statuses: null },
];

const STAGE_STATUSES: Record<StageId, string[] | null> = Object.fromEntries(
  [...FLOW_STAGES, ...OTHER_STAGES].map((stage) => [stage.id, stage.statuses]),
) as Record<StageId, string[] | null>;

const STAGE_EMPTY: Record<StageId, string> = {
  disponiveis: "Nenhuma matéria disponível com esses filtros.",
  com_gestor: "Nenhuma matéria esperando o gestor.",
  gestor_aprovou: "Nenhuma matéria aprovada esperando o envio ao Marketing.",
  enviadas: "Nenhuma matéria enviada ao Marketing neste período.",
  descartadas: "Nenhuma matéria descartada neste período.",
  todas: "Nenhuma matéria com esses filtros.",
};

const PAGE_SIZE = 40;
const ONBOARDING_KEY = "orqestrai:conteudo:fluxo-dispensado";

type Notice = {
  tone: "success" | "info";
  text: string;
  action?: { label: string; onClick: () => void };
};

function dayLabel(date: Date): string {
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  const label = format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

function readOnboardingDismissed(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
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
  const canFilterByArea = isManager || (Array.isArray(allowedAreas) && allowedAreas.length > 1);
  const userAreas = useMemo(
    () => (profile?.department ? getLegalAreasForDepartment(profile.department) : []),
    [profile?.department]
  );

  const [topics, setTopics] = useState<ContentTopic[]>([]);
  const [roteiros, setRoteiros] = useState<RoteiroItem[]>([]);
  const [people, setPeople] = useState<EscolhaUserRow[]>([]);
  const [loadingRoteiros, setLoadingRoteiros] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [stage, setStage] = useState<StageId>("todas");
  const [periodDays, setPeriodDays] = useState<number>(CONTENT_MAX_AGE_DAYS);
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recentes" | "potencial">("recentes");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  /** Incrementa para reabrir o tour de novidades pelo botão. */
  const [novidadesRun, setNovidadesRun] = useState(0);
  const [selectedRoteiro, setSelectedRoteiro] = useState<RoteiroItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [buscaOpen, setBuscaOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const [isEditingPost, setIsEditingPost] = useState(false);
  const [draftPost, setDraftPost] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setShowOnboarding(!readOnboardingDismissed());
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      window.localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // Sem armazenamento local: o aviso só volta na próxima visita.
    }
  };

  useEffect(() => {
    setIsEditingPost(false);
    setDraftPost(selectedRoteiro?.post ?? "");
  }, [selectedRoteiro?.id, selectedRoteiro?.post]);

  useEffect(() => {
    setRegenerateOpen(false);
  }, [selectedRoteiro?.id]);

  // Colaborador começa no que precisa da ação dele: o que está disponível nas últimas 2 semanas.
  useEffect(() => {
    if (isCollaborator) {
      setStage("disponiveis");
      setPeriodDays(CONTENT_HIGHLIGHT_DAYS);
    }
  }, [isCollaborator]);

  const updateRoteiro = useCallback((id: string, patch: Partial<RoteiroItem>) => {
    setRoteiros((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSelectedRoteiro((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const loadTopics = useCallback(async () => {
    if (!isManager) return;
    try {
      const res = await fetch("/api/content-topics", { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao carregar temas");
      }
      setTopics(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    }
  }, [isManager]);

  const loadRoteiros = useCallback(async () => {
    setLoadingRoteiros(true);
    setError(null);
    try {
      // Lista leve: o texto do post só vem ao abrir o detalhe.
      const res = await fetch("/api/content-roteiros?lite=1", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar conteúdos de post");
      const list = Array.isArray(data) ? (data as RoteiroItem[]) : [];
      // Preserva o texto já carregado de posts abertos nesta visita.
      setRoteiros((prev) => {
        const loaded = new Map(prev.filter((r) => r.post).map((r) => [r.id, r]));
        return list.map((r) => {
          const full = loaded.get(r.id);
          return full ? { ...r, post: full.post, original_post: full.original_post } : r;
        });
      });
      setLastLoadedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoadingRoteiros(false);
    }
  }, []);

  /** Fotos de quem escolheu, descartou ou trouxe matérias (recortado pelas áreas da pessoa). */
  const loadPeople = useCallback(async () => {
    try {
      const res = await fetch("/api/content-roteiros/escolhas", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: EscolhaItem[] };
      const map = new Map<string, EscolhaUserRow>();
      for (const item of data.items ?? []) {
        for (const person of [item.chosenBy, item.createdBy, item.editedBy, item.sentBy, item.rejectedBy]) {
          if (person?.id && !map.has(person.id)) {
            map.set(person.id, { id: person.id, name: person.name, avatar_url: person.avatarUrl, department: person.department });
          }
        }
      }
      setPeople([...map.values()]);
    } catch {
      // Sem as fotos a lista segue funcionando, só com os nomes.
    }
  }, []);

  const fetchFullRoteiro = useCallback(async (id: string): Promise<RoteiroItem | null> => {
    const res = await fetch(`/api/content-roteiros?contentId=${encodeURIComponent(id)}`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? "Não foi possível abrir o post.");
    return Array.isArray(data) && data[0] ? (data[0] as RoteiroItem) : null;
  }, []);

  const openRoteiro = useCallback(
    async (roteiro: RoteiroItem) => {
      setSelectedRoteiro(roteiro);
      if (roteiro.post) return;
      setLoadingDetail(true);
      try {
        const full = await fetchFullRoteiro(roteiro.id);
        if (full) {
          updateRoteiro(full.id, { post: full.post, original_post: full.original_post });
          setSelectedRoteiro((prev) => (prev?.id === full.id ? { ...prev, ...full } : prev));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível abrir o post.");
      } finally {
        setLoadingDetail(false);
      }
    },
    [fetchFullRoteiro, updateRoteiro]
  );

  const openRoteiroById = useCallback(
    async (id: string) => {
      setLoadingDetail(true);
      try {
        const full = await fetchFullRoteiro(id);
        if (full) setSelectedRoteiro(full);
        else setError("Esse post não foi encontrado.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível abrir o post.");
      } finally {
        setLoadingDetail(false);
      }
    },
    [fetchFullRoteiro]
  );

  useEffect(() => {
    if (authLoading) return;
    void loadTopics();
    void loadRoteiros();
    void loadPeople();
    // Link direto (Escolhas da equipe, avisos): abre o post sem trocar a lista, mesmo se for antigo.
    const requestedId = new URLSearchParams(window.location.search).get("contentId");
    if (requestedId) void openRoteiroById(requestedId);
  }, [authLoading, loadTopics, loadRoteiros, loadPeople, openRoteiroById]);

  // Aviso de desdobramento clicado no sino com a tela já aberta (o link só troca a query).
  useEffect(() => {
    const onOpenPost = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (id) void openRoteiroById(id);
    };
    window.addEventListener(OPEN_POST_EVENT, onOpenPost);
    return () => window.removeEventListener(OPEN_POST_EVENT, onOpenPost);
  }, [openRoteiroById]);

  const resolvePerson = useMemo(() => {
    const users = [...people];
    if (profile?.id && !users.some((user) => user.id === profile.id)) {
      users.push({ id: profile.id, name: profile.name ?? null, avatar_url: profile.avatar_url ?? null, department: profile.department ?? null });
    }
    return createPersonResolver(users);
  }, [people, profile?.id, profile?.name, profile?.avatar_url, profile?.department]);

  const rowDecision = useCallback(
    (r: RoteiroItem): { person: EscolhaPerson; verb: string; at: string | null } | null => {
      if (r.status === "rejeitado") {
        const person = resolvePerson(r.rejected_by_id, r.rejected_by_name);
        return person ? { person, verb: "descartada", at: r.rejected_at ?? null } : null;
      }
      if (r.approved_by_id || r.approved_by_name) {
        const person = resolvePerson(r.approved_by_id, r.approved_by_name);
        return person ? { person, verb: "escolhida", at: r.approved_at ?? null } : null;
      }
      if (r.source === "manual") {
        const person = resolvePerson(r.created_by_id, r.created_by_name);
        return person ? { person, verb: "trazida por link", at: r.created_at } : null;
      }
      return null;
    },
    [resolvePerson]
  );

  // Período, área e tema valem para todas as etapas; a busca e a etapa recortam a lista.
  const scopedRoteiros = useMemo(() => {
    let list = sortByDateDesc(roteiros.filter((r) => isWithinContentWindow(r, periodDays)));
    if (topicFilter) list = list.filter((r) => r.topic_id === topicFilter);
    const q = searchQuery.toLocaleLowerCase("pt-BR").trim();
    if (q) {
      list = list.filter((r) =>
        [r.title, r.area, r.content_snippet ?? "", r.approved_by_name ?? "", r.created_by_name ?? ""].some((field) =>
          field.toLocaleLowerCase("pt-BR").includes(q)
        )
      );
    }
    return list;
  }, [roteiros, periodDays, topicFilter, searchQuery]);

  const areaScoped = useMemo(
    () => (areaFilter ? scopedRoteiros.filter((r) => r.area === areaFilter) : scopedRoteiros),
    [scopedRoteiros, areaFilter]
  );

  const stageCounts = useMemo(() => {
    const counts = {} as Record<StageId, number>;
    for (const [id, statuses] of Object.entries(STAGE_STATUSES) as [StageId, string[] | null][]) {
      counts[id] = statuses ? areaScoped.filter((r) => statuses.includes(r.status)).length : areaScoped.length;
    }
    return counts;
  }, [areaScoped]);

  const stageFilter = useCallback(
    (r: RoteiroItem) => {
      const statuses = STAGE_STATUSES[stage];
      return !statuses || statuses.includes(r.status);
    },
    [stage]
  );

  const areaOptions = useMemo(() => {
    const fromData = Array.from(new Set(roteiros.map((r) => r.area)));
    const base = allowedAreas === null || allowedAreas.length === 0 ? [...LEGAL_AREAS] : [...allowedAreas];
    const all = [...base, ...fromData.filter((a) => !(base as readonly string[]).includes(a))];
    const inStage = scopedRoteiros.filter(stageFilter);
    return all
      .map((area) => ({ area, count: inStage.filter((r) => r.area === area).length }))
      .filter((option) => option.count > 0 || (base as readonly string[]).includes(option.area));
  }, [roteiros, allowedAreas, scopedRoteiros, stageFilter]);

  const filteredRoteiros = useMemo(() => {
    const list = areaScoped.filter(stageFilter);
    if (sortBy !== "potencial") return list;
    // Nota mais alta primeiro; sem nota (matérias antigas) vai para o fim, por data.
    return [...list].sort((a, b) => (b.relevance_score ?? -1) - (a.relevance_score ?? -1));
  }, [areaScoped, stageFilter, sortBy]);

  const dayGroups = useMemo(() => {
    if (sortBy === "potencial") {
      return [{ key: "potencial", label: "Pela nota de potencial (a IA dá a nota antes de escrever)", items: filteredRoteiros.slice(0, visibleCount) }];
    }
    const groups: { key: string; label: string; items: RoteiroItem[] }[] = [];
    for (const r of filteredRoteiros.slice(0, visibleCount)) {
      const date = getRoteiroDate(r);
      const key = format(date, "yyyy-MM-dd");
      let group = groups.at(-1);
      if (!group || group.key !== key) {
        group = { key, label: dayLabel(date), items: [] };
        groups.push(group);
      }
      group.items.push(r);
    }
    return groups;
  }, [filteredRoteiros, visibleCount, sortBy]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [stage, areaFilter, topicFilter, searchQuery, periodDays, sortBy]);

  const [actionLoading, setActionLoading] = useState(false);

  const patchStatus = async (id: string, status: string) => {
    const res = await fetch("/api/content-roteiros", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, approved_by_id: profile?.id, approved_by_name: profile?.name }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      scheduleWarning?: string | null;
      rejected_by_id?: string;
      rejected_by_name?: string | null;
      rejected_at?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar");

    const now = new Date().toISOString();
    const current = roteiros.find((r) => r.id === id) ?? (selectedRoteiro?.id === id ? selectedRoteiro : null);
    const patch: Partial<RoteiroItem> = { status };
    if (status === "em_revisao" && !current?.approved_by_id) {
      // O servidor guarda o primeiro que escolheu; aqui só espelha para a tela.
      patch.approved_by_id = profile?.id ?? null;
      patch.approved_by_name = profile?.name ?? null;
      patch.approved_at = now;
    }
    if (status === "aprovado_revisor") patch.reviewer_approved_at = now;
    if (status === "rejeitado") {
      patch.rejected_by_id = data.rejected_by_id ?? profile?.id ?? null;
      patch.rejected_by_name = data.rejected_by_name ?? profile?.name ?? null;
      patch.rejected_at = data.rejected_at ?? now;
    }
    if (status === "aguardando_aprovacao") {
      patch.rejected_by_id = null;
      patch.rejected_by_name = null;
      patch.rejected_at = null;
    }
    updateRoteiro(id, patch);
    return data;
  };

  const handleTransition = async (status: string) => {
    if (!selectedRoteiro) return;
    setActionLoading(true);
    setError(null);
    setWarning(null);
    try {
      const result = await patchStatus(selectedRoteiro.id, status);
      setWarning(result.scheduleWarning ?? null);
      if (status === "em_revisao") {
        setNotice({ tone: "success", text: "Matéria escolhida. Agora envie o material ao seu gestor pelo VIOS ou e-mail." });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setActionLoading(false);
    }
  };

  const restoreRoteiro = async (id: string) => {
    try {
      await patchStatus(id, "aguardando_aprovacao");
      setNotice({ tone: "info", text: "A matéria voltou para Disponíveis." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível devolver a matéria.");
    }
  };

  const discardRoteiro = async (roteiro: RoteiroItem) => {
    setError(null);
    try {
      await patchStatus(roteiro.id, "rejeitado");
      if (selectedRoteiro?.id === roteiro.id) setSelectedRoteiro(null);
      setNotice({
        tone: "info",
        text: `Descartada: ${splitNewsTitle(roteiro.title).headline}`,
        action: { label: "Desfazer", onClick: () => void restoreRoteiro(roteiro.id) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao descartar");
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
      updateRoteiro(selectedRoteiro.id, {
        status: "enviado_mkt",
        sent_to_mkt_at: new Date().toISOString(),
        sent_to_mkt_by_name: profile?.name ?? null,
        marketing_request_id: data.marketing_request_id ?? null,
      });
      setNotice({ tone: "success", text: "Enviado ao Marketing: o card já está no Planner." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar ao marketing");
    } finally {
      setActionLoading(false);
    }
  };

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
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar alterações");
      updateRoteiro(selectedRoteiro.id, {
        post: draftPost,
        has_alterations: Boolean(data.has_alterations),
        edited_by_id: profile?.id ?? null,
        edited_by_name: profile?.name ?? null,
        edited_at: new Date().toISOString(),
      });
      setIsEditingPost(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar alterações");
    } finally {
      setSavingEdit(false);
    }
  };

  /** "Refazer com IA": novo texto com as regras e o aprendizado atuais + o pedido de quem revisa. */
  const regeneratePost = async (instruction: string) => {
    if (!selectedRoteiro) return;
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/content-roteiros", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedRoteiro.id, action: "regenerate", instruction: instruction.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível refazer o texto.");
      updateRoteiro(selectedRoteiro.id, { post: data.post, original_post: data.post, has_alterations: false });
      setIsEditingPost(false);
      setRegenerateOpen(false);
      setNotice({ tone: "success", text: "Texto refeito pela IA. Confira o carrossel antes de seguir." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível refazer o texto.");
    } finally {
      setRegenerating(false);
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
        body: JSON.stringify({ id: selectedRoteiro.id, action: "link_vios", vios_task_id: viosTaskId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Erro ao vincular tarefa");
      }
      updateRoteiro(selectedRoteiro.id, { vios_task_id: viosTaskId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao vincular tarefa");
    } finally {
      setLinkingVios(false);
    }
  };

  /** Histórico da matéria aberta, sempre a partir do estado atual (fotos vêm de quem já apareceu). */
  const selectedHistory = useMemo(() => {
    if (!selectedRoteiro) return null;
    const users = [...people];
    if (profile?.id && !users.some((user) => user.id === profile.id)) {
      users.push({ id: profile.id, name: profile.name ?? null, avatar_url: profile.avatar_url ?? null, department: profile.department ?? null });
    }
    return buildEscolhaItems([selectedRoteiro], users)[0];
  }, [selectedRoteiro, people, profile?.id, profile?.name, profile?.avatar_url, profile?.department]);

  /** Capa do carrossel e Word saem com quem escolheu; antes da escolha, com quem está vendo. */
  const postAuthor = selectedHistory?.chosenBy
    ? { name: selectedHistory.chosenBy.name, role: selectedHistory.chosenBy.department, avatarUrl: selectedHistory.chosenBy.avatarUrl }
    : { name: profile?.name, role: profile?.department, avatarUrl: profile?.avatar_url };

  const downloadWord = () => {
    if (!selectedRoteiro?.post) return;
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
      authorName: postAuthor.name,
      authorRole: postAuthor.role,
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
    void navigator.clipboard.writeText(post);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const areaLabel = isCollaborator && userAreas.length === 1 ? userAreas[0] : profile?.department ?? "sua área";
  const selectedHeadline = selectedRoteiro ? splitNewsTitle(selectedRoteiro.title) : null;
  const postReady = Boolean(selectedRoteiro?.post);

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-8">
      {/* Cabeçalho da tela */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-tour="roteiros-header">
        <div className="min-w-0">
          <p className="text-sm text-slate-700">
            {isCollaborator
              ? `Notícias da área ${areaLabel}: escolha uma, ajuste o texto e envie ao gestor.`
              : "Notícias jurídicas que a IA já transformou em carrossel. Acompanhe cada uma até o Marketing."}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {loadingRoteiros && !lastLoadedAt
              ? "Carregando matérias…"
              : `${scopedRoteiros.length} ${scopedRoteiros.length === 1 ? "matéria" : "matérias"} nos últimos ${periodDays} dias`}
            {lastLoadedAt ? ` · atualizado às ${format(lastLoadedAt, "HH:mm")}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setNovidadesRun((run) => run + 1)} title="Rever o tour do que mudou nesta tela">
            <Sparkles className="size-4" aria-hidden />
            Novidades
          </Button>
          {canPasteLink ? (
            <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
              <Link2 className="size-4" aria-hidden />
              Gerar por link
            </Button>
          ) : null}
          {isManager ? (
            <Button size="sm" onClick={() => setBuscaOpen(true)}>
              <Search className="size-4" aria-hidden />
              Buscar notícias
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => {
              void loadRoteiros();
              void loadPeople();
            }}
            disabled={loadingRoteiros}
            aria-label="Atualizar lista"
            title="Atualizar lista"
          >
            <RefreshCw className={cn("size-4", loadingRoteiros && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Etapas: onde cada matéria está */}
      <nav aria-label="Etapas da matéria" data-tour="roteiros-tabs" className="rounded-lg border border-[#dce9eb] bg-white p-1.5 shadow-[0_1px_2px_rgba(4,32,47,0.04)]">
        <div className="flex gap-1 overflow-x-auto">
          {FLOW_STAGES.map((option, index) => (
            <Fragment key={option.id}>
              {index > 0 ? <ChevronRight className="hidden size-4 shrink-0 self-center text-slate-300 md:block" aria-hidden /> : null}
              <StageButton
                label={option.label}
                icon={option.icon}
                count={stageCounts[option.id]}
                active={stage === option.id}
                alert={option.id === "gestor_aprovou" && stageCounts[option.id] > 0}
                onClick={() => setStage(option.id)}
                className="min-w-[150px] flex-1"
              />
            </Fragment>
          ))}
          <span className="mx-1 w-px shrink-0 self-stretch bg-[#dce9eb]" aria-hidden />
          {OTHER_STAGES.map((option) => (
            <StageButton
              key={option.id}
              label={option.label}
              icon={option.icon}
              count={stageCounts[option.id]}
              active={stage === option.id}
              onClick={() => setStage(option.id)}
              className="min-w-[120px]"
            />
          ))}
        </div>
      </nav>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              placeholder="Buscar por manchete, assunto ou pessoa"
              aria-label="Buscar matérias"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-9 text-sm"
            />
          </div>
          <div className={cn("grid gap-2 sm:flex", isManager && topics.length > 0 ? "grid-cols-3" : "grid-cols-2")}>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as "recentes" | "potencial")}>
              <SelectTrigger className="h-10 w-full text-sm sm:w-[190px]" aria-label="Ordenar" data-tour="roteiros-ordenar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recentes">Mais recentes</SelectItem>
                <SelectItem value="potencial">Mais promissoras</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
              <SelectTrigger className="h-10 w-full text-sm sm:w-[170px]" aria-label="Período">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 dias</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value={String(CONTENT_HIGHLIGHT_DAYS)}>Últimos {CONTENT_HIGHLIGHT_DAYS} dias</SelectItem>
                <SelectItem value={String(CONTENT_MAX_AGE_DAYS)}>Últimos {CONTENT_MAX_AGE_DAYS} dias</SelectItem>
              </SelectContent>
            </Select>
            {isManager && topics.length > 0 ? (
              <Select value={topicFilter || "all"} onValueChange={(v) => setTopicFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="h-10 w-full text-sm sm:w-[180px]" aria-label="Tema da busca">
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
            ) : null}
          </div>
        </div>
        {canFilterByArea ? (
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Área">
            <AreaChip label="Todas as áreas" active={!areaFilter} onClick={() => setAreaFilter("")} />
            {areaOptions.map((option) => (
              <AreaChip
                key={option.area}
                area={option.area}
                label={option.area}
                count={option.count}
                active={areaFilter === option.area}
                onClick={() => setAreaFilter(areaFilter === option.area ? "" : option.area)}
              />
            ))}
          </div>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar aviso" className="text-red-700/70 hover:text-red-900">
            <X className="size-4" />
          </button>
        </div>
      ) : null}
      {warning ? (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">{warning}</span>
          <button type="button" onClick={() => setWarning(null)} aria-label="Fechar aviso" className="text-amber-800/70 hover:text-amber-950">
            <X className="size-4" />
          </button>
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-lg border p-3 text-sm",
            notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-[#cfe4ea] bg-[#f2f9fb] text-[#1f4c61]"
          )}
        >
          {notice.tone === "success" ? <CheckCircle2 className="size-4 shrink-0" aria-hidden /> : <Info className="size-4 shrink-0" aria-hidden />}
          <span className="min-w-0 flex-1 truncate">{notice.text}</span>
          {notice.action ? (
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                notice.action?.onClick();
                setNotice(null);
              }}
            >
              {notice.action.label}
            </Button>
          ) : null}
          <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso" className="opacity-60 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* Fluxo resumido do colaborador (some durante o tour e depois de dispensado) */}
      {isCollaborator && showOnboarding && !tour.active ? (
        <section className="relative rounded-lg border border-[#dce9eb] bg-white p-4 shadow-[0_1px_2px_rgba(4,32,47,0.04)]">
          <button
            type="button"
            onClick={dismissOnboarding}
            className="absolute right-3 top-3 text-slate-400 transition-colors hover:text-slate-700"
            aria-label="Dispensar o passo a passo"
          >
            <X className="size-4" />
          </button>
          <p className="mb-3 text-sm font-semibold text-slate-900">Como funciona</p>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: Newspaper, title: "Escolha a matéria", desc: "Abra uma notícia disponível e confira a fonte." },
              { icon: Pencil, title: "Ajuste o texto", desc: "Edite o carrossel ou baixe o Word." },
              { icon: UserCheck, title: "Envie ao gestor", desc: "Clique em Escolher e mande pelo VIOS ou e-mail." },
              { icon: FileCheck, title: "Gestor aprovou", desc: "Com o ok dele, registre aqui." },
              { icon: Send, title: "Enviar ao MKT", desc: "Um clique e entra no Planner." },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e8f8f8] text-xs font-semibold text-[#285f7a]">
                  {index + 1}
                </span>
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                    <step.icon className="size-3.5 text-[#347796]" aria-hidden />
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-slate-500">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* Assuntos que a pessoa postou e tiveram fato novo: convite para a continuação. */}
      <FollowupAlertsSection onOpen={(id) => void openRoteiroById(id)} />

      {showTourDemo && <ContentTourRoteiroDemo />}

      {/* O que mudou na tela: abre sozinho uma vez por pessoa; o botão Novidades reabre. */}
      <GeradorNovidadesTour runId={novidadesRun} />

      {/* Lista */}
      <section data-tour="roteiros-list" className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(4,32,47,0.04)]">
        {loadingRoteiros && roteiros.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
            <Loader2 className="size-7 animate-spin" aria-hidden />
            <p className="text-sm">Carregando matérias…</p>
          </div>
        ) : filteredRoteiros.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#eaf2f5]">
              <Newspaper className="size-6 text-[#347796]" aria-hidden />
            </span>
            <p className="text-sm font-medium text-slate-900">
              {roteiros.length === 0
                ? isCollaborator
                  ? `Ainda não há matérias para ${areaLabel}.`
                  : "Nenhuma matéria importada ainda."
                : STAGE_EMPTY[stage]}
            </p>
            <p className="max-w-sm text-sm text-slate-500">
              {roteiros.length === 0
                ? isManager
                  ? "Use Buscar notícias para importar e gerar os posts."
                  : "A equipe de Marketing publica novas matérias todos os dias."
                : "Tente outra etapa, outro período ou limpe a busca."}
            </p>
            {searchQuery || areaFilter || topicFilter ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setAreaFilter("");
                  setTopicFilter("");
                }}
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            {dayGroups.map((group) => (
              <div key={group.key}>
                <p className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#eef4f5] bg-[#f7fbfc] px-4 py-2 text-xs font-semibold text-slate-600">
                  {group.label}
                  <span className="font-normal text-slate-400">{group.items.length}</span>
                </p>
                <div className="divide-y divide-[#eef4f5]">
                  {group.items.map((r) => (
                    <RoteiroListRow
                      key={r.id}
                      roteiro={r}
                      decision={rowDecision(r)}
                      onView={(item) => void openRoteiro(item)}
                      onReject={(item) => void discardRoteiro(item)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {filteredRoteiros.length > visibleCount ? (
              <div className="border-t border-[#eef4f5] px-4 py-3 text-center">
                <Button variant="outline" size="sm" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                  Mostrar mais ({filteredRoteiros.length - visibleCount})
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* Buscar notícias (Marketing) */}
      {isManager ? (
        <BuscaDialog
          open={buscaOpen}
          onOpenChange={setBuscaOpen}
          topics={topics}
          onStarted={(message) => {
            setNotice({ tone: "info", text: message });
            window.setTimeout(() => void loadRoteiros(), 30_000);
            window.setTimeout(() => void loadRoteiros(), 90_000);
          }}
          onFinished={(message, failed) => {
            if (failed) setError(message);
            else setNotice({ tone: "success", text: message });
            void loadRoteiros();
          }}
        />
      ) : null}

      {/* Gerar por link */}
      {canPasteLink ? (
        <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
          <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
            <div className="border-b border-[#eef4f5] px-5 py-4 pr-12">
              <DialogTitle className="text-base font-semibold">Gerar post por link</DialogTitle>
              <DialogDescription className="mt-1 text-sm">Para quando a matéria certa não veio na busca.</DialogDescription>
            </div>
            <div className="overflow-y-auto p-5">
              <ManualLinkForm
                onCreated={() => {
                  void loadRoteiros();
                }}
                onOpen={(id) => {
                  setLinkOpen(false);
                  void openRoteiroById(id);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {/* Detalhe do post */}
      <Dialog open={!!selectedRoteiro} onOpenChange={(open) => !open && setSelectedRoteiro(null)}>
        <DialogContent className="flex max-h-[92dvh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          {selectedRoteiro && selectedHeadline ? (
            <RoteiroCover roteiro={selectedRoteiro} showStatus={false} className="h-40 shrink-0 sm:h-48">
              <div className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-6">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-800">
                    <span className={cn("flex size-4 items-center justify-center rounded", getAreaIconStyle(selectedRoteiro.area))}>
                      <AreaIcon area={selectedRoteiro.area} className="size-3" aria-hidden />
                    </span>
                    {selectedRoteiro.area}
                  </span>
                  <StageBadge status={selectedRoteiro.status} className="bg-white/90" />
                </div>
                <DialogTitle className="line-clamp-2 max-w-3xl text-lg leading-snug font-bold text-white drop-shadow-sm sm:text-2xl">
                  {selectedHeadline.headline}
                </DialogTitle>
                <DialogDescription className="mt-1.5 text-xs text-white/85">
                  {selectedHeadline.source ? `${selectedHeadline.source} · ` : ""}
                  {format(getRoteiroDate(selectedRoteiro), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </DialogDescription>
              </div>
            </RoteiroCover>
          ) : null}

          {/* Ações */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#eef4f5] px-5 py-3" data-tour="roteiro-detail-actions">
            {selectedRoteiro?.link ? (
              <Button size="sm" variant="outline" asChild>
                <a href={selectedRoteiro.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" aria-hidden />
                  Conferir notícia
                </a>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => selectedRoteiro?.post && copyPost(selectedRoteiro.post)} disabled={!postReady}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copiado" : "Copiar texto"}
            </Button>
            <Button
              size="sm"
              variant={isEditingPost ? "secondary" : "outline"}
              disabled={!postReady}
              onClick={() => {
                setDraftPost(selectedRoteiro?.post ?? "");
                setRegenerateOpen(false);
                setIsEditingPost((v) => !v);
              }}
            >
              <Pencil className="size-4" />
              {isEditingPost ? "Cancelar edição" : "Editar texto"}
            </Button>
            <Button size="sm" variant="outline" onClick={downloadWord} disabled={!postReady}>
              <Download className="size-4" />
              Baixar Word
            </Button>
            {selectedRoteiro && selectedRoteiro.status !== "enviado_mkt" && selectedRoteiro.status !== "rejeitado" ? (
              <Button
                size="sm"
                variant={regenerateOpen ? "secondary" : "outline"}
                onClick={() => {
                  setIsEditingPost(false);
                  setRegenerateOpen((open) => !open);
                }}
                disabled={!postReady || regenerating}
                aria-expanded={regenerateOpen}
              >
                <WandSparkles className="size-4" />
                Refazer com IA
              </Button>
            ) : null}

            <div className="ml-auto flex flex-wrap gap-2">
              {selectedRoteiro?.status === "aguardando_aprovacao" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-700 hover:border-red-200 hover:bg-red-50 hover:text-red-800"
                    onClick={() => selectedRoteiro && void discardRoteiro(selectedRoteiro)}
                    disabled={actionLoading}
                  >
                    <Trash2 className="size-4" />
                    Descartar
                  </Button>
                  <Button size="sm" onClick={() => void handleTransition("em_revisao")} disabled={actionLoading}>
                    {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />}
                    Escolher e enviar ao gestor
                  </Button>
                </>
              ) : null}
              {selectedRoteiro?.status === "em_revisao" || selectedRoteiro?.status === "aprovado" ? (
                <Button size="sm" onClick={() => void handleTransition("aprovado_revisor")} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  Gestor aprovou
                </Button>
              ) : null}
              {selectedRoteiro?.status === "aprovado_revisor" ? (
                <Button size="sm" onClick={() => void sendToMkt()} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Enviar ao Marketing
                </Button>
              ) : null}
              {selectedRoteiro?.status === "enviado_mkt" ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Enviado ao Marketing
                </span>
              ) : null}
              {selectedRoteiro?.status === "rejeitado" ? (
                <Button size="sm" variant="outline" onClick={() => selectedRoteiro && void restoreRoteiro(selectedRoteiro.id)}>
                  <RotateCcw className="size-4" />
                  Devolver para Disponíveis
                </Button>
              ) : null}
            </div>
          </div>

          {/* Corpo: post à esquerda, histórico e vínculos à direita */}
          <div className="flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:overflow-hidden">
            <div className="space-y-4 bg-[#f7fbfc] px-5 py-5 lg:overflow-y-auto sm:px-6">
              {regenerateOpen && selectedRoteiro ? (
                <RegeneratePanel
                  busy={regenerating}
                  hasAlterations={Boolean(selectedRoteiro.has_alterations)}
                  onCancel={() => setRegenerateOpen(false)}
                  onConfirm={(instruction) => void regeneratePost(instruction)}
                />
              ) : null}
              {/* Matérias analisadas pela IA ("já falamos disso?") mostram o bloco ao lado; as antigas, o aviso por palavras. */}
              {!selectedRoteiro?.related_kind ? <ContentSimilarityWarning contentId={selectedRoteiro?.id} /> : null}
              {selectedRoteiro?.content_snippet ? (
                <div className="rounded-lg border border-[#dce9eb] bg-white p-4">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Newspaper className="size-3.5" aria-hidden />
                    Resumo da notícia
                  </p>
                  <p className="text-sm leading-relaxed text-slate-700">{selectedRoteiro.content_snippet}</p>
                </div>
              ) : null}
              {selectedRoteiro?.has_alterations && !isEditingPost ? (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <Pencil className="size-3.5 shrink-0" aria-hidden />
                  <span>
                    Texto ajustado{selectedRoteiro.edited_by_name ? ` por ${selectedRoteiro.edited_by_name}` : ""}
                    {selectedRoteiro.edited_at
                      ? ` em ${format(new Date(selectedRoteiro.edited_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}`
                      : ""}{" "}
                    (diferente da versão original da IA).
                  </span>
                </div>
              ) : null}

              {!postReady ? (
                <div className="flex items-center gap-2 rounded-lg border border-[#dce9eb] bg-white p-5 text-sm text-slate-500">
                  {loadingDetail ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <AlertCircle className="size-4" aria-hidden />}
                  {loadingDetail ? "Carregando o texto do post…" : "Não foi possível carregar o texto do post."}
                </div>
              ) : selectedRoteiro && isEditingPost ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Pencil className="size-3.5" aria-hidden />
                      Editando o texto do post
                    </p>
                    <span className="text-xs text-slate-500">{draftPost.length} caracteres</span>
                  </div>
                  <textarea
                    value={draftPost}
                    onChange={(e) => setDraftPost(e.target.value)}
                    rows={20}
                    aria-label="Texto do post"
                    className="w-full resize-y rounded-lg border border-[#dce9eb] bg-white p-4 font-mono text-[13px] leading-relaxed outline-none focus-visible:border-[#47cdd0] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/20"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      Ao confirmar, este passa a ser o texto do post e o Marketing fica sabendo que você ajustou.
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
                      <Button size="sm" onClick={() => void saveEdit()} disabled={savingEdit}>
                        {savingEdit ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Confirmar este texto
                      </Button>
                    </div>
                  </div>
                </div>
              ) : selectedRoteiro ? (
                <CarouselPost text={selectedRoteiro.post} author={postAuthor} />
              ) : null}
            </div>

            <aside className="space-y-5 border-t border-[#eef4f5] bg-white px-5 py-5 lg:overflow-y-auto lg:border-t-0 lg:border-l">
              {selectedHistory ? (
                <div>
                  <p className="mb-3 text-xs font-semibold text-slate-500">Histórico</p>
                  <RoteiroHistorico item={selectedHistory} />
                </div>
              ) : null}

              {selectedRoteiro?.related_ref && selectedRoteiro.related_kind && selectedRoteiro.related_kind !== "novo" ? (
                <RelatedBlock
                  kind={selectedRoteiro.related_kind}
                  reference={selectedRoteiro.related_ref}
                  note={selectedRoteiro.related_note ?? null}
                  people={(selectedRoteiro.related_ref.people ?? []).flatMap((person) => {
                    const resolved = resolvePerson(person.id, person.name);
                    return resolved ? [resolved] : [];
                  })}
                />
              ) : null}

              {typeof selectedRoteiro?.relevance_score === "number" ? (
                <div className="space-y-1.5 border-t border-[#eef4f5] pt-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Sparkles className="size-3.5" aria-hidden />
                    Por que a IA trouxe esta matéria
                  </p>
                  <p className="text-sm text-slate-700">
                    <span className="mr-1.5 inline-flex rounded-full bg-[#e8f8f8] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#285f7a]">
                      {selectedRoteiro.relevance_score}/10
                    </span>
                    {selectedRoteiro.relevance_reason}
                  </p>
                </div>
              ) : null}

              {selectedRoteiro?.performance_hint ? <PerformanceHint hint={selectedRoteiro.performance_hint} className="text-xs" /> : null}

              {selectedRoteiro && !isEditingPost ? (
                <div className="space-y-2 border-t border-[#eef4f5] pt-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Link2 className="size-3.5" aria-hidden />
                    Tarefa do VIOS
                  </p>
                  {selectedRoteiro.status === "enviado_mkt" ? (
                    <p className="text-sm text-slate-700">
                      {(() => {
                        const t = viosTasks.find((x) => x.id === selectedRoteiro.vios_task_id);
                        if (t) return `${t.vios_id} · ${t.tarefa}`;
                        return selectedRoteiro.vios_task_id ? "Tarefa vinculada" : "Nenhuma";
                      })()}
                    </p>
                  ) : viosTasks.length === 0 ? (
                    <p className="text-xs text-slate-500">Você não tem tarefas do VIOS em aberto para vincular.</p>
                  ) : (
                    <>
                      <Select
                        value={selectedRoteiro.vios_task_id ?? "none"}
                        onValueChange={(v) => void linkVios(v === "none" ? null : v)}
                        disabled={linkingVios}
                      >
                        <SelectTrigger className="h-10 text-sm" aria-label="Tarefa do VIOS">
                          <SelectValue placeholder="Selecione uma tarefa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {viosTasks.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.vios_id} · {t.tarefa.length > 40 ? `${t.tarefa.slice(0, 40)}…` : t.tarefa}
                              {t.data_limite ? ` · ${format(new Date(t.data_limite), "dd/MM", { locale: ptBR })}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs leading-snug text-slate-500">
                        Vincule se a sua área manda conteúdo ao gestor pelo VIOS. Ao enviar ao Marketing, a tarefa fica ligada ao card no Planner.
                      </p>
                    </>
                  )}
                </div>
              ) : null}
            </aside>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StageButton({
  label,
  icon: Icon,
  count,
  active,
  alert,
  onClick,
  className,
}: {
  label: string;
  icon: LucideIcon;
  count: number;
  active: boolean;
  alert?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors",
        active ? "bg-[#347796] text-white" : "text-slate-700 hover:bg-[#f4fafb]",
        className
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          active ? "bg-white/15" : alert ? "bg-amber-50 text-amber-700" : "bg-[#eaf2f5] text-[#285f7a]"
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className={cn("block text-xs font-medium", active ? "text-white/85" : "text-slate-500")}>{label}</span>
        <span className="block text-lg leading-tight font-semibold tabular-nums">{count}</span>
      </span>
    </button>
  );
}

function AreaChip({
  area,
  label,
  count,
  active,
  onClick,
}: {
  area?: string;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-[#347796] bg-[#347796] text-white"
          : "border-[#dce9eb] bg-white text-slate-700 hover:border-[#47cdd0]/60 hover:bg-[#47cdd0]/10"
      )}
    >
      {area ? (
        <span className={cn("flex size-5 items-center justify-center rounded-full", active ? "bg-white/20 text-white" : getAreaIconStyle(area))}>
          <AreaIcon area={area} className="size-3" aria-hidden />
        </span>
      ) : null}
      {label}
      {typeof count === "number" ? <span className={cn("tabular-nums", active ? "text-white/80" : "text-slate-400")}>{count}</span> : null}
    </button>
  );
}

function BuscaDialog({
  open,
  onOpenChange,
  topics,
  onStarted,
  onFinished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topics: ContentTopic[];
  onStarted: (message: string) => void;
  onFinished: (message: string, failed: boolean) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [lastRun, setLastRun] = useState<FetchRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeTopics = topics.filter((topic) => topic.is_active);

  useEffect(() => {
    if (!open) return;
    setError(null);
    fetch("/api/content-roteiros/runs?limit=1", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((runs: FetchRun[]) => setLastRun(Array.isArray(runs) && runs[0] ? runs[0] : null))
      .catch(() => setLastRun(null));
  }, [open]);

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  const runFetch = async () => {
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
          topicIds: selected.length > 0 ? selected : undefined,
          accessToken: session.access_token,
          refreshToken: session.refresh_token ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 202) {
        onOpenChange(false);
        onStarted(data.message ?? "Busca iniciada em segundo plano. A lista atualiza sozinha em alguns minutos.");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar notícias");
      onOpenChange(false);
      const skipped = data.skipped ? `, ${data.skipped} repetidas ignoradas` : "";
      if (data.errors?.length) {
        onFinished(`Criadas: ${data.created}${skipped}. Erros: ${data.errors.slice(0, 3).join("; ")}`, true);
      } else {
        onFinished(`${data.created ?? 0} matérias novas${skipped}.`, false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setFetching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="border-b border-[#eef4f5] px-5 py-4 pr-12">
          <DialogTitle className="text-base font-semibold">Buscar notícias</DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            A busca automática roda todo dia. Use aqui quando quiser matérias novas agora.
          </DialogDescription>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          {lastRun ? (
            <p className="flex items-start gap-2 rounded-md bg-[#f2f9fb] px-3 py-2 text-sm text-[#1f4c61]">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Última busca {formatDistanceToNow(new Date(lastRun.started_at), { addSuffix: true, locale: ptBR })}
                {lastRun.trigger === "manual" ? "" : " (automática)"}: {lastRun.created} carrosséis
                {lastRun.low_score ? `, ${lastRun.low_score} abaixo da nota mínima` : ""}, {lastRun.skipped} repetidas
                {lastRun.error_count > 0 ? `, ${lastRun.error_count} com erro` : ""}.
              </span>
            </p>
          ) : null}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-900">Temas</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={selected.length === 0}
                onClick={() => setSelected([])}
                className={cn(
                  "h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                  selected.length === 0 ? "border-[#347796] bg-[#347796] text-white" : "border-[#dce9eb] bg-white text-slate-700 hover:bg-[#47cdd0]/10"
                )}
              >
                Todos os temas
              </button>
              {activeTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  aria-pressed={selected.includes(topic.id)}
                  onClick={() => toggle(topic.id)}
                  className={cn(
                    "h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                    selected.includes(topic.id)
                      ? "border-[#347796] bg-[#347796] text-white"
                      : "border-[#dce9eb] bg-white text-slate-700 hover:bg-[#47cdd0]/10"
                  )}
                >
                  {topic.name}
                </button>
              ))}
            </div>
            {activeTopics.length === 0 ? <p className="mt-2 text-xs text-slate-500">Nenhum tema ativo cadastrado.</p> : null}
          </div>
          {error ? (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef4f5] px-5 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={CONTENT_SETTINGS_PATH}>
              <Settings className="size-4" aria-hidden />
              Fontes, nota e IA
            </Link>
          </Button>
          <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => void runFetch()} disabled={fetching || activeTopics.length === 0}>
            {fetching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {fetching ? "Buscando…" : selected.length > 0 ? `Buscar em ${selected.length} ${selected.length === 1 ? "tema" : "temas"}` : "Buscar agora"}
          </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Já falamos disso": o post nosso (ou a matéria escolhida) a que a notícia se refere. */
function RelatedBlock({
  kind,
  reference,
  note,
  people,
}: {
  kind: "repetido" | "desdobramento";
  reference: NonNullable<RoteiroItem["related_ref"]>;
  note: string | null;
  people: EscolhaPerson[];
}) {
  const when = reference.date ? format(new Date(reference.date), "dd/MM/yyyy") : null;
  const origin = reference.source === "instagram" ? "Post no nosso Instagram" : "Matéria escolhida pela equipe";
  const href = reference.source === "instagram" ? reference.url : `/conteudo/roteiros?contentId=${encodeURIComponent(reference.id)}`;
  return (
    <div className="space-y-1.5 border-t border-[#eef4f5] pt-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        {kind === "desdobramento" ? <History className="size-3.5" aria-hidden /> : <Repeat className="size-3.5" aria-hidden />}
        {kind === "desdobramento" ? "Desdobramento de um assunto nosso" : "Já falamos disso"}
      </p>
      <a
        href={href ?? undefined}
        target={reference.source === "instagram" ? "_blank" : undefined}
        rel="noopener noreferrer"
        className="block rounded-md bg-[#f7fbfc] px-3 py-2 transition-colors hover:bg-[#eef6f8]"
      >
        <span className="block text-xs text-slate-500">
          {origin}
          {when ? ` · ${when}` : ""}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm font-medium text-slate-800">{reference.title}</span>
      </a>
      {people.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {people.map((person) => (
            <span key={person.id ?? person.name} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <PersonAvatar person={person} className="size-5" />
              {person.name}
            </span>
          ))}
          {kind === "desdobramento" ? <span className="text-xs text-slate-500">· avisado no sistema</span> : null}
        </div>
      ) : null}
      {kind === "desdobramento" && note ? (
        <p className="text-sm text-slate-700">
          <span className="font-medium text-[#48466e]">O que há de novo: </span>
          {note}
        </p>
      ) : kind === "repetido" ? (
        <p className="text-xs text-slate-500">A IA não achou fato novo em relação ao que já publicamos.</p>
      ) : null}
    </div>
  );
}

/** "Refazer com IA" dentro do próprio detalhe (sem empilhar modal): pedidos prontos ou texto livre. */
function RegeneratePanel({
  busy,
  hasAlterations,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  hasAlterations: boolean;
  onCancel: () => void;
  onConfirm: (instruction: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  return (
    <div className="space-y-3 rounded-lg border border-[#cfe4ea] bg-white p-4">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <WandSparkles className="size-4 text-[#347796]" aria-hidden />
          Refazer com IA
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          A IA lê a matéria de novo e escreve com as regras e o aprendizado atuais. Diga o que quer diferente (opcional).
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {REGENERATE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setInstruction(preset)}
            aria-pressed={instruction === preset}
            className={cn(
              "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
              instruction === preset ? "border-[#347796] bg-[#347796] text-white" : "border-[#dce9eb] bg-white text-slate-700 hover:bg-[#47cdd0]/10",
            )}
          >
            {preset}
          </button>
        ))}
      </div>
      <Textarea
        rows={2}
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        placeholder="Ex.: comece pela decisão do STJ e explique o risco para quem tem contrato de seguro"
        aria-label="O que mudar no texto"
        disabled={busy}
      />
      {hasAlterations ? (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          O texto ajustado pela equipe será substituído pela nova versão da IA.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => onConfirm(instruction)} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <WandSparkles className="size-4" aria-hidden />}
          {busy ? "Escrevendo… (até 1 min)" : "Refazer texto"}
        </Button>
      </div>
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
      <div className="rounded-lg border border-[#dce9eb] bg-white p-5">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      </div>
    );
  }

  const [cover, ...rest] = slides;
  const coverSubtitle = cover.body.map((b) => b.content).join(" ");

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <FileText className="size-3.5" aria-hidden />
        Prévia do carrossel · {slides.length} slides · arraste para o lado
      </p>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3">
        {/* Slide 01: capa no padrão da marca */}
        <article className="relative flex aspect-[4/5] w-[230px] shrink-0 snap-start flex-col overflow-hidden rounded-lg bg-gradient-to-br from-[#1a2f44] to-[#1c1c1c] p-5 text-white shadow-md sm:w-[260px]">
          <span className="absolute right-3 top-3 text-xs font-bold text-white/40">01</span>
          <div className="mb-3 h-16 w-16 overflow-hidden rounded-full border-2 border-white/30 bg-white/10">
            {author?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={author.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-white/70">{initials(author?.name)}</div>
            )}
          </div>
          <h4 className="line-clamp-4 text-lg leading-tight font-bold">{cover.title}</h4>
          {coverSubtitle ? <p className="mt-2 line-clamp-4 text-xs leading-snug text-white/75">{coverSubtitle}</p> : null}
          <div className="mt-auto border-t border-white/15 pt-3">
            <p className="text-sm leading-tight font-semibold">{author?.name ?? "Seu nome"}</p>
            <p className="text-xs text-white/60">{author?.role ?? "Sua área"}</p>
          </div>
        </article>

        {/* Slides de conteúdo */}
        {rest.map((slide, idx) => (
          <article
            key={idx}
            className="flex aspect-[4/5] w-[230px] shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-sm sm:w-[260px]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#eef4f5] bg-[#f7fbfc] px-4 py-2">
              <span className="truncate text-xs font-semibold text-[#285f7a]">{slide.heading || "Slide"}</span>
              <span className="text-xs font-bold text-slate-400">{String(idx + 2).padStart(2, "0")}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              <h4 className="text-sm leading-snug font-bold text-slate-900">{slide.title}</h4>
              <div className="space-y-1.5 text-xs leading-relaxed text-slate-600">
                {slide.body.map((b, i) =>
                  b.type === "bullet" ? (
                    <p key={i} className="flex gap-1.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#347796]/60" />
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
      <p className="text-xs text-slate-500">
        O slide 01 é a capa com foto, nome e área de quem escolheu a matéria. Os textos vêm do post; ajuste em{" "}
        <span className="font-medium">Editar texto</span> se precisar.
      </p>
    </div>
  );
}
