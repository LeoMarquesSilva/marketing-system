"use client";

import { useCallback, useState } from "react";
import { Pause, PencilLine, Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canManageSpace, type OpsAccess } from "@/lib/ops-planner/domain";
import { describeRule } from "@/lib/ops-planner/recurrence";
import type { OpsPlannerContext, OpsRoutine, OpsRoutineSummary } from "@/lib/ops-planner/types";
import { cn } from "@/lib/utils";
import { errorMessage, opsApi } from "./ops-client";
import { AvatarStack, formatDate, usePlannerMaps } from "./ops-ui";
import { RoutineEditorDialog } from "./routine-editor-dialog";

const ALL = "__todos";

function OccurrenceDots({ routine, today }: { routine: OpsRoutineSummary; today: string }) {
  if (routine.recent.length === 0) return <span className="text-xs text-muted-foreground">Ainda não venceu nenhuma vez</span>;
  return (
    <span className="flex items-center gap-1" aria-label="Últimas ocorrências">
      {[...routine.recent].reverse().map((item) => {
        const open = item.status !== "concluida" && item.status !== "cancelada";
        const late = open && item.occurrence_date < today;
        const label = item.on_time === true ? "no prazo" : item.on_time === false ? "com atraso" : late ? "atrasada" : open ? "em aberto" : "cancelada";
        return (
          <span
            key={item.task_id}
            title={`${formatDate(item.occurrence_date, today)}: ${label}`}
            className={cn(
              "size-2.5 rounded-full",
              item.on_time === true && "bg-emerald-500",
              item.on_time === false && "bg-amber-500",
              item.on_time === null && late && "bg-red-500",
              item.on_time === null && !late && "bg-slate-300"
            )}
          />
        );
      })}
    </span>
  );
}

export function RoutinesClient({ context, initialRoutines }: { context: OpsPlannerContext; initialRoutines: OpsRoutineSummary[] }) {
  const [routines, setRoutines] = useState(initialRoutines);
  const [filter, setFilter] = useState(ALL);
  const [editing, setEditing] = useState<OpsRoutine | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const maps = usePlannerMaps(context);
  const access: OpsAccess = { userId: context.me.id, isAdmin: context.is_admin, memberships: context.memberships };
  const defaultSpace = filter !== ALL ? filter : context.memberships[0]?.space_id ?? context.spaces[0]?.id;

  const reload = useCallback(async () => {
    try {
      const { routines: fresh } = await opsApi.get<{ routines: OpsRoutineSummary[] }>("/routines");
      setRoutines(fresh);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);

  const spaces = context.spaces.filter((space) => filter === ALL || space.id === filter);
  const canEdit = (routine: OpsRoutine) => canManageSpace(access, routine.space_id) || routine.created_by === context.me.id;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por espaço">
          {[{ id: ALL, name: "Todos os espaços" }, ...context.spaces.map((space) => ({ id: space.id, name: space.name }))].map((option) => (
            <Button key={option.id} type="button" size="sm" variant={filter === option.id ? "secondary" : "ghost"} aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>
              {option.name}
            </Button>
          ))}
        </div>
        {defaultSpace && (
          <Button type="button" className="ml-auto" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Nova rotina
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
          {error}
        </p>
      )}

      {routines.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#dce9eb] bg-white px-4 py-12 text-center">
          <Repeat className="mx-auto size-6 text-[#48466e]" aria-hidden />
          <p className="mt-2 font-medium">Nenhuma rotina cadastrada.</p>
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
            Cadastre o que a equipe faz sempre — &quot;Fechar a folha no 5º dia útil&quot;, &quot;Conferir o caixa toda sexta&quot;, &quot;Renovar o alvará todo ano em março&quot;. O Planner gera a
            tarefa no prazo certo e avisa os responsáveis.
          </p>
        </div>
      )}

      {spaces.map((space) => {
        const items = routines.filter((routine) => routine.space_id === space.id);
        if (items.length === 0) return null;
        return (
          <section key={space.id} className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white">
            <h2 className="flex items-center gap-2 border-b border-[#eef3f4] bg-[#f6fafb] px-4 py-2.5 text-sm font-semibold">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: space.color }} />
              {space.name}
              <span className="text-xs font-normal text-muted-foreground">{items.length}</span>
            </h2>
            <ul>
              {items.map((routine) => (
                <li key={routine.id} className="flex flex-col gap-2 border-b border-[#eef3f4] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {!routine.active && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          <Pause className="size-3" aria-hidden />
                          Pausada
                        </span>
                      )}
                      <span className="truncate">{routine.title}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {describeRule(routine)}
                      {routine.lead_days > 0 && ` · aparece ${routine.lead_days} dia${routine.lead_days === 1 ? "" : "s"} antes`}
                      {routine.list_id && maps.lists.get(routine.list_id) && ` · ${maps.lists.get(routine.list_id)?.name}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-xs text-muted-foreground">
                      {routine.active && routine.next_dates.length > 0 ? `Próximas: ${routine.next_dates.map((date) => formatDate(date, context.today)).join(", ")}` : routine.active ? "Sem próximas datas" : ""}
                    </span>
                    <OccurrenceDots routine={routine} today={context.today} />
                    <AvatarStack ids={routine.assignee_ids} people={maps.people} />
                    {canEdit(routine) && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(routine)}>
                        <PencilLine className="size-4" />
                        Editar
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {routines.length > 0 && (
        <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          Últimas ocorrências:
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-emerald-500" /> no prazo</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-amber-500" /> concluída com atraso</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-red-500" /> atrasada</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-slate-300" /> em aberto</span>
        </p>
      )}

      {editing && defaultSpace && (
        <RoutineEditorDialog
          routine={editing === "new" ? null : editing}
          defaultSpaceId={defaultSpace}
          context={context}
          assignable={maps.assignable}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
          onArchived={(id) => {
            setEditing(null);
            setRoutines((current) => current.filter((routine) => routine.id !== id));
          }}
        />
      )}
    </div>
  );
}
