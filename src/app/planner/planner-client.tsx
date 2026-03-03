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
import { Button } from "@/components/ui/button";
import { LayoutGrid, CheckCircle2, PlusCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { fetchTimeTotalsByRequest } from "@/lib/time-entries";
import { fetchCommentStats } from "@/lib/request-comments";

interface PlannerClientProps {
  initialRequests: MarketingRequest[];
  designers: User[];
  users: User[];
}

export function PlannerClient({ initialRequests, designers, users }: PlannerClientProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"kanban" | "concluidos">("kanban");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [timeTotals, setTimeTotals] = useState<Record<string, string>>({});
  const [commentsCounts, setCommentsCounts] = useState<Record<string, number>>({});
  const [pendingAlterationsCounts, setPendingAlterationsCounts] = useState<Record<string, number>>({});

  const requests = useMemo(() => {
    const r = (profile?.role ?? "").toLowerCase();
    const isDesigner = r === "designer" || profile?.department === "Marketing";
    if (isDesigner && profile?.id) {
      return initialRequests.filter((req) => req.assignee_id === profile.id);
    }
    return initialRequests;
  }, [initialRequests, profile?.id, profile?.role, profile?.department]);

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

  const handleMarkComplete = async (requestId: string, completionType: string) => {
    const { error } = await updateMarketingRequest(requestId, {
      workflow_stage: "concluido",
      completion_type: completionType as "design_concluido" | "postagem_feita" | "conteudo_entregue",
    });
    if (!error) handleRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2 border-b flex-1">
        <button
          type="button"
          onClick={() => setActiveTab("kanban")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "kanban"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Kanban
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("concluidos")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "concluidos"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Concluídos
        </button>
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
        />
      )}
      {activeTab === "concluidos" && (
        <ConcluidosTab
          requests={requests}
          onCardClick={handleCardClick}
        />
      )}

      <KanbanCardDetail
        request={selectedRequest}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRefresh={handleRefresh}
        designers={designers}
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
