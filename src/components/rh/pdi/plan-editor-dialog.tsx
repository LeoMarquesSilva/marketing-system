"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addMonths, todayInBrasilia } from "@/lib/rh/pdi/progress";
import {
  CIVIL_VALUES,
  PDI_LEARNING_KINDS,
  PDI_LEARNING_KIND_ORDER,
  type PdiLearningKind,
  type PdiPerson,
  type PdiPlanDetail,
  type PdiPlanInput,
  type PdiType,
} from "@/lib/rh/pdi/types";
import { cn } from "@/lib/utils";
import { KIND_STYLES, kindIconOf } from "./pdi-visuals";

interface DraftAction {
  key: string;
  id?: string;
  title: string;
  description: string;
  learning_kind: PdiLearningKind | null;
  expected_evidence: string;
  success_indicator: string;
  due_date: string;
  open: boolean;
}

interface DraftGoal {
  key: string;
  id?: string;
  title: string;
  description: string;
  competency: string;
  actions: DraftAction[];
}

const NONE = "__nenhum__";
let keySeq = 0;
const newKey = () => `k${++keySeq}`;

function emptyAction(): DraftAction {
  return {
    key: newKey(),
    title: "",
    description: "",
    learning_kind: null,
    expected_evidence: "",
    success_indicator: "",
    due_date: "",
    open: true,
  };
}

function emptyGoal(): DraftGoal {
  return { key: newKey(), title: "", description: "", competency: "", actions: [emptyAction()] };
}

function fromPlan(plan: PdiPlanDetail): DraftGoal[] {
  return plan.goals.map((goal) => ({
    key: newKey(),
    id: goal.id,
    title: goal.title,
    description: goal.description ?? "",
    competency: goal.competency ?? "",
    actions: goal.actions.map((action) => ({
      key: newKey(),
      id: action.id,
      title: action.title,
      description: action.description ?? "",
      learning_kind: action.learning_kind,
      expected_evidence: action.expected_evidence ?? "",
      success_indicator: action.success_indicator ?? "",
      due_date: action.due_date ?? "",
      open: false,
    })),
  }));
}

const DURATIONS = [
  { label: "3 meses", months: 3 },
  { label: "6 meses", months: 6 },
  { label: "1 ano", months: 12 },
];

