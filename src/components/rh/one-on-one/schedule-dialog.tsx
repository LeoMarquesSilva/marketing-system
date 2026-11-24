"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  MapPin,
  Plus,
  Repeat,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayInBrasilia } from "@/lib/rh/pdi/progress";
import { addMonths } from "@/lib/rh/pdi/progress";
import { dayGrid, isoToLocal } from "@/lib/rh/one-on-one/rules";
import {
  ONLINE_ROOM_KEY,
  type AvailabilityResult,
  type OneOnOneFrequency,
  type OneOnOnePairDetail,
  type OneOnOneTopicSource,
} from "@/lib/rh/one-on-one/types";
import type { PdiPerson } from "@/lib/rh/pdi/types";
import { cn } from "@/lib/utils";
import { ChoiceChips, DateField, DayStrip, SwitchRow } from "../form-controls";
import { PersonPhoto } from "../pdi/pdi-visuals";
import { Hint } from "../hint";
import { AgendaPanel } from "./agenda-panel";
import { SourceTag, categoryIcon } from "./one-on-one-visuals";

export interface PairOption {
  leader: PdiPerson;
  member: PdiPerson;
  /** Rótulo do ponto de vista de quem marca ("com Fulana"). */
  label: string;
  /** A outra pessoa da dupla, do ponto de vista de quem marca (foto no seletor). */
  person?: PdiPerson;
  /** "Minha equipe", "Meu gestor"... */
  relation?: string;
}

interface DraftTopic {
  title: string;
  source: OneOnOneTopicSource;
  pdi_action_id?: string | null;
}

const DURATIONS = [30, 45, 60, 90];
const NONE = "__nenhuma__";

