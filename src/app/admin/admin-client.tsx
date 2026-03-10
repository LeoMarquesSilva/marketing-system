"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  AppSettings,
  WorkflowStageConfig,
  PlannerTabId,
  CompletionTypeConfig,
  KanbanVisibility,
  StageMoveRules,
} from "@/lib/app-settings";
import {
  updateWorkflowStages,
  updatePlannerTabs,
  updateCompletionTypes,
} from "@/lib/app-settings";

const TAB_LABELS: Record<PlannerTabId, string> = {
  kanban: "Kanban",
  concluidos: "Concluídos",
  posts: "Posts",
};

interface AdminClientProps {
  initialSettings: AppSettings;
}

export function AdminClient({ initialSettings }: AdminClientProps) {
  const router = useRouter();
  const [workflowStages, setWorkflowStages] = useState<WorkflowStageConfig[]>(
    initialSettings.workflowStages
  );
  const [plannerTabs, setPlannerTabs] = useState<PlannerTabId[]>(
    initialSettings.plannerTabs
  );
  const [completionTypes, setCompletionTypes] = useState<CompletionTypeConfig[]>(
    initialSettings.completionTypes
  );
  const [kanbanVisibility, setKanbanVisibility] = useState<KanbanVisibility>(
    initialSettings.kanbanVisibility
  );
  const [stageMoveRules, setStageMoveRules] = useState<StageMoveRules>(
    initialSettings.stageMoveRules
  );

  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [plannerSaving, setPlannerSaving] = useState(false);
  const [kanbanRulesError, setKanbanRulesError] = useState<string | null>(null);
  const [kanbanRulesSaving, setKanbanRulesSaving] = useState(false);

  const handleWorkflowStageChange = useCallback(
    (index: number, field: keyof WorkflowStageConfig, value: string | number | boolean) => {
      setWorkflowStages((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const handleSaveWorkflow = async () => {
    setWorkflowError(null);
    setWorkflowSaving(true);
    const { error } = await updateWorkflowStages(workflowStages);
    setWorkflowSaving(false);
    if (error) {
      setWorkflowError(error);
      return;
    }
    router.refresh();
  };

  const TAB_ORDER: PlannerTabId[] = ["kanban", "concluidos", "posts"];
  const togglePlannerTab = useCallback((tab: PlannerTabId) => {
    setPlannerTabs((prev) => {
      const next = prev.includes(tab)
        ? prev.filter((t) => t !== tab)
        : [...prev, tab];
      return next.sort((a, b) => TAB_ORDER.indexOf(a) - TAB_ORDER.indexOf(b));
    });
  }, []);

  const handleCompletionTypeChange = useCallback(
    (index: number, field: "value" | "label", value: string) => {
      setCompletionTypes((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const addCompletionType = useCallback(() => {
    setCompletionTypes((prev) => [
      ...prev,
      { value: `tipo_${Date.now()}`, label: "Novo tipo" },
    ]);
  }, []);

  const removeCompletionType = useCallback((index: number) => {
    setCompletionTypes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSavePlanner = async () => {
    setPlannerError(null);
    setPlannerSaving(true);
    const [tabsRes, typesRes] = await Promise.all([
      updatePlannerTabs(plannerTabs),
      updateCompletionTypes(completionTypes),
    ]);
    setPlannerSaving(false);
    if (tabsRes.error || typesRes.error) {
      setPlannerError(tabsRes.error ?? typesRes.error ?? "Erro ao salvar.");
      return;
    }
    router.refresh();
  };

  const revisaoRule = stageMoveRules.revisao ?? { showArtLinkDialog: true, keepAssignee: false };
  const setRevisaoRule = (field: "showArtLinkDialog" | "keepAssignee", value: boolean) => {
    setStageMoveRules((prev) => ({
      ...prev,
      revisao: { ...(prev.revisao ?? {}), [field]: value },
    }));
  };

  const handleSaveKanbanRules = async () => {
    setKanbanRulesError(null);
    setKanbanRulesSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setKanbanRulesError("Sessão expirada. Faça login novamente.");
        setKanbanRulesSaving(false);
        return;
      }
      const res = await fetch("/api/admin/kanban-rules", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kanbanVisibility,
          stageMoveRules,
          accessToken: session.access_token,
          refreshToken: session.refresh_token ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setKanbanRulesError(data.error ?? "Erro ao salvar.");
        return;
      }
      router.refresh();
    } catch {
      setKanbanRulesError("Erro ao salvar.");
    } finally {
      setKanbanRulesSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workflow (Kanban) */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow (Kanban)</CardTitle>
          <CardDescription>
            Etapas exibidas no board. Ordem e rótulos. &quot;Exibir no Kanban&quot; define
            se a etapa aparece como coluna (Concluído não deve ser coluna).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {workflowError && (
            <p className="text-sm text-destructive" role="alert">
              {workflowError}
            </p>
          )}
          <div className="space-y-3">
            {workflowStages.map((stage, index) => (
              <div
                key={stage.value}
                className="flex flex-wrap items-center gap-4 rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <Label className="text-muted-foreground w-8">Ordem</Label>
                  <Input
                    type="number"
                    min={0}
                    className="w-16"
                    value={stage.sortOrder}
                    onChange={(e) =>
                      handleWorkflowStageChange(
                        index,
                        "sortOrder",
                        parseInt(e.target.value, 10) || 0
                      )
                    }
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <Label className="sr-only">Valor (chave)</Label>
                  <Input
                    value={stage.value}
                    onChange={(e) =>
                      handleWorkflowStageChange(index, "value", e.target.value)
                    }
                    placeholder="value"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <Label className="sr-only">Rótulo</Label>
                  <Input
                    value={stage.label}
                    onChange={(e) =>
                      handleWorkflowStageChange(index, "label", e.target.value)
                    }
                    placeholder="Rótulo"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stage.showInKanban}
                    disabled={stage.value === "concluido"}
                    onChange={(e) =>
                      handleWorkflowStageChange(
                        index,
                        "showInKanban",
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm">Exibir no Kanban</span>
                </label>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveWorkflow} disabled={workflowSaving}>
            {workflowSaving ? "Salvando…" : "Salvar etapas"}
          </Button>
        </CardFooter>
      </Card>

      {/* Regras do Planner */}
      <Card>
        <CardHeader>
          <CardTitle>Regras do Planner</CardTitle>
          <CardDescription>
            Abas visíveis no Planner e opções ao marcar solicitação como concluída.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {plannerError && (
            <p className="text-sm text-destructive" role="alert">
              {plannerError}
            </p>
          )}

          <div>
            <Label className="text-base font-semibold">Abas do Planner</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Selecione as abas que aparecem para os designers.
            </p>
            <div className="flex flex-wrap gap-4">
              {(["kanban", "concluidos", "posts"] as const).map((tab) => (
                <label
                  key={tab}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={plannerTabs.includes(tab)}
                    onChange={() => togglePlannerTab(tab)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm">{TAB_LABELS[tab]}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-base font-semibold">Tipos de conclusão</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Opções ao marcar uma solicitação como concluída.
            </p>
            <div className="space-y-2">
              {completionTypes.map((ct, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-center gap-2 rounded border p-2"
                >
                  <Input
                    value={ct.value}
                    onChange={(e) =>
                      handleCompletionTypeChange(index, "value", e.target.value)
                    }
                    placeholder="value"
                    className="font-mono w-40 text-sm"
                  />
                  <Input
                    value={ct.label}
                    onChange={(e) =>
                      handleCompletionTypeChange(index, "label", e.target.value)
                    }
                    placeholder="Rótulo"
                    className="flex-1 min-w-[120px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeCompletionType(index)}
                    disabled={completionTypes.length <= 1}
                  >
                    Remover
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addCompletionType}>
                Adicionar tipo
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSavePlanner} disabled={plannerSaving}>
            {plannerSaving ? "Salvando…" : "Salvar regras"}
          </Button>
        </CardFooter>
      </Card>

      {/* Regras do Kanban */}
      <Card>
        <CardHeader>
          <CardTitle>Regras do Kanban</CardTitle>
          <CardDescription>
            Quem vê as tarefas no board, diálogos ao mover entre etapas e se o responsável é mantido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {kanbanRulesError && (
            <p className="text-sm text-destructive" role="alert">
              {kanbanRulesError}
            </p>
          )}

          <div>
            <Label className="text-base font-semibold">Quem visualiza o Kanban</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Define quais tarefas cada um vê no board.
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="kanban_visibility"
                  checked={kanbanVisibility === "designer_own_admin_all"}
                  onChange={() => setKanbanVisibility("designer_own_admin_all")}
                  className="h-4 w-4"
                />
                <span className="text-sm">Admin vê tudo; designer vê só as tarefas em que é responsável (+ pipeline de revisão)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="kanban_visibility"
                  checked={kanbanVisibility === "everyone_all"}
                  onChange={() => setKanbanVisibility("everyone_all")}
                  className="h-4 w-4"
                />
                <span className="text-sm">Todos veem todas as tarefas do board</span>
              </label>
            </div>
          </div>

          <div>
            <Label className="text-base font-semibold">Ao mover tarefa para Revisão</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Comportamento do diálogo e do responsável ao arrastar para a etapa Revisão.
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={revisaoRule.showArtLinkDialog}
                  onChange={(e) => setRevisaoRule("showArtLinkDialog", e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Exigir link da arte (abrir diálogo antes de mover)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={revisaoRule.keepAssignee}
                  onChange={(e) => setRevisaoRule("keepAssignee", e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="text-sm">Manter responsável (não trocar para o solicitante ao mover para Revisão)</span>
              </label>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveKanbanRules} disabled={kanbanRulesSaving}>
            {kanbanRulesSaving ? "Salvando…" : "Salvar regras do Kanban"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
