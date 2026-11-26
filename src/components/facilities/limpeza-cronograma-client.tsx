"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CircleAlert, Ellipsis, Eye, EyeOff, Info, Loader2, PencilLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CLEANING_KIND_INFO, CLEANING_KINDS, WEEKDAY_LONG, WEEKDAY_SHORT, type CleaningKind } from "@/lib/facilities/cleaning";
import { cleaningApi } from "@/lib/facilities/cleaning-client";
import type { CleaningArea, CleaningScheduleView } from "@/lib/facilities/cleaning-server";
import { cn } from "@/lib/utils";
import { Segmented } from "./form-parts";
import { AreaTile, KIND_STYLE, KindLegend, KindLetter } from "./cleaning-visuals";
import { GuiaLimpeza } from "./guia-limpeza";

type Week = "1" | "2" | "3" | "4";

const SURFACE = "rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(4,32,47,0.05)]";

/** Uma célula da grade: toque abre as quatro opções. */
function KindCell({ kind, label, onPick }: { kind: CleaningKind | null; label: string; onPick: (kind: CleaningKind) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${kind ? CLEANING_KIND_INFO[kind].label : "sem tipo"}. Trocar`}
          className="mx-auto grid size-11 place-items-center rounded-lg outline-none transition-colors hover:bg-[#eef5f7] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
        >
          {busy ? <Loader2 className="size-5 animate-spin text-[#5a717b]" /> : <KindLetter kind={kind} size="md" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-60 p-2">
        <p className="px-1.5 pb-2 text-xs text-[#5a717b]">{label}</p>
        <div className="space-y-0.5">
          {CLEANING_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={kind === option}
              onClick={async () => {
                setOpen(false);
                if (option === kind) return;
                setBusy(true);
                try {
                  await onPick(option);
                } finally {
                  setBusy(false);
                }
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm outline-none transition-colors focus-visible:bg-[#f2f8f9]",
                kind === option ? "bg-[#f2f8f9] font-semibold text-[#0d2a38]" : "text-[#3b5560] hover:bg-[#f6fafb]"
              )}
            >
              <KindLetter kind={option} size="sm" />
              Limpeza {CLEANING_KIND_INFO[option].label.toLowerCase()}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Ações do ambiente num menu só (subir, descer, renomear, tirar da lista). */
function AreaMenu({
  area,
  first,
  last,
  busy,
  onMove,
  onRename,
  onHide,
}: {
  area: CleaningArea;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (direction: "subir" | "descer") => void;
  onRename: () => void;
  onHide: () => void;
}) {
  const [open, setOpen] = useState(false);
  const item =
    "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-[#3b5560] outline-none hover:bg-[#f6fafb] focus-visible:bg-[#f2f8f9] disabled:opacity-40";
  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-9 text-[#5a717b]" aria-label={`Opções de ${area.name}`} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Ellipsis className="size-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1.5">
        <button type="button" className={item} disabled={first} onClick={act(() => onMove("subir"))}>
          <ArrowUp className="size-4" aria-hidden />
          Subir na lista
        </button>
        <button type="button" className={item} disabled={last} onClick={act(() => onMove("descer"))}>
          <ArrowDown className="size-4" aria-hidden />
          Descer na lista
        </button>
        <button type="button" className={item} onClick={act(onRename)}>
          <PencilLine className="size-4" aria-hidden />
          Renomear
        </button>
        <div className="my-1 border-t border-[#eef3f5]" />
        <button type="button" className={cn(item, "text-red-700 hover:bg-red-50")} onClick={act(onHide)}>
          <EyeOff className="size-4" aria-hidden />
          Tirar da lista
        </button>
      </PopoverContent>
    </Popover>
  );
}

function AreaNameDialog({ area, busy, onCancel, onSave }: { area: CleaningArea | null; busy: boolean; onCancel: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(area?.name ?? "");
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="gap-0 p-0 sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-lg">{area ? "Renomear ambiente" : "Novo ambiente"}</DialogTitle>
          <DialogDescription>
            {area ? "O nome muda em todas as semanas." : "Entra com limpeza simples em todos os dias; depois é só tocar nas letras para ajustar."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 px-5 py-4">
          <AreaTile name={name || "Ambiente"} />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Sala de Reunião 3" aria-label="Nome do ambiente" autoFocus />
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" disabled={busy || name.trim().length < 2} onClick={() => onSave(name.trim())}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LimpezaCronogramaClient({ initialSchedule, guideSeen }: { initialSchedule: CleaningScheduleView; guideSeen: boolean }) {
  const [schedule, setSchedule] = useState(initialSchedule);
  const [week, setWeek] = useState<Week>("1");
  const [error, setError] = useState<string | null>(null);
  const [busyArea, setBusyArea] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ area: CleaningArea | null } | null>(null);
  const [savingName, setSavingName] = useState(false);

  const cells = useMemo(() => new Map(schedule.cells.map((c) => [`${c.area_id}:${c.week}:${c.weekday}`, c.kind])), [schedule.cells]);
  const active = schedule.areas.filter((a) => a.active);
  const inactive = schedule.areas.filter((a) => !a.active);

  async function act(task: () => Promise<CleaningScheduleView>, areaId: string | null = null) {
    setError(null);
    setBusyArea(areaId);
    try {
      setSchedule(await task());
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
      return false;
    } finally {
      setBusyArea(null);
    }
  }

  // Carga de cada dia da semana escolhida, por tipo.
  const load = [1, 2, 3, 4, 5].map((weekday) => {
    const counts = Object.fromEntries(CLEANING_KINDS.map((k) => [k, 0])) as Record<CleaningKind, number>;
    for (const area of active) {
      const kind = cells.get(`${area.id}:${week}:${weekday}`);
      if (kind) counts[kind] += 1;
    }
    return counts;
  });

  return (
    <div className="space-y-5">
      <div className={cn(SURFACE, "flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3")}>
        <div data-tour="semanas">
          <Segmented<Week>
            label="Semana do cronograma"
            value={week}
            options={(["1", "2", "3", "4"] as Week[]).map((w) => ({ value: w, label: `${w}ª semana` }))}
            onChange={setWeek}
          />
        </div>
        <KindLegend className="mr-auto" />
        <GuiaLimpeza guide="limpeza-cronograma" seen={guideSeen} canManage />
        <Button type="button" data-tour="novo-ambiente" className="gap-2" onClick={() => setEditing({ area: null })}>
          <Plus className="size-4" />
          Novo ambiente
        </Button>
      </div>

      <p className="flex items-start gap-1.5 px-1 text-[13px] leading-5 text-[#5a717b]">
        <Info className="mt-0.5 size-4 shrink-0 text-[#3e84a8]" aria-hidden />
        As semanas contam pelos dias úteis do mês: feriado e fim de semana não têm limpeza, e a 5ª semana repete a 1ª. Toque numa letra para trocar o tipo.
      </p>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <CircleAlert className="size-4" />
          {error}
        </p>
      )}

      <div className={cn(SURFACE, "overflow-x-auto")}>
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#e6eef0]">
              <th scope="col" className="sticky left-0 z-10 bg-white px-3 py-3 text-left text-xs font-medium text-[#5a717b] sm:px-4">
                Ambiente
              </th>
              {[1, 2, 3, 4, 5].map((weekday) => (
                <th key={weekday} scope="col" data-tour={weekday === 1 ? "carga" : undefined} className="px-2 py-3 text-center">
                  <span className="block text-sm font-semibold text-[#0d2a38]">{WEEKDAY_SHORT[weekday]}</span>
                  {/* Carga do dia: uma barra com a proporção de cada tipo. */}
                  <span
                    className="mx-auto mt-1.5 flex h-1.5 w-16 overflow-hidden rounded-full bg-[#eef3f5]"
                    title={`${WEEKDAY_LONG[weekday]}: ${CLEANING_KINDS.filter((k) => load[weekday - 1][k])
                      .map((k) => `${load[weekday - 1][k]} ${CLEANING_KIND_INFO[k].label.toLowerCase()}`)
                      .join(", ")}`}
                  >
                    {CLEANING_KINDS.map((k) =>
                      load[weekday - 1][k] ? (
                        <span key={k} className={KIND_STYLE[k].bar} style={{ width: `${(load[weekday - 1][k] / Math.max(1, active.length)) * 100}%` }} />
                      ) : null
                    )}
                  </span>
                </th>
              ))}
              <th scope="col" className="w-12 px-2 py-3">
                <span className="sr-only">Opções</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef3f5]">
            {active.map((area, index) => (
              <tr key={area.id} className="transition-colors hover:bg-[#fafcfd]">
                <th scope="row" className="sticky left-0 z-10 max-w-40 bg-white px-3 py-1.5 text-left sm:max-w-none sm:px-4">
                  <span className="flex items-center gap-2.5">
                    <AreaTile name={area.name} size="sm" className="hidden sm:grid" />
                    <span className="truncate font-medium text-[#0d2a38]">{area.name}</span>
                  </span>
                </th>
                {[1, 2, 3, 4, 5].map((weekday) => (
                  <td key={weekday} data-tour={index === 0 && weekday === 1 ? "celula" : undefined} className="px-1 py-1 text-center">
                    <KindCell
                      kind={cells.get(`${area.id}:${week}:${weekday}`) ?? null}
                      label={`${area.name}, ${WEEKDAY_LONG[weekday].toLowerCase()} da ${week}ª semana`}
                      onPick={async (kind) => {
                        await act(() => cleaningApi.scheduleAction({ action: "celula", area_id: area.id, week: Number(week), weekday, kind }));
                      }}
                    />
                  </td>
                ))}
                <td data-tour={index === 0 ? "menu-ambiente" : undefined} className="px-2 py-1 text-right">
                  <AreaMenu
                    area={area}
                    first={index === 0}
                    last={index === active.length - 1}
                    busy={busyArea === area.id}
                    onMove={(direction) => void act(() => cleaningApi.scheduleAction({ action: "mover", area_id: area.id, direction }), area.id)}
                    onRename={() => setEditing({ area })}
                    onHide={() => void act(() => cleaningApi.scheduleAction({ action: "ativo", area_id: area.id, active: false }), area.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#e6eef0] bg-[#f7fbfc]">
              <th scope="row" className="sticky left-0 z-10 bg-[#f7fbfc] px-3 py-2.5 text-left text-xs font-medium text-[#5a717b] sm:px-4">
                Pesadas no dia
              </th>
              {load.map((counts, i) => (
                <td key={i} className="px-2 py-2.5 text-center text-xs tabular-nums text-[#3b5560]">
                  {counts.completa + counts.lavagem ? `${counts.completa + counts.lavagem} de ${active.length}` : "—"}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {inactive.length > 0 && (
        <section className={cn(SURFACE, "border-dashed p-4 shadow-none")}>
          <p className="mb-2 text-sm font-semibold text-[#0d2a38]">Fora da lista</p>
          <p className="mb-3 text-xs text-[#5a717b]">Não aparecem para a limpeza nem contam nos números. O histórico continua guardado.</p>
          <ul className="flex flex-wrap gap-2">
            {inactive.map((area) => (
              <li key={area.id}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={busyArea === area.id}
                  onClick={() => void act(() => cleaningApi.scheduleAction({ action: "ativo", area_id: area.id, active: true }), area.id)}
                >
                  <Eye className="size-3.5" />
                  Voltar {area.name}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && (
        <AreaNameDialog
          area={editing.area}
          busy={savingName}
          onCancel={() => setEditing(null)}
          onSave={async (name) => {
            setSavingName(true);
            const ok = await act(() =>
              editing.area
                ? cleaningApi.scheduleAction({ action: "renomear", area_id: editing.area.id, name })
                : cleaningApi.scheduleAction({ action: "novo_ambiente", name })
            );
            setSavingName(false);
            if (ok) setEditing(null);
          }}
        />
      )}
    </div>
  );
}