export function ScheduleDialog({
  pairs,
  initialPair,
  reschedule,
  onClose,
  onDone,
}: {
  pairs: PairOption[];
  initialPair?: { leaderId: string; memberId: string };
  /** Remarcar uma reunião existente: só data, horário, duração e sala. */
  reschedule?: {
    meetingId: string;
    starts_at: string;
    ends_at: string;
    room_key: string | null;
  };
  onClose: () => void;
  onDone: (warning: string | null) => void;
}) {
  const first =
    initialPair ??
    (pairs[0]
      ? { leaderId: pairs[0].leader.id, memberId: pairs[0].member.id }
      : null);
  const [pairKey, setPairKey] = useState(
    first ? `${first.leaderId}:${first.memberId}` : "",
  );
  const [leaderId, memberId] = pairKey.split(":");
  const [detail, setDetail] = useState<OneOnOnePairDetail | null>(null);
  const [categoryId, setCategoryId] = useState<string>(NONE);
  const startLocal = reschedule ? isoToLocal(reschedule.starts_at) : null;
  const [date, setDate] = useState(
    startLocal?.slice(0, 10) ?? todayInBrasilia(),
  );
  const [time, setTime] = useState(startLocal?.slice(11) ?? "");
  const [duration, setDuration] = useState(
    reschedule
      ? Math.round(
          (new Date(reschedule.ends_at).getTime() -
            new Date(reschedule.starts_at).getTime()) /
            60000,
        )
      : 60,
  );
  const [roomKey, setRoomKey] = useState<string>(
    reschedule?.room_key ?? ONLINE_ROOM_KEY,
  );
  const [topics, setTopics] = useState<DraftTopic[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [frequency, setFrequency] = useState<OneOnOneFrequency | "nenhuma">(
    "nenhuma",
  );
  const [until, setUntil] = useState(addMonths(todayInBrasilia(), 6));
  const [inOutlook, setInOutlook] = useState(true);
  const [availability, setAvailability] = useState<AvailabilityResult | null>(
    null,
  );
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dados da dupla: categorias, salas e sugestões de pauta (PDI e pendências).
  useEffect(() => {
    if (!leaderId || !memberId) return;
    let cancelled = false;
    fetch(`/api/1-1/dupla/${leaderId}/${memberId}`)
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled && !body.error) setDetail(body as OneOnOnePairDetail);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [leaderId, memberId]);

  // Cada consulta cancela a anterior: resposta atrasada de outro dia não sobrescreve a do dia escolhido.
  const loadSlots = useCallback(async (signal: AbortSignal) => {
    if (!leaderId || !memberId || !date) return;
    setLoadingSlots(true);
    try {
      const response = await fetch("/api/1-1/agenda", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leader_employee_id: leaderId,
          member_employee_id: memberId,
          room_key: roomKey,
          date,
          duration_minutes: duration,
        }),
      });
      const body = await response.json();
      if (signal.aborted) return;
      setAvailability(
        response.ok
          ? (body as AvailabilityResult)
          : { date, slots: dayGrid([], duration), people: [], error: body.error ?? "Agenda do Outlook indisponível agora." },
      );
    } catch {
      if (signal.aborted) return;
      setAvailability({
        date,
        slots: dayGrid([], duration),
        people: [],
        error: "Agenda do Outlook indisponível agora: os horários aparecem livres, confira a agenda antes de marcar.",
      });
    } finally {
      if (!signal.aborted) setLoadingSlots(false);
    }
  }, [leaderId, memberId, date, roomKey, duration]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => loadSlots(controller.signal), 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadSlots]);

  const category =
    detail?.categories.find((item) => item.id === categoryId) ?? null;
  const suggestions = useMemo(() => {
    const fromCategory = (category?.suggested_topics ?? []).map((title) => ({
      title,
      source: "sugerido" as const,
    }));
    return [...(detail?.suggestions ?? []), ...fromCategory].filter(
      (item) => !topics.some((topic) => topic.title === item.title),
    );
  }, [detail, category, topics]);

  const now = new Date();
  const isToday = date === todayInBrasilia();
  const nowTime = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!time) throw new Error("Escolha o horário.");
      const startValue = `${date}T${time}`;
      const response = reschedule
        ? await fetch(`/api/1-1/reunioes/${reschedule.meetingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "remarcar",
              start_local: startValue,
              duration_minutes: duration,
              room_key: roomKey,
            }),
          })
        : await fetch("/api/1-1", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              leader_employee_id: leaderId,
              member_employee_id: memberId,
              category_id: categoryId === NONE ? null : categoryId,
              start_local: startValue,
              duration_minutes: duration,
              room_key: roomKey,
              topics,
              recurrence: frequency === "nenhuma" ? null : { frequency, until },
              create_in_outlook: inOutlook,
            }),
          });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Não foi possível salvar.");
      onDone(body.warning ?? null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível salvar.",
      );
      setSaving(false);
    }
  }

  const rooms = detail?.rooms ?? [];
  const selectedPair = pairs.find(
    (pair) => `${pair.leader.id}:${pair.member.id}` === pairKey,
  );

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl"
        showCloseButton={!saving}
      >
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-lg">
            {reschedule ? "Remarcar 1:1" : "Nova 1:1"}
          </DialogTitle>
          <DialogDescription>
            {reschedule
              ? "Escolha o novo horário. O convite do Outlook é atualizado junto."
              : "Escolha a sala e um horário livre: o convite sai no Outlook com o link do Teams."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {!reschedule && (
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Com quem</Label>
                {pairs.length > 1 ? (
                  <div
                    role="radiogroup"
                    aria-label="Com quem"
                    className="grid max-h-60 gap-2 overflow-y-auto p-0.5 sm:grid-cols-2"
                  >
                    {pairs.map((pair) => {
                      const key = `${pair.leader.id}:${pair.member.id}`;
                      const person = pair.person ?? pair.member;
                      const selected = key === pairKey;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => {
                            setPairKey(key);
                            setCategoryId(NONE);
                            setTopics([]);
                          }}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                            selected
                              ? "border-[#347796] bg-[#f1f8fa]"
                              : "border-[#e6eff1] bg-white hover:border-[#47cdd0]/60",
                          )}
                        >
                          <PersonPhoto
                            person={person}
                            size="md"
                            className={cn(
                              selected && "ring-2 ring-[#E1B16D] ring-offset-1",
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-[#0d2a38]">
                              {person.name}
                            </span>
                            <span className="block truncate text-xs text-[#5a717b]">
                              {pair.relation ?? person.position ?? ""}
                            </span>
                          </span>
                          {selected && (
                            <Check
                              className="size-4 shrink-0 text-[#347796]"
                              aria-hidden
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : selectedPair ? (
                  <div className="flex items-center gap-3 rounded-lg border border-[#e6eff1] px-3 py-2">
                    <PersonPhoto person={selectedPair.leader} size="sm" />
                    <PersonPhoto
                      person={selectedPair.member}
                      size="sm"
                      className="-ml-5 ring-2 ring-white"
                    />
                    <span className="text-sm font-medium text-[#0d2a38]">
                      {selectedPair.label}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ninguém disponível para 1:1.
                  </p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Assunto principal</Label>
                <ChoiceChips
                  label="Assunto principal"
                  size="sm"
                  value={categoryId}
                  onChange={setCategoryId}
                  options={[
                    {
                      value: NONE,
                      label: "Conversa livre",
                      icon: categoryIcon(null),
                    },
                    ...(detail?.categories ?? []).map((item) => ({
                      value: item.id,
                      label: item.name,
                      icon: categoryIcon(item.name),
                    })),
                  ]}
                />
                {category && category.suggested_topics.length > 0 && (
                  <p className="text-xs text-[#5a717b]">
                    Os tópicos sugeridos desta categoria aparecem na pauta, logo
                    abaixo.
                  </p>
                )}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0d2a38]">
              <CalendarDays className="size-4 text-[#3e84a8]" aria-hidden />
              Quando e onde
            </h3>
            <div className="space-y-1.5">
              <Label>Dia</Label>
              <DayStrip
                value={date}
                from={todayInBrasilia()}
                onChange={(next) => {
                  setDate(next);
                  setTime("");
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duração</Label>
              <ChoiceChips
                label="Duração"
                size="sm"
                value={String(duration)}
                onChange={(value) => {
                  setDuration(Number(value));
                  setTime("");
                }}
                options={DURATIONS.map((minutes) => ({
                  value: String(minutes),
                  label:
                    minutes === 60
                      ? "1 hora"
                      : minutes === 90
                        ? "1h30"
                        : `${minutes} min`,
                  icon: Clock3,
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sala</Label>
              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-label="Sala"
              >
                {[
                  { key: ONLINE_ROOM_KEY, label: "Somente online" },
                  ...rooms,
                ].map((room) => {
                  const selected = roomKey === room.key;
                  return (
                    <button
                      key={room.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setRoomKey(room.key)}
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                        selected
                          ? "border-[#47cdd0] bg-[#e8f8f8] font-semibold text-[#1d5670] shadow-[inset_0_0_0_1px_#47cdd0]"
                          : "border-[#dce9eb] bg-white text-[#3b5560] hover:border-[#47cdd0]/70",
                      )}
                    >
                      {room.key === ONLINE_ROOM_KEY ? (
                        <Video className="size-4" aria-hidden />
                      ) : (
                        <MapPin className="size-4" aria-hidden />
                      )}
                      {room.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Horário</Label>
              </div>
              {loadingSlots ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Consultando a agenda no Outlook…
                </p>
              ) : (
                <>
                  {availability?.error && (
                    <p className="text-sm text-amber-700">
                      {availability.error}
                    </p>
                  )}
                  {availability && (
                    <AgendaPanel
                      people={availability.people}
                      time={time}
                      duration={duration}
                      dayLabel={new Intl.DateTimeFormat("pt-BR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: "UTC",
                      }).format(new Date(`${availability.date}T12:00:00Z`))}
                    />
                  )}
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                    {(availability?.slots ?? []).map((slot) => {
                      const past = isToday && slot.time <= nowTime;
                      const selected = time === slot.time;
                      const disabled =
                        past || (!slot.free && !availability?.error);
                      return (
                        <Hint
                          key={slot.time}
                          wrap
                          label={
                            past
                              ? "Horário já passou"
                              : slot.busy.length
                                ? `Ocupado: ${slot.busy.join(", ")}`
                                : "Livre para todos"
                          }
                        >
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => setTime(slot.time)}
                            className={cn(
                              "h-9 w-full rounded-md border text-sm tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                              selected
                                ? "border-[#47cdd0] bg-[#e8f8f8] font-semibold text-[#1d5670] shadow-[inset_0_0_0_1px_#47cdd0]"
                                : disabled
                                  ? "cursor-not-allowed border-transparent bg-[#f1f5f6] text-[#9fb1b8] line-through"
                                  : "border-[#cfe3e6] bg-[#eefaf8] text-[#1f6f62] hover:border-[#47cdd0]",
                            )}
                          >
                            {slot.time}
                          </button>
                        </Hint>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5a717b]">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-3 rounded-sm border border-[#cfe3e6] bg-[#eefaf8]"
                        aria-hidden
                      />
                      Livre para todos
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-3 rounded-sm bg-[#f1f5f6]"
                        aria-hidden
                      />
                      Ocupado ou já passou (passe o mouse para ver quem)
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          {!reschedule && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-[#0d2a38]">Pauta</h3>
              {topics.length > 0 && (
                <ul className="space-y-1.5">
                  {topics.map((topic, index) => (
                    <li
                      key={`${topic.title}-${index}`}
                      className="flex items-center gap-2 rounded-md border border-[#e6eff1] px-3 py-2 text-sm"
                    >
                      <Check
                        className="size-4 shrink-0 text-[#347796]"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 text-[#0d2a38]">
                        {topic.title}
                      </span>
                      <SourceTag source={topic.source} />
                      <button
                        type="button"
                        aria-label="Tirar da pauta"
                        onClick={() =>
                          setTopics((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                        className="rounded p-1 text-muted-foreground hover:bg-muted"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-[#5a717b]">
                    <Sparkles className="size-3.5" aria-hidden />
                    Sugestões (PDI, pendências e categoria)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.slice(0, 10).map((item, index) => (
                      <Hint
                        key={`${item.source}-${item.title}-${index}`}
                        label={"hint" in item ? item.hint : undefined}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setTopics((current) => [
                              ...current,
                              {
                                title: item.title,
                                source: item.source,
                                pdi_action_id:
                                  "pdi_action_id" in item
                                    ? (item.pdi_action_id ?? null)
                                    : null,
                              },
                            ])
                          }
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#dce9eb] bg-white px-2.5 py-1 text-left text-xs text-[#285f7a] outline-none hover:border-[#47cdd0]/70 hover:bg-[#f4fafb] focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60"
                        >
                          <Plus className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">{item.title}</span>
                        </button>
                      </Hint>
                    ))}
                  </div>
                </div>
              )}
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!newTopic.trim()) return;
                  setTopics((current) => [
                    ...current,
                    { title: newTopic.trim(), source: "livre" },
                  ]);
                  setNewTopic("");
                }}
              >
                <Input
                  value={newTopic}
                  onChange={(event) => setNewTopic(event.target.value)}
                  placeholder="Novo tópico da pauta"
                  aria-label="Novo tópico"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!newTopic.trim()}
                >
                  <Plus className="size-4" aria-hidden />
                  Incluir
                </Button>
              </form>
            </section>
          )}

          {!reschedule && (
            <section className="space-y-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Repeat className="size-3.5 text-[#3e84a8]" aria-hidden />
                  Repetir
                </Label>
                <ChoiceChips
                  label="Repetir"
                  size="sm"
                  value={frequency}
                  onChange={setFrequency}
                  options={[
                    { value: "nenhuma", label: "Só esta" },
                    {
                      value: "mensal",
                      label: "Todo mês",
                      hint: "Mesma semana do mês e mesmo dia da semana",
                    },
                    { value: "quinzenal", label: "A cada 15 dias" },
                    { value: "semanal", label: "Toda semana" },
                  ]}
                />
              </div>
              {frequency !== "nenhuma" && (
                <div className="space-y-1.5 sm:max-w-xs">
                  <Label>Repetir até</Label>
                  <DateField
                    label="Repetir até"
                    value={until}
                    min={date}
                    onChange={setUntil}
                    presets={[
                      { label: "3 meses", value: addMonths(date, 3) },
                      { label: "6 meses", value: addMonths(date, 6) },
                      { label: "1 ano", value: addMonths(date, 12) },
                    ]}
                  />
                </div>
              )}
              <SwitchRow
                className="rounded-lg border border-[#e6eff1] px-3 py-2.5"
                icon={CalendarCheck2}
                checked={inOutlook}
                onChange={setInOutlook}
                label="Criar o convite no Outlook"
                hint="Vai para os dois e para a sala, com o link do Teams."
              />
            </section>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-[#e6eef0] px-6 py-4 sm:justify-between">
          <p className="min-w-0 text-sm text-red-700" role="alert">
            {error}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving || !pairKey || !time}>
              {saving && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              {reschedule ? "Remarcar" : "Marcar 1:1"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
