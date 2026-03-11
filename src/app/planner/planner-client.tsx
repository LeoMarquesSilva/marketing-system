"use client";

import { useState, useMemo, useEffect } from "react";
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
import { LayoutGrid, CheckCircle2, PlusCircle, Share2 } from "lucide-react";
import { PostsTab } from "@/components/planner/posts-tab";
import { PostAvailableDetailDialog } from "@/components/planner/post-available-detail-dialog";
import { useAuth } from "@/contexts/auth-context";
import { fetchTimeTotalsByRequest } from "@/lib/time-entries";
import { fetchCommentStats } from "@/lib/request-comments";

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
    if (!profile?.id || requests.length === 0) return;
    const assigneeRequestIds = requests
      .filter((r) => r.assignee_id === profile.id)
      .map((r) => r.id);
    if (assigneeRequestIds.length === 0) return;
    fetchTimeTotalsByRequest(assigneeRequestIds, profile.id).then(setTimeTotals);
  }, [requests, profile?.id]);

  useEffect(() => {
    if (requests.length === 0) return;
    const ids = requests.map((r) => r.id);
    fetchCommentStats(ids).then(({ commentsCounts, pendingAlterationsCounts }) => {
      setCommentsCounts(commentsCounts);
      setPendingAlterationsCounts(pendingAlterationsCounts);
    });
  }, [requests]);

  const selectedRequest =
    selectedRequestId != null
      ? requests.find((r) => r.id === selectedRequestId) ?? null
      : null;

  const handleRefresh = () => {
    router.refresh();
    if (requests.length > 0) {
      const ids = requests.map((r) => r.id);
      fetchCommentStats(ids).then(({ commentsCounts, pendingAlterationsCounts }) => {
        setCommentsCounts(commentsCounts);
        setPendingAlterationsCounts(pendingAlterationsCounts);
      });
    }
  };

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
        <Button onClick={() => setNewRequestOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Nova Solicitação
        </Button>
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
          kanbanDisplayOptions={appSettings.kanbanDisplayOptions}
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
        onOpenChange={setDetailOpen}
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