export function PlanEditorDialog({
  plan,
  people,
  managerOptions,
  types,
  defaultEmployeeId,
  onClose,
  onCreated,
  onSaved,
}: {
  /** Ausente = criar plano novo. */
  plan?: PdiPlanDetail;
  /** Para quem dá para criar (só na criação). */
  people: PdiPerson[];
  /** Quem pode ser o acompanhante; ausente = o gestor direto do cadastro. */
  managerOptions?: PdiPerson[];
  types: PdiType[];
  defaultEmployeeId?: string | null;
  onClose: () => void;
  onCreated?: (id: string) => void;
  onSaved?: (plan: PdiPlanDetail) => void;
}) {
  const today = todayInBrasilia();
  const [employeeId, setEmployeeId] = useState(plan?.employee.id ?? defaultEmployeeId ?? people[0]?.id ?? "");
  const [managerId, setManagerId] = useState<string>(plan?.manager?.id ?? NONE);
  const [typeId, setTypeId] = useState<string>(plan?.type_id ?? types[0]?.id ?? NONE);
  const [title, setTitle] = useState(plan?.title ?? `PDI ${today.slice(0, 4)}`);
  const [careerGoal, setCareerGoal] = useState(plan?.career_goal ?? "");
  const [startDate, setStartDate] = useState(plan?.start_date ?? today);
  const [dueDate, setDueDate] = useState(plan?.due_date ?? addMonths(today, 6));
  const [goals, setGoals] = useState<DraftGoal[]>(() => (plan ? fromPlan(plan) : [emptyGoal()]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actionCount = useMemo(() => goals.reduce((total, goal) => total + goal.actions.length, 0), [goals]);
  const activeTypes = types.filter((type) => type.is_active || type.id === plan?.type_id);

  function updateGoal(key: string, patch: Partial<DraftGoal>) {
    setGoals((current) => current.map((goal) => (goal.key === key ? { ...goal, ...patch } : goal)));
  }
  function updateAction(goalKey: string, actionKey: string, patch: Partial<DraftAction>) {
    setGoals((current) =>
      current.map((goal) =>
        goal.key === goalKey
          ? { ...goal, actions: goal.actions.map((action) => (action.key === actionKey ? { ...action, ...patch } : action)) }
          : goal
      )
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload: PdiPlanInput = {
      employee_id: employeeId,
      ...(managerOptions ? { manager_employee_id: managerId === NONE ? null : managerId } : {}),
      type_id: typeId === NONE ? null : typeId,
      title,
      career_goal: careerGoal.trim() || null,
      start_date: startDate,
      due_date: dueDate,
      goals: goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        description: goal.description.trim() || null,
        competency: goal.competency || null,
        actions: goal.actions.map((action) => ({
          id: action.id,
          title: action.title,
          description: action.description.trim() || null,
          learning_kind: action.learning_kind,
          expected_evidence: action.expected_evidence.trim() || null,
          success_indicator: action.success_indicator.trim() || null,
          due_date: action.due_date || null,
        })),
      })),
    };
    try {
      const response = await fetch(plan ? `/api/pdi/${plan.id}` : "/api/pdi", {
        method: plan ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar o plano.");
      if (plan) onSaved?.(body.plan as PdiPlanDetail);
      else onCreated?.(body.id as string);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar o plano.");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl" showCloseButton={!saving}>
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-lg">{plan ? "Editar plano" : "Novo PDI"}</DialogTitle>
          <DialogDescription>
            Frentes são as competências a desenvolver; cada uma tem ações práticas com prazo e evidência.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-5">
          <section className="grid gap-4 sm:grid-cols-2">
            {!plan && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Colaborador</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Escolha a pessoa" />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                        {person.department ? ` · ${person.department}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pdi-title">Título</Label>
              <Input id="pdi-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem tipo</SelectItem>
                  {activeTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {managerOptions && (
              <div className="space-y-1.5">
                <Label>Quem acompanha</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{plan ? "Ninguém" : "Gestor direto do cadastro"}</SelectItem>
                    {managerOptions
                      .filter((person) => person.id !== employeeId)
                      .map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pdi-start">Início</Label>
              <Input id="pdi-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdi-due">Prazo</Label>
              <Input id="pdi-due" type="date" value={dueDate} min={startDate} onChange={(event) => setDueDate(event.target.value)} />
              <div className="flex gap-1.5">
                {DURATIONS.map((duration) => (
                  <button
                    key={duration.months}
                    type="button"
                    onClick={() => setDueDate(addMonths(startDate, duration.months))}
                    className="rounded-md px-2 py-1 text-xs text-[#285f7a] hover:bg-[#47cdd0]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60"
                  >
                    {duration.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pdi-career">Onde quero chegar (opcional)</Label>
              <Textarea
                id="pdi-career"
                value={careerGoal}
                onChange={(event) => setCareerGoal(event.target.value)}
                rows={2}
                placeholder="Ex.: assumir a coordenação das audiências da área até o fim de 2027."
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Frentes de desenvolvimento</h3>
              <span className="text-xs text-muted-foreground">
                {goals.length} {goals.length === 1 ? "frente" : "frentes"} · {actionCount} {actionCount === 1 ? "ação" : "ações"}
              </span>
            </div>

            {goals.map((goal, goalIndex) => (
              <div key={goal.key} className="space-y-4 rounded-lg border border-[#dce9eb] bg-[#fbfdfd] p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">{goalIndex + 1}</span>
                  <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[1fr_200px]">
                    <div className="space-y-1.5">
                      <Label htmlFor={`goal-${goal.key}`} className="sr-only">
                        Nome da frente
                      </Label>
                      <Input
                        id={`goal-${goal.key}`}
                        value={goal.title}
                        onChange={(event) => updateGoal(goal.key, { title: event.target.value })}
                        placeholder="Competência a desenvolver (ex.: Planejamento e organização)"
                        className="bg-white font-medium"
                      />
                    </div>
                    <Select
                      value={goal.competency || NONE}
                      onValueChange={(value) => updateGoal(goal.key, { competency: value === NONE ? "" : value })}
                    >
                      <SelectTrigger className="w-full bg-white" aria-label="Valor CIVIL">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sem valor CIVIL</SelectItem>
                        {CIVIL_VALUES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={goal.description}
                      onChange={(event) => updateGoal(goal.key, { description: event.target.value })}
                      rows={2}
                      placeholder="Por que esta frente: o que a avaliação ou o gestor apontou."
                      className="bg-white sm:col-span-2"
                      aria-label="Descrição da frente"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remover frente"
                    disabled={goals.length === 1}
                    onClick={() => setGoals((current) => current.filter((item) => item.key !== goal.key))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <ul className="space-y-3 sm:pl-6">
                  {goal.actions.map((action) => (
                    <li key={action.key} className="rounded-md border border-[#e3edf0] bg-white">
                      <div className="flex items-center gap-2 p-2">
                        <Input
                          value={action.title}
                          onChange={(event) => updateAction(goal.key, action.key, { title: event.target.value })}
                          placeholder="Ação (ex.: conduzir a reunião mensal de resultados)"
                          aria-label="Nome da ação"
                          className="border-transparent shadow-none focus-visible:border-[#47cdd0]"
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={action.open ? "Esconder detalhes da ação" : "Mostrar detalhes da ação"}
                          aria-expanded={action.open}
                          onClick={() => updateAction(goal.key, action.key, { open: !action.open })}
                        >
                          {action.open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remover ação"
                          disabled={goal.actions.length === 1}
                          onClick={() =>
                            updateGoal(goal.key, { actions: goal.actions.filter((item) => item.key !== action.key) })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      {action.open && (
                        <div className="space-y-3 border-t border-[#eef3f5] px-3 pb-3 pt-3">
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">De onde vem o aprendizado (70-20-10)</p>
                            <div className="grid gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="Tipo 70-20-10">
                              {PDI_LEARNING_KIND_ORDER.map((kind) => {
                                const Icon = kindIconOf(kind);
                                const selected = action.learning_kind === kind;
                                return (
                                  <button
                                    key={kind}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => updateAction(goal.key, action.key, { learning_kind: selected ? null : kind })}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                                      selected ? "border-[#347796] bg-[#eef5f8]" : "border-[#e3edf0] hover:border-[#47cdd0]/60"
                                    )}
                                    title={PDI_LEARNING_KINDS[kind].hint}
                                  >
                                    <span className={cn("grid size-6 place-items-center rounded", KIND_STYLES[kind].tile)}>
                                      <Icon className="size-3.5" aria-hidden />
                                    </span>
                                    <span>
                                      <span className="block font-medium text-foreground">{PDI_LEARNING_KINDS[kind].label}</span>
                                      <span className="font-mono tabular-nums text-muted-foreground">{PDI_LEARNING_KINDS[kind].share}</span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <Textarea
                            value={action.description}
                            onChange={(event) => updateAction(goal.key, action.key, { description: event.target.value })}
                            rows={3}
                            placeholder="Como fazer: passos, com quem, onde."
                            aria-label="Descrição da ação"
                          />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Evidência esperada</Label>
                              <Input
                                value={action.expected_evidence}
                                onChange={(event) => updateAction(goal.key, action.key, { expected_evidence: event.target.value })}
                                placeholder="Ex.: certificado, ata, apresentação"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Indicador de conclusão</Label>
                              <Input
                                value={action.success_indicator}
                                onChange={(event) => updateAction(goal.key, action.key, { success_indicator: event.target.value })}
                                placeholder="Ex.: 3 reuniões conduzidas"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Prazo da ação (opcional)</Label>
                              <Input
                                type="date"
                                value={action.due_date}
                                min={startDate}
                                max={dueDate}
                                onChange={(event) => updateAction(goal.key, action.key, { due_date: event.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                  <li>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateGoal(goal.key, { actions: [...goal.actions, emptyAction()] })}
                    >
                      <Plus className="size-4" aria-hidden />
                      Ação
                    </Button>
                  </li>
                </ul>
              </div>
            ))}

            <Button variant="secondary" onClick={() => setGoals((current) => [...current, emptyGoal()])} disabled={goals.length >= 15}>
              <Plus className="size-4" aria-hidden />
              Frente de desenvolvimento
            </Button>
          </section>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-[#e6eef0] px-6 py-4 sm:justify-between">
          <p className="min-w-0 text-sm text-red-700" role="alert">
            {error}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving || !employeeId}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {plan ? "Salvar plano" : "Criar PDI"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
