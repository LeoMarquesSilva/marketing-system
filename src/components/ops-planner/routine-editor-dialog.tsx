"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarCheck2, Loader2, Trash2 } from "lucide-react";
import { EventTaskAssignees } from "@/components/eventos/event-task-assignees";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { describeRule, MONTHS, validateRule, WEEKDAY_SHORT, WEEKDAY_SINGULAR } from "@/lib/ops-planner/recurrence";
import {
  OPS_FREQUENCIES,
  OPS_FREQUENCY_LABEL,
  OPS_PRIORITIES,
  OPS_PRIORITY_LABEL,
  OPS_TIPO_LABEL,
  OPS_TIPOS,
  type OpsFrequency,
  type OpsMonthlyMode,
  type OpsPlannerContext,
  type OpsPriority,
  type OpsRecurrenceRule,
  type OpsRoutine,
  type OpsShift,
  type OpsTipo,
} from "@/lib/ops-planner/types";
import type { User } from "@/lib/users";
import { cn } from "@/lib/utils";
import { errorMessage, opsApi } from "./ops-client";
import { formatDate } from "./ops-ui";

const NO_LIST = "__sem_lista";
const LAST = "-1";

interface RoutineDraft extends OpsRecurrenceRule {
  space_id: string;
  list_id: string | null;
  title: string;
  description: string;
  priority: OpsPriority;
  tipo: OpsTipo;
  assignee_ids: string[];
  checklist: string;
  due_time: string;
  lead_days: number;
  active: boolean;
}

function toDraft(routine: OpsRoutine | null, spaceId: string, today: string, meId: string): RoutineDraft {
  if (routine) {
    return {
      ...routine,
      description: routine.description ?? "",
      checklist: routine.checklist.join("\n"),
      due_time: routine.due_time?.slice(0, 5) ?? "",
    };
  }
  return {
    space_id: spaceId,
    list_id: null,
    title: "",
    description: "",
    priority: "media",
    tipo: "operacional",
    assignee_ids: [meId],
    checklist: "",
    due_time: "",
    frequency: "mensal",
    every_n: 1,
    weekdays: [],
    only_business_days: false,
    monthly_mode: "dia_util",
    month_day: 1,
    business_day_n: 5,
    week_of_month: 1,
    weekday: 1,
    month: Number(today.slice(5, 7)),
    shift_non_business: "adiar",
    lead_days: 2,
    starts_on: today,
    ends_on: null,
    active: true,
  };
}

function toPayload(draft: RoutineDraft) {
  return {
    ...draft,
    description: draft.description.trim() || null,
    checklist: draft.checklist
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    due_time: draft.due_time || null,
    weekdays: draft.frequency === "semanal" ? draft.weekdays : [],
  };
}

