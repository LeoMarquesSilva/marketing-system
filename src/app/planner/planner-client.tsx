"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { KanbanBoard } from "@/components/planner/kanban-board";
import { ConcluidosTab } from "@/components/planner/concluidos-tab";
import { KanbanCardDetail } from "@/components/planner/kanban-card-detail";
import { NewRequestDialog } from "@/components/planner/new-request-dialog";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { updateMarketingRequest } from "@/lib/marketing-requests";
import type { User } from "@/lib/users";
import type { AppSettings } from "@/lib/app-settings";
import { Button } from "@/components/ui/button";
import { LayoutGrid, CheckCircle2, PlusCircle, Share2, Wifi, WifiOff } from "lucide-react";
import { PostsTab } from "@/components/planner/posts-tab";
import { PostAvailableDetailDialog } from "@/components/planner/post-available-detail-dialog";
import { useAuth } from "@/contexts/auth-context";
import { fetchTimeTotalsByRequest } from "@/lib/time-entries";
import { fetchCommentStats } from "@/lib/request-comments";
import { supabase } from "@/utils/supabase/client";

const TAB_ICONS = {
  kanban: LayoutGrid,
  concluidos: CheckCircle2,
  posts: Share2,
} as const;

interface PlannerClientProps {
  initialRequests: MarketingRequest[];
  designers: User[];
  users: User[];
  appSettings: AppSettings;
}

type RealtimeStatus = "connecting" | "connected" | "unavailable";

