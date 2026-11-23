"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CalendarClock, Clapperboard, Disc3, Loader2, Mic, Music, Pencil, Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SCHEDULE_KIND_LABEL,
  formatClock,
  formatMinutes,
  isScheduleTime,
  scheduleRows,
  scheduleTotals,
  type EventSchedule,
  type EventScheduleItem,
  type ScheduleKind,
} from "@/lib/eventos-programa";
import {
  deleteEventSchedule,
  deleteEventScheduleItem,
  fetchEventSchedules,
  saveEventSchedule,
  saveEventScheduleItem,
  setOfficialSchedule,
  type ScheduleInput,
  type ScheduleItemInput,
} from "@/lib/eventos-programa-db";
import { cn } from "@/lib/utils";

const CARD = "rounded-lg border border-[#dce9eb] bg-card shadow-[0_1px_2px_rgba(3,32,47,0.05)]";

const KIND_STYLE: Record<ScheduleKind, { icon: typeof Mic; chip: string; bar: string }> = {
  show: { icon: Music, chip: "bg-[#e3eff5] text-[#285f7a]", bar: "bg-[#347796]" },
  premiacao: { icon: Trophy, chip: "bg-amber-50 text-amber-800", bar: "bg-amber-400" },
  fala: { icon: Mic, chip: "bg-[#e2f6f6] text-[#1f6f72]", bar: "bg-[#47cdd0]" },
  dj: { icon: Disc3, chip: "bg-slate-100 text-slate-600", bar: "bg-slate-300" },
  outro: { icon: Clapperboard, chip: "bg-slate-100 text-slate-600", bar: "bg-slate-200" },
};

const KIND_ORDER: ScheduleKind[] = ["show", "premiacao", "fala", "dj", "outro"];