function Field({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-[#315f73]">
        {label}
      </Label>
      {children}
    </div>
  );
}

const UNIT: Record<OpsFrequency, [string, string]> = {
  diaria: ["dia", "dias"],
  semanal: ["semana", "semanas"],
  mensal: ["mês", "meses"],
  anual: ["ano", "anos"],
};

export function RoutineEditorDialog({
  routine,
  defaultSpaceId,
  context,
  assignable,
  onClose,
  onSaved,
  onArchived,
}: {
  routine: OpsRoutine | null;
  defaultSpaceId: string;
  context: OpsPlannerContext;
  assignable: User[];
  onClose: () => void;
  onSaved: (routine: OpsRoutine) => void;
  onArchived: (routineId: string) => void;
}) {
  const [draft, setDraft] = useState<RoutineDraft>(() => toDraft(routine, defaultSpaceId, context.today, context.me.id));
  const [preview, setPreview] = useState<{ dates: string[]; error: string | null; loading: boolean }>({ dates: [], error: null, loading: true });
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof RoutineDraft>(key: K, value: RoutineDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const monthly = draft.frequency === "mensal" || draft.frequency === "anual";
  const lists = context.lists.filter((list) => list.space_id === draft.space_id);
  const rule = useMemo<OpsRecurrenceRule>(
    () => ({
      frequency: draft.frequency,
      every_n: draft.every_n,
      weekdays: draft.weekdays,
      only_business_days: draft.only_business_days,
      monthly_mode: draft.monthly_mode,
      month_day: draft.month_day,
      business_day_n: draft.business_day_n,
      week_of_month: draft.week_of_month,
      weekday: draft.weekday,
      month: draft.month,
      shift_non_business: draft.shift_non_business,
      starts_on: draft.starts_on,
      ends_on: draft.ends_on,
    }),
    [draft]
  );
  const ruleKey = JSON.stringify(rule);

  // Prévia com os feriados do servidor; espera a digitação parar.
  useEffect(() => {
    const problem = validateRule(rule);
    if (problem) {
      setPreview({ dates: [], error: problem, loading: false });
      return;
    }
    setPreview((current) => ({ ...current, loading: true }));
    const timer = setTimeout(() => {
      opsApi
        .post<{ dates: string[]; error: string | null }>("/routines/preview", rule)
        .then((result) => setPreview({ ...result, loading: false }))
        .catch((cause) => setPreview({ dates: [], error: errorMessage(cause), loading: false }));
    }, 350);
    return () => clearTimeout(timer);
    // ruleKey resume a regra; `rule` muda de identidade a cada render do formulário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleKey]);

  async function save() {
    if (!draft.title.trim()) return setError("Informe o título.");
    const problem = validateRule(rule);
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      const payload = toPayload(draft);
      const { routine: saved } = routine
        ? await opsApi.patch<{ routine: OpsRoutine }>(`/routines/${routine.id}`, payload)
        : await opsApi.post<{ routine: OpsRoutine }>("/routines", payload);
      onSaved(saved);
    } catch (cause) {
      setError(errorMessage(cause));
      setSaving(false);
    }
  }

  async function archive() {
    if (!routine) return;
    setSaving(true);
    setError(null);
    try {
      await opsApi.del(`/routines/${routine.id}`);
      onArchived(routine.id);
    } catch (cause) {
      setError(errorMessage(cause));
      setSaving(false);
      setConfirmArchive(false);
    }
  }

  const [unitOne, unitMany] = UNIT[draft.frequency];

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl" showCloseButton={!saving}>
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-lg">{routine ? "Editar rotina" : "Nova rotina"}</DialogTitle>
          <DialogDescription>
            A rotina gera uma tarefa a cada ocorrência e avisa os responsáveis. Mudanças valem para as próximas; as já geradas ficam como estão.
          </DialogDescription>
        </DialogHeader>

        <form
          id="ops-routine-form"
          className="relative min-h-0 flex-1 overflow-y-auto"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <Field label="Título da tarefa" htmlFor="ops-routine-title" className="sm:col-span-2">
              <Input
                id="ops-routine-title"
                autoFocus={!routine}
                value={draft.title}
                maxLength={300}
                placeholder="Ex.: Fechar a folha de pagamento"
                onChange={(event) => set("title", event.target.value)}
              />
            </Field>
            <Field label="Espaço">
              <Select value={draft.space_id} onValueChange={(value) => setDraft((current) => ({ ...current, space_id: value, list_id: null }))}>
                <SelectTrigger aria-label="Espaço" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {context.spaces.map((space) => (
                    <SelectItem key={space.id} value={space.id}>
                      {space.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Lista">
              <Select value={draft.list_id ?? NO_LIST} onValueChange={(value) => set("list_id", value === NO_LIST ? null : value)}>
                <SelectTrigger aria-label="Lista" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LIST}>Sem lista</SelectItem>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Responsáveis" className="sm:col-span-2">
              <EventTaskAssignees users={assignable} value={draft.assignee_ids} onChange={(ids) => set("assignee_ids", ids)} />
            </Field>
          </div>

          <div className="border-t border-[#e6eef0] bg-[#fafcfc] px-6 py-5">
            <h3 className="mb-3 text-sm font-semibold">Quando se repete</h3>
            <div className="space-y-4">
              <div role="radiogroup" aria-label="Frequência" className="flex flex-wrap gap-1">
                {OPS_FREQUENCIES.map((frequency) => (
                  <button
                    key={frequency}
                    type="button"
                    role="radio"
                    aria-checked={draft.frequency === frequency}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        frequency,
                        // Ao trocar para mensal/anual sem forma escolhida, começa no 5º dia útil.
                        monthly_mode: current.monthly_mode ?? "dia_util",
                        business_day_n: current.business_day_n ?? 5,
                        month: current.month ?? Number(context.today.slice(5, 7)),
                      }))
                    }
                    className={cn(
                      "h-9 rounded-md border px-3 text-sm font-medium",
                      draft.frequency === frequency ? "border-[#47cdd0] bg-[#e8f8f8] text-[#285f7a]" : "border-[#dce9eb] bg-white text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {OPS_FREQUENCY_LABEL[frequency]}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>A cada</span>
                <Input
                  type="number"
                  min={1}
                  max={36}
                  value={draft.every_n}
                  aria-label="Intervalo"
                  onChange={(event) => set("every_n", Math.max(1, Math.min(36, Number(event.target.value) || 1)))}
                  className="h-9 w-20"
                />
                <span>{draft.every_n === 1 ? unitOne : unitMany}</span>
                {draft.frequency === "diaria" && (
                  <label className="ml-2 flex items-center gap-2">
                    <input type="checkbox" className="size-4 accent-[#347796]" checked={draft.only_business_days} onChange={(event) => set("only_business_days", event.target.checked)} />
                    Só dias úteis
                  </label>
                )}
              </div>

              {draft.frequency === "semanal" && (
                <div role="group" aria-label="Dias da semana" className="flex flex-wrap gap-1">
                  {WEEKDAY_SHORT.map((label, day) => {
                    const on = draft.weekdays.includes(day);
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={on}
                        aria-label={WEEKDAY_SINGULAR[day]}
                        onClick={() => set("weekdays", on ? draft.weekdays.filter((item) => item !== day) : [...draft.weekdays, day].sort())}
                        className={cn(
                          "h-9 w-12 rounded-md border text-sm font-medium capitalize",
                          on ? "border-[#47cdd0] bg-[#e8f8f8] text-[#285f7a]" : "border-[#dce9eb] bg-white text-muted-foreground"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {monthly && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {draft.frequency === "anual" && (
                    <Field label="Mês">
                      <Select value={String(draft.month ?? 1)} onValueChange={(value) => set("month", Number(value))}>
                        <SelectTrigger aria-label="Mês" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((month, index) => (
                            <SelectItem key={month} value={String(index + 1)} className="capitalize">
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                  <Field label="Cai em" className={draft.frequency === "anual" ? "" : "sm:col-span-2"}>
                    <Select value={draft.monthly_mode ?? "dia_util"} onValueChange={(value) => set("monthly_mode", value as OpsMonthlyMode)}>
                      <SelectTrigger aria-label="Como a data cai no mês" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dia_util">Um dia útil do mês (ex.: 5º dia útil)</SelectItem>
                        <SelectItem value="dia_do_mes">Um dia fixo do mês (ex.: dia 10)</SelectItem>
                        <SelectItem value="semana_do_mes">Um dia da semana (ex.: 1ª segunda)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {draft.monthly_mode === "dia_util" && (
                    <Field label="Qual dia útil">
                      <Select value={String(draft.business_day_n ?? 1)} onValueChange={(value) => set("business_day_n", Number(value))}>
                        <SelectTrigger aria-label="Qual dia útil" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 23 }, (_, index) => (
                            <SelectItem key={index + 1} value={String(index + 1)}>
                              {index + 1}º dia útil
                            </SelectItem>
                          ))}
                          <SelectItem value={LAST}>Último dia útil</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                  {draft.monthly_mode === "dia_do_mes" && (
                    <Field label="Dia">
                      <Select value={String(draft.month_day ?? 1)} onValueChange={(value) => set("month_day", Number(value))}>
                        <SelectTrigger aria-label="Dia do mês" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 31 }, (_, index) => (
                            <SelectItem key={index + 1} value={String(index + 1)}>
                              Dia {index + 1}
                            </SelectItem>
                          ))}
                          <SelectItem value={LAST}>Último dia do mês</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                  {draft.monthly_mode === "semana_do_mes" && (
                    <>
                      <Field label="Semana">
                        <Select value={String(draft.week_of_month ?? 1)} onValueChange={(value) => set("week_of_month", Number(value))}>
                          <SelectTrigger aria-label="Semana do mês" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4].map((week) => (
                              <SelectItem key={week} value={String(week)}>
                                {week}ª
                              </SelectItem>
                            ))}
                            <SelectItem value={LAST}>Última</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Dia da semana">
                        <Select value={String(draft.weekday ?? 1)} onValueChange={(value) => set("weekday", Number(value))}>
                          <SelectTrigger aria-label="Dia da semana" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WEEKDAY_SINGULAR.map((day, index) => (
                              <SelectItem key={day} value={String(index)}>
                                {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </>
                  )}
                </div>
              )}

              {(draft.frequency === "semanal" || (monthly && draft.monthly_mode !== "dia_util")) && (
                <Field label="Se cair em fim de semana ou feriado">
                  <Select value={draft.shift_non_business} onValueChange={(value) => set("shift_non_business", value as OpsShift)}>
                    <SelectTrigger aria-label="Se cair em fim de semana ou feriado" className="w-full sm:w-80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adiar">Adiar para o próximo dia útil</SelectItem>
                      <SelectItem value="antecipar">Antecipar para o dia útil anterior</SelectItem>
                      <SelectItem value="manter">Manter a data</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Aparece quantos dias antes" htmlFor="ops-routine-lead">
                  <Input
                    id="ops-routine-lead"
                    type="number"
                    min={0}
                    max={60}
                    value={draft.lead_days}
                    onChange={(event) => set("lead_days", Math.max(0, Math.min(60, Number(event.target.value) || 0)))}
                  />
                </Field>
                <Field label="Começa em">
                  <DatePickerField value={draft.starts_on} onChange={(value) => value && set("starts_on", value)} />
                </Field>
                <Field label="Termina em (opcional)">
                  <DatePickerField value={draft.ends_on ?? ""} onChange={(value) => set("ends_on", value || null)} />
                </Field>
              </div>

              <div className="rounded-md bg-white px-4 py-3 ring-1 ring-inset ring-[#dce9eb]" aria-live="polite">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#285f7a]">
                  <CalendarCheck2 className="size-4" aria-hidden />
                  {validateRule(rule) ? "Regra incompleta" : describeRule(rule)}
                </p>
                {preview.loading ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Calculando as próximas datas
                  </p>
                ) : preview.error ? (
                  <p className="mt-1 text-xs text-red-700">{preview.error}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Próximos vencimentos: {preview.dates.length ? preview.dates.map((date) => formatDate(date, context.today)).join(", ") : "nenhum"}
                    {draft.lead_days > 0 && ` · a tarefa aparece ${draft.lead_days} dia${draft.lead_days === 1 ? "" : "s"} antes`}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-[#e6eef0] px-6 py-5 sm:grid-cols-3">
            <Field label="Prioridade">
              <Select value={draft.priority} onValueChange={(value) => set("priority", value as OpsPriority)}>
                <SelectTrigger aria-label="Prioridade" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPS_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {OPS_PRIORITY_LABEL[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo">
              <Select value={draft.tipo} onValueChange={(value) => set("tipo", value as OpsTipo)}>
                <SelectTrigger aria-label="Tipo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPS_TIPOS.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {OPS_TIPO_LABEL[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Horário (opcional)" htmlFor="ops-routine-time">
              <Input id="ops-routine-time" type="time" value={draft.due_time} onChange={(event) => set("due_time", event.target.value)} />
            </Field>
            <Field label="Checklist (um item por linha)" htmlFor="ops-routine-checklist" className="sm:col-span-3">
              <Textarea
                id="ops-routine-checklist"
                rows={3}
                value={draft.checklist}
                placeholder={"Conferir os lançamentos\nEnviar para aprovação"}
                onChange={(event) => set("checklist", event.target.value)}
              />
            </Field>
            <Field label="Descrição" htmlFor="ops-routine-description" className="sm:col-span-3">
              <Textarea id="ops-routine-description" rows={3} value={draft.description} maxLength={10000} onChange={(event) => set("description", event.target.value)} />
            </Field>
            {routine && (
              <label className="flex items-center gap-2 text-sm sm:col-span-3">
                <input type="checkbox" className="size-4 accent-[#347796]" checked={draft.active} onChange={(event) => set("active", event.target.checked)} />
                Rotina ativa (pausada não gera tarefas; ao reativar, não recupera o que venceu no período)
              </label>
            )}
          </div>
        </form>

        {error && (
          <p role="alert" className="mx-6 mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6eef0] bg-[#fafcfc] px-6 py-4">
          <div>
            {routine &&
              (confirmArchive ? (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="destructive" disabled={saving} onClick={() => void archive()}>
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    Confirmar exclusão
                  </Button>
                  <Button type="button" variant="ghost" disabled={saving} onClick={() => setConfirmArchive(false)}>
                    Manter
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="ghost" className="gap-2 px-3 text-red-700 hover:bg-red-50 hover:text-red-800" disabled={saving} onClick={() => setConfirmArchive(true)}>
                  <Trash2 className="size-4" />
                  <span className="hidden sm:inline">Excluir rotina</span>
                </Button>
              ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form="ops-routine-form" disabled={saving || confirmArchive}>
              {saving && !confirmArchive && <Loader2 className="size-4 animate-spin" />}
              {routine ? "Salvar rotina" : "Criar rotina"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