export function PlannerClient({ initialRequests, designers, users, appSettings }: PlannerClientProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const enabledTabs = appSettings.plannerTabs;
  const firstTab = enabledTabs[0] ?? "kanban";
  const [activeTab, setActiveTab] = useState<"kanban" | "concluidos" | "posts">(firstTab);

  useEffect(() => {
    if (!enabledTabs.includes(activeTab)) {
      setActiveTab(firstTab);
    }
  }, [enabledTabs, activeTab, firstTab]);

  const workflowColumns = useMemo(() => {
    return appSettings.workflowStages
      .filter((s) => s.showInKanban)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({
        id: s.value,
        title: s.label,
      }));
  }, [appSettings.workflowStages]);

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [postAvailableRequestId, setPostAvailableRequestId] = useState<string | null>(null);
  const [postAvailableOpen, setPostAvailableOpen] = useState(false);
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [timeTotals, setTimeTotals] = useState<Record<string, string>>({});
  const [commentsCounts, setCommentsCounts] = useState<Record<string, number>>({});
  const [pendingAlterationsCounts, setPendingAlterationsCounts] = useState<Record<string, number>>({});
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [lastRealtimeSyncAt, setLastRealtimeSyncAt] = useState<Date | null>(null);
  const requestsRef = useRef<MarketingRequest[]>([]);

  const requests = useMemo(() => {
    if (appSettings.kanbanVisibility === "everyone_all") {
      return initialRequests;
    }
    const r = (profile?.role ?? "").toLowerCase();
    const isDesigner = r === "designer" || profile?.department === "Marketing";
    if (isDesigner && profile?.id) {
      return initialRequests.filter((req) => req.assignee_id === profile.id);
    }
    return initialRequests;
  }, [initialRequests, profile, appSettings.kanbanVisibility]);

  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  const loadPlannerMetadata = useCallback(
    async (targetRequests: MarketingRequest[]) => {
      if (targetRequests.length === 0) {
        return {
          commentsCounts: {},
          pendingAlterationsCounts: {},
          timeTotals: {},
        };
      }

      const ids = targetRequests.map((r) => r.id);
      const assigneeRequestIds = profile?.id
        ? targetRequests.filter((r) => r.assignee_id === profile.id).map((r) => r.id)
        : [];

      const [commentStats, timeTotalsResult] = await Promise.all([
        fetchCommentStats(ids),
        profile?.id && assigneeRequestIds.length > 0
          ? fetchTimeTotalsByRequest(assigneeRequestIds, profile.id)
          : Promise.resolve({}),
      ]);

      return {
        commentsCounts: commentStats.commentsCounts,
        pendingAlterationsCounts: commentStats.pendingAlterationsCounts,
        timeTotals: timeTotalsResult,
      };
    },
    [profile?.id]
  );

  const applyPlannerMetadata = useCallback(
    (metadata: Awaited<ReturnType<typeof loadPlannerMetadata>>) => {
      setCommentsCounts(metadata.commentsCounts);
      setPendingAlterationsCounts(metadata.pendingAlterationsCounts);
      setTimeTotals(metadata.timeTotals);
    },
    []
  );

  useEffect(() => {
    let active = true;

    loadPlannerMetadata(requests)
      .then((metadata) => {
        if (active) applyPlannerMetadata(metadata);
      })
      .catch((error) => {
        console.error("Erro ao carregar metadados do Planner:", error);
      });

    return () => {
      active = false;
    };
  }, [requests, loadPlannerMetadata, applyPlannerMetadata]);

  const selectedRequest =
    selectedRequestId != null
      ? requests.find((r) => r.id === selectedRequestId) ?? null
      : null;

  const handleRefresh = useCallback(() => {
    router.refresh();
    loadPlannerMetadata(requestsRef.current)
      .then(applyPlannerMetadata)
      .catch((error) => {
        console.error("Erro ao recarregar Planner:", error);
      });
  }, [router, loadPlannerMetadata, applyPlannerMetadata]);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("planner-marketing-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketing_requests" },
        () => {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            handleRefresh();
            setLastRealtimeSyncAt(new Date());
          }, 500);
        }
      )
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtimeStatus("unavailable");
          if (error) console.error("Erro no Realtime do Planner:", error);
        }
      });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [handleRefresh]);

  const handleCardClick = (request: MarketingRequest) => {
    setSelectedRequestId(request.id);
    setDetailOpen(true);
  };

  const handlePostsCardClick = (request: MarketingRequest, options: { isPostado: boolean }) => {
    if (options.isPostado) {
      setSelectedRequestId(request.id);
      setDetailOpen(true);
    } else {
      setPostAvailableRequestId(request.id);
      setPostAvailableOpen(true);
    }
  };

  const handleMarkComplete = async (requestId: string, completionType: string) => {
    const { error } = await updateMarketingRequest(requestId, {
      workflow_stage: "concluido",
      completion_type: completionType as "design_concluido" | "postagem_feita" | "conteudo_entregue",
    });
    if (!error) handleRefresh();
  };

  const tabLabels = { kanban: "Kanban", concluidos: "Concluídos", posts: "Posts" } as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2 border-b flex-1">
          {enabledTabs.map((tab) => {
            const Icon = TAB_ICONS[tab];
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tabLabels[tab]}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              realtimeStatus === "connected"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
            }`}
            title={lastRealtimeSyncAt ? `Última atualização em tempo real: ${lastRealtimeSyncAt.toLocaleTimeString("pt-BR")}` : undefined}
          >
            {realtimeStatus === "connected" ? (
              <Wifi className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <WifiOff className="h-3.5 w-3.5" aria-hidden />
            )}
            {realtimeStatus === "connected" ? "Tempo real ativo" : "Tempo real indisponível"}
          </div>
          <Button onClick={() => setNewRequestOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Nova Solicitação
          </Button>
        </div>
      </div>

      {activeTab === "kanban" && (
        <KanbanBoard
          requests={requests}
          onRefresh={handleRefresh}
          onCardClick={handleCardClick}
          onMarkComplete={handleMarkComplete}
          timeTotals={timeTotals}
          commentsCounts={commentsCounts}
          pendingAlterationsCounts={pendingAlterationsCounts}
          workflowColumns={workflowColumns}
          completionTypes={appSettings.completionTypes}
          stageMoveRules={appSettings.stageMoveRules}
          stageSlaDays={appSettings.stageSlaDays}
          kanbanDisplayOptions={appSettings.kanbanDisplayOptions}
          showColumnRefresh={realtimeStatus === "unavailable"}
          onColumnRefresh={handleRefresh}
        />
      )}
      {activeTab === "concluidos" && (
        <ConcluidosTab
          requests={requests}
          onCardClick={handleCardClick}
          completionTypes={appSettings.completionTypes}
        />
      )}
      {activeTab === "posts" && (
        <PostsTab
          requests={requests}
          onCardClick={handlePostsCardClick}
          onRefresh={handleRefresh}
        />
      )}

      <KanbanCardDetail
        request={selectedRequest}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedRequestId(null);
        }}
        onRefresh={handleRefresh}
        designers={designers}
        completionTypes={appSettings.completionTypes}
      />

      <PostAvailableDetailDialog
        request={postAvailableRequestId != null ? requests.find((r) => r.id === postAvailableRequestId) ?? null : null}
        open={postAvailableOpen}
        onOpenChange={(open) => {
          setPostAvailableOpen(open);
          if (!open) setPostAvailableRequestId(null);
        }}
        onSuccess={handleRefresh}
      />

      <NewRequestDialog
        open={newRequestOpen}
        onOpenChange={setNewRequestOpen}
        onSuccess={handleRefresh}
        users={users}
        designers={designers}
      />
    </div>
  );
}