function ItemDialog({
  item,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  item: EventScheduleItem | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: ScheduleItemInput) => void;
  onDelete?: () => void;
}) {
  const [startTime, setStartTime] = useState(item?.startTime ?? "");
  const [endTime, setEndTime] = useState(item?.endTime ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [kind, setKind] = useState<ScheduleKind>(item?.kind ?? "fala");
  const [note, setNote] = useState(item?.note ?? "");
  const [removed, setRemoved] = useState(item?.removed ?? false);
  const valid = isScheduleTime(startTime) && isScheduleTime(endTime) && startTime !== endTime && title.trim().length > 1;
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <div className="border-b border-[#e6eef0] px-5 py-4 pr-12">
          <DialogTitle className="text-base">{item ? "Editar bloco" : "Novo bloco"}</DialogTitle>
          <DialogDescription className="text-sm">Um momento do roteiro: horário, o que acontece e de que tipo é.</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="bloco-inicio">Começa</Label>
              <Input id="bloco-inicio" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bloco-fim">Termina</Label>
              <Input id="bloco-fim" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bloco-tipo">Tipo</Label>
              <select
                id="bloco-tipo"
                value={kind}
                onChange={(event) => setKind(event.target.value as ScheduleKind)}
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40"
              >
                {KIND_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {SCHEDULE_KIND_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bloco-titulo">O que acontece</Label>
            <Input id="bloco-titulo" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Show · bloco 1" autoFocus={!item} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bloco-obs">Observação</Label>
            <Input id="bloco-obs" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: quem sobe ao palco, o que precisa estar pronto" />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <input type="checkbox" checked={removed} onChange={(event) => setRemoved(event.target.checked)} className="size-4 accent-[#347796]" />
            Retirado do roteiro (fica riscado, como registro)
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          {onDelete && (
            <Button variant="ghost" size="sm" className="mr-auto text-rose-700" disabled={busy} onClick={onDelete}>
              Excluir
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy || !valid}
            onClick={() => onSave({ startTime, endTime, title: title.trim(), kind, note: note.trim() || null, removed })}
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VersionDialog({
  schedule,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  schedule: EventSchedule | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: ScheduleInput) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(schedule?.name ?? "");
  const [summary, setSummary] = useState(schedule?.summary ?? "");
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-md">
        <div className="border-b border-[#e6eef0] px-5 py-4 pr-12">
          <DialogTitle className="text-base">{schedule ? "Editar versão" : "Nova versão do cronograma"}</DialogTitle>
          <DialogDescription className="text-sm">Use versões para comparar opções antes de escolher a oficial.</DialogDescription>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="versao-nome">Nome</Label>
            <Input id="versao-nome" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Opção 01" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="versao-resumo">Resumo</Label>
            <Input id="versao-resumo" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Ex.: Show em 2 blocos" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          {onDelete && (
            <Button variant="ghost" size="sm" className="mr-auto text-rose-700" disabled={busy} onClick={onDelete}>
              Excluir versão
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={busy || name.trim().length < 2} onClick={() => onSave({ name: name.trim(), summary: summary.trim() || null })}>
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EventoCronogramaTab({ eventId, onHistory }: { eventId: string; onHistory: (label: string, payload: Record<string, unknown>) => void }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [schedules, setSchedules] = useState<EventSchedule[]>([]);
  const [items, setItems] = useState<EventScheduleItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<{ item: EventScheduleItem | null } | null>(null);
  const [versionForm, setVersionForm] = useState<{ schedule: EventSchedule | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchEventSchedules(eventId).then((data) => {
      if (cancelled) return;
      setSchedules(data.schedules);
      setItems(data.items);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const official = schedules.find((schedule) => schedule.isOfficial) ?? null;
  const selected = schedules.find((schedule) => schedule.id === selectedId) ?? official ?? schedules[0] ?? null;
  const ownItems = useMemo(() => items.filter((item) => item.scheduleId === selected?.id), [items, selected?.id]);
  const rows = useMemo(() => scheduleRows(ownItems), [ownItems]);
  const totals = useMemo(() => scheduleTotals(ownItems), [ownItems]);
  const activeMinutes = KIND_ORDER.reduce((sum, kind) => sum + totals.byKind[kind], 0);

  const makeOfficial = async (schedule: EventSchedule | null) => {
    setBusy(true);
    const ok = await setOfficialSchedule(eventId, schedule?.id ?? null);
    setBusy(false);
    if (!ok) return;
    setSchedules((list) => list.map((entry) => ({ ...entry, isOfficial: entry.id === schedule?.id })));
    onHistory(schedule ? `Cronograma oficial definido: ${schedule.name}` : "Cronograma oficial desmarcado", { scheduleId: schedule?.id ?? null });
  };

  if (loading) {
    return (
      <div className={cn(CARD, "flex items-center justify-center gap-2 px-6 py-16 text-sm text-muted-foreground")}>
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Carregando o cronograma…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Cronograma</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            O roteiro do dia, bloco a bloco.
            {official ? ` Versão oficial: ${official.name}.` : schedules.length > 0 ? " Nenhuma versão foi marcada como a oficial ainda." : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setVersionForm({ schedule: null })}>
            <Plus className="size-4" />
            Nova versão
          </Button>
          {selected && (
            <Button onClick={() => setItemForm({ item: null })}>
              <Plus className="size-4" />
              Novo bloco
            </Button>
          )}
        </div>
      </div>

      {schedules.length === 0 && (
        <div className={cn(CARD, "flex flex-col items-center gap-2 px-6 py-12 text-center")}>
          <CalendarClock className="size-6 text-[#3e84a8]" aria-hidden />
          <p className="text-sm font-medium text-foreground">Nenhum cronograma cadastrado</p>
          <p className="max-w-sm text-sm text-muted-foreground">Crie uma versão e monte o roteiro do dia, com horário de cada momento.</p>
        </div>
      )}

      {schedules.length > 1 && (
        <div role="radiogroup" aria-label="Versão do cronograma" className="grid gap-3 sm:grid-cols-2">
          {schedules.map((schedule) => {
            const active = schedule.id === selected?.id;
            return (
              <button
                key={schedule.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelectedId(schedule.id)}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40",
                  active ? "border-[#347796] bg-[#f3fafb]" : "border-[#dce9eb] bg-card hover:border-[#47cdd0]/70"
                )}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{schedule.name}</span>
                  {schedule.summary && <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{schedule.summary}</span>}
                </span>
                {schedule.isOfficial && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                    <BadgeCheck className="size-3.5" aria-hidden />
                    Oficial
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <>
          <div className={cn(CARD, "flex flex-wrap items-center justify-between gap-3 px-4 py-3")}>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                {selected.name}
                {selected.isOfficial && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                    <BadgeCheck className="size-3.5" aria-hidden />
                    É a que vamos usar
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {selected.isOfficial
                  ? selected.summary ?? "Versão oficial do roteiro."
                  : "Esta versão ainda não é a oficial. Marque quando ela for a escolhida."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => setVersionForm({ schedule: selected })}>
                <Pencil className="size-4" />
                Editar versão
              </Button>
              {selected.isOfficial ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void makeOfficial(null)}>
                  Desmarcar
                </Button>
              ) : (
                <Button size="sm" disabled={busy} onClick={() => void makeOfficial(selected)}>
                  <BadgeCheck className="size-4" />
                  Usar esta versão
                </Button>
              )}
            </div>
          </div>

          {ownItems.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className={cn(CARD, "p-4")}>
                <p className="text-xs font-medium text-muted-foreground">Da abertura ao fim</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                  {totals.startTime ? formatClock(totals.startTime) : "—"} à {totals.endTime ? formatClock(totals.endTime) : "—"}
                </p>
              </div>
              <div className={cn(CARD, "p-4")}>
                <p className="text-xs font-medium text-muted-foreground">Show</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{formatMinutes(totals.byKind.show)}</p>
                <p className="text-xs text-muted-foreground">
                  em {totals.showBlocks} {totals.showBlocks === 1 ? "bloco" : "blocos"}
                </p>
              </div>
              <div className={cn(CARD, "p-4")}>
                <p className="text-xs font-medium text-muted-foreground">Vídeo e falas</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{formatMinutes(totals.byKind.fala)}</p>
              </div>
              <div className={cn(CARD, "p-4")}>
                <p className="text-xs font-medium text-muted-foreground">Premiações</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{formatMinutes(totals.byKind.premiacao)}</p>
              </div>
            </div>
          )}

          {activeMinutes > 0 && (
            <div className={cn(CARD, "p-4")}>
              <p className="text-xs font-medium text-muted-foreground">A noite em escala de tempo</p>
              <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
                {rows.map((row, index) =>
                  row.type === "gap" ? (
                    <span key={`gap-${index}`} style={{ flexGrow: row.minutes }} className="basis-0 bg-white" />
                  ) : row.item.removed ? null : (
                    <span key={row.item.id} style={{ flexGrow: row.minutes }} className={cn("basis-0 border-r border-white/70 last:border-r-0", KIND_STYLE[row.item.kind].bar)} title={`${row.item.title} · ${formatMinutes(row.minutes)}`} />
                  )
                )}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                {KIND_ORDER.filter((kind) => totals.byKind[kind] > 0).map((kind) => (
                  <li key={kind} className="inline-flex items-center gap-1.5">
                    <span className={cn("size-2.5 rounded-full", KIND_STYLE[kind].bar)} aria-hidden />
                    {SCHEDULE_KIND_LABEL[kind]} · {formatMinutes(totals.byKind[kind])}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ownItems.length === 0 ? (
            <div className={cn(CARD, "px-6 py-10 text-center text-sm text-muted-foreground")}>Esta versão ainda não tem blocos. Use &quot;Novo bloco&quot; para começar.</div>
          ) : (
            <ol className={cn(CARD, "divide-y divide-[#eef3f4] overflow-hidden")}>
              {rows.map((row, index) => {
                if (row.type === "gap") {
                  return (
                    <li key={`gap-${index}`} className="flex items-center gap-3 bg-[#fafcfc] px-4 py-2 text-xs text-muted-foreground">
                      <span className="w-28 shrink-0 tabular-nums">
                        {formatClock(row.startTime)} – {formatClock(row.endTime)}
                      </span>
                      <span className="rounded-full border border-dashed border-[#c9d8dc] px-2 py-0.5">{formatMinutes(row.minutes)} sem nada marcado</span>
                    </li>
                  );
                }
                const { item } = row;
                const style = KIND_STYLE[item.kind];
                const Icon = style.icon;
                return (
                  <li key={item.id} className={cn("flex items-center gap-3 px-4 py-3", item.removed && "bg-[#fafcfc]")}>
                    <span className={cn("w-28 shrink-0 text-sm font-semibold tabular-nums text-foreground", item.removed && "font-normal text-muted-foreground line-through")}>
                      {formatClock(item.startTime)} – {formatClock(item.endTime)}
                    </span>
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", item.removed ? "bg-slate-100 text-slate-400" : style.chip)} aria-hidden>
                      <Icon className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium leading-5 text-foreground", item.removed && "font-normal text-muted-foreground line-through")}>{item.title}</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {item.removed ? "Retirado do roteiro" : SCHEDULE_KIND_LABEL[item.kind]}
                        {item.note ? ` · ${item.note}` : ""}
                      </p>
                    </div>
                    {!item.removed && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatMinutes(row.minutes)}</span>}
                    <Button size="icon-sm" variant="ghost" aria-label={`Editar ${item.title}`} onClick={() => setItemForm({ item })}>
                      <Pencil className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      {itemForm && selected && (
        <ItemDialog
          item={itemForm.item}
          busy={busy}
          onClose={() => setItemForm(null)}
          onSave={async (input) => {
            setBusy(true);
            const saved = await saveEventScheduleItem(eventId, selected.id, input, itemForm.item?.id);
            setBusy(false);
            if (!saved) return;
            setItems((list) => (itemForm.item ? list.map((entry) => (entry.id === saved.id ? saved : entry)) : [...list, saved]));
            onHistory(`Cronograma (${selected.name}): ${itemForm.item ? "bloco atualizado" : "bloco criado"} — ${saved.title}`, { scheduleId: selected.id, itemId: saved.id });
            setItemForm(null);
          }}
          onDelete={
            itemForm.item
              ? async () => {
                  const target = itemForm.item;
                  if (!target) return;
                  setBusy(true);
                  const ok = await deleteEventScheduleItem(target.id);
                  setBusy(false);
                  if (!ok) return;
                  setItems((list) => list.filter((entry) => entry.id !== target.id));
                  onHistory(`Cronograma (${selected.name}): bloco removido — ${target.title}`, { scheduleId: selected.id });
                  setItemForm(null);
                }
              : undefined
          }
        />
      )}

      {versionForm && (
        <VersionDialog
          schedule={versionForm.schedule}
          busy={busy}
          onClose={() => setVersionForm(null)}
          onSave={async (input) => {
            setBusy(true);
            const saved = await saveEventSchedule(eventId, input, versionForm.schedule?.id);
            setBusy(false);
            if (!saved) return;
            setSchedules((list) => (versionForm.schedule ? list.map((entry) => (entry.id === saved.id ? saved : entry)) : [...list, saved]));
            setSelectedId(saved.id);
            onHistory(versionForm.schedule ? `Versão do cronograma atualizada: ${saved.name}` : `Versão do cronograma criada: ${saved.name}`, { scheduleId: saved.id });
            setVersionForm(null);
          }}
          onDelete={
            versionForm.schedule
              ? async () => {
                  const target = versionForm.schedule;
                  if (!target) return;
                  setBusy(true);
                  const ok = await deleteEventSchedule(target.id);
                  setBusy(false);
                  if (!ok) return;
                  setSchedules((list) => list.filter((entry) => entry.id !== target.id));
                  setItems((list) => list.filter((entry) => entry.scheduleId !== target.id));
                  setSelectedId(null);
                  onHistory(`Versão do cronograma removida: ${target.name}`, { scheduleId: target.id });
                  setVersionForm(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
