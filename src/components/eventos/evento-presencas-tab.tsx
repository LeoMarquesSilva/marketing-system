"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Coffee,
  Download,
  ListFilter,
  LoaderCircle,
  MessageSquareQuote,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UserMinus,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  CafeAdminData,
  CafeAdminParticipant,
  CafeExpectationSource,
  CafeExpectationStatus,
} from "@/lib/cafe-cultura/types";
import { supabase } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

type FilterStatus = "all" | CafeExpectationStatus;
type PresenceFilter = "all" | "present" | "pending";
type SortMode = "name" | "checkin_recent" | "status";
type SheetGroup = "confirmed" | "excused_absence" | "present" | "pending" | null;

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-BR");
}

function statusLabel(value: CafeExpectationStatus): string {
  if (value === "excused_absence") return "Ausência justificada";
  if (value === "excluded") return "Excluído";
  return "Confirmado";
}

function sourceLabel(value: CafeExpectationSource): string {
  if (value === "responsum") return "RESPONSUM";
  if (value === "admin") return "Ajuste manual";
  return "Lista oficial";
}

function statusStyle(value: CafeExpectationStatus): string {
  if (value === "excused_absence") return "border-[#d9b56c]/50 bg-[#fbf3e3] text-[#76551e]";
  if (value === "excluded") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-[#347796]/25 bg-[#eaf5f7] text-[#285f73]";
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function formatTime(value: Date | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" }).format(value);
}

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(`${value}:00-03:00`).toISOString() : null;
}

function justificationText(participant: CafeAdminParticipant): string | null {
  const texts = participant.responsumJustifications
    .map((justification) => justification.description || justification.title)
    .map((value) => value.trim())
    .filter(Boolean);
  return texts.length ? texts.join(" · ") : null;
}

function matchesGroup(participant: CafeAdminParticipant, group: SheetGroup): boolean {
  if (group === "confirmed") return participant.expectationStatus === "confirmed";
  if (group === "excused_absence") return participant.expectationStatus === "excused_absence";
  if (group === "present") return Boolean(participant.checkinAt);
  if (group === "pending") return participant.expectationStatus === "confirmed" && !participant.checkinAt;
  return false;
}

function ParticipantIdentity({ participant, compact = false }: { participant: CafeAdminParticipant; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className={cn("shrink-0 border border-border/70", compact ? "size-9" : "size-11")}>
        {participant.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={participant.avatarUrl} alt={participant.name} className="size-full object-cover" />
        ) : (
          <AvatarFallback className="bg-[#e6f2f3] text-xs font-semibold text-[#285f73]">{initials(participant.name)}</AvatarFallback>
        )}
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{participant.name}</p>
        <p className="truncate text-xs text-muted-foreground">{[participant.department, participant.email].filter(Boolean).join(" · ") || "Sem área informada"}</p>
      </div>
    </div>
  );
}

function JustificationPreview({ participant, expanded = false }: { participant: CafeAdminParticipant; expanded?: boolean }) {
  const text = justificationText(participant);
  if (!text) return <span className="text-xs text-muted-foreground/70">Sem justificativa registrada</span>;
  return (
    <div className="rounded-xl border border-[#d9b56c]/30 bg-[#fffaf0] px-3 py-2.5">
      <div className="flex items-start gap-2">
        <MessageSquareQuote className="mt-0.5 size-3.5 shrink-0 text-[#9a7330]" />
        <p className={cn("text-xs leading-5 text-[#5e4925]", !expanded && "line-clamp-2")}>{text}</p>
      </div>
      {participant.responsumTicketCount > 1 && <p className="mt-1 pl-5 text-[10px] font-medium text-[#9a7330]">{participant.responsumTicketCount} chamados vinculados</p>}
    </div>
  );
}

function ParticipantActions({ participant, busy, onChange }: { participant: CafeAdminParticipant; busy: boolean; onChange: (userId: string, patch: { expectationStatus?: CafeExpectationStatus; present?: boolean }) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label={`Situação de ${participant.name}`} value={participant.expectationStatus} disabled={busy} onChange={(event) => onChange(participant.userId, { expectationStatus: event.target.value as CafeExpectationStatus })} className="h-9 min-w-40 rounded-lg border border-input bg-background px-2.5 text-xs font-medium outline-none focus:border-[#47cdd0] focus:ring-2 focus:ring-[#47cdd0]/15">
        <option value="confirmed">Confirmado</option><option value="excused_absence">Ausência justificada</option><option value="excluded">Excluído</option>
      </select>
      <Button type="button" size="sm" variant={participant.checkinAt ? "outline" : "default"} disabled={busy} onClick={() => onChange(participant.userId, { present: !participant.checkinAt })} className="h-9">
        {participant.checkinAt ? <><UserMinus className="size-4" /> Remover</> : <><UserCheck className="size-4" /> Presença</>}
      </Button>
    </div>
  );
}

function SummarySheet({ group, participants, onOpenChange }: { group: SheetGroup; participants: CafeAdminParticipant[]; onOpenChange: (open: boolean) => void }) {
  const meta = {
    confirmed: { title: "Pessoas confirmadas", description: "Quantidade considerada para o local nesta edição." },
    excused_absence: { title: "Ausências justificadas", description: "Colaboradores identificados pelo RESPONSUM ou ajustados pelo admin." },
    present: { title: "Presenças registradas", description: "Check-ins recebidos pela etiqueta NFC, QR Code ou painel." },
    pending: { title: "Check-ins pendentes", description: "Confirmados que ainda não registraram a chegada." },
  } as const;
  const selected = group ? participants.filter((participant) => matchesGroup(participant, group)) : [];
  const currentMeta = group ? meta[group] : meta.confirmed;
  return (
    <Sheet open={Boolean(group)} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="bg-[linear-gradient(135deg,#fff_0%,#f8f1e5_100%)]">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8f6c2d]">Resumo da edição</p>
          <SheetTitle>{currentMeta.title}</SheetTitle><SheetDescription>{currentMeta.description}</SheetDescription>
          <div className="mt-4 inline-flex items-baseline gap-2 rounded-full bg-[#10293a] px-4 py-2 text-white"><strong className="text-xl">{selected.length}</strong><span className="text-xs text-white/65">colaboradores</span></div>
        </SheetHeader>
        <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
          {selected.map((participant) => (
            <article key={participant.id} className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-sm">
              <ParticipantIdentity participant={participant} compact />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={statusStyle(participant.expectationStatus)}>{statusLabel(participant.expectationStatus)}</Badge>
                <span className={cn("text-xs font-semibold", participant.checkinAt ? "text-emerald-700" : "text-muted-foreground")}>{participant.checkinAt ? `Presente · ${formatDateTime(participant.checkinAt)}` : "Sem check-in"}</span>
              </div>
              {participant.responsumJustifications.length > 0 && <div className="mt-3"><JustificationPreview participant={participant} expanded /></div>}
            </article>
          ))}
          {selected.length === 0 && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum colaborador neste grupo.</div>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function EventoPresencasContent({ data, search, status, presence = "all", department = "all", source = "all", justificationOnly = false, sort = "name", busy, onParticipantChange, onOpenGroup }: {
  data: CafeAdminData; search: string; status: FilterStatus; presence?: PresenceFilter; department?: string; source?: "all" | CafeExpectationSource; justificationOnly?: boolean; sort?: SortMode; busy: boolean;
  onParticipantChange: (userId: string, patch: { expectationStatus?: CafeExpectationStatus; present?: boolean }) => void; onOpenGroup?: (group: Exclude<SheetGroup, null>) => void;
}) {
  const participants = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-BR");
    return data.participants.filter((participant) => {
      const justification = justificationText(participant) ?? "";
      const matchesText = !normalized || [participant.name, participant.email, participant.department, justification].filter(Boolean).some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalized));
      const matchesStatus = status === "all" || participant.expectationStatus === status;
      const matchesPresence = presence === "all" || (presence === "present" && Boolean(participant.checkinAt)) || (presence === "pending" && participant.expectationStatus === "confirmed" && !participant.checkinAt);
      const matchesDepartment = department === "all" || (participant.department ?? "Sem área") === department;
      const matchesSource = source === "all" || participant.expectationSource === source;
      return matchesText && matchesStatus && matchesPresence && matchesDepartment && matchesSource && (!justificationOnly || participant.responsumJustifications.length > 0);
    }).sort((a, b) => {
      if (sort === "checkin_recent") return (b.checkinAt ?? "").localeCompare(a.checkinAt ?? "");
      if (sort === "status") return statusLabel(a.expectationStatus).localeCompare(statusLabel(b.expectationStatus), "pt-BR") || a.name.localeCompare(b.name, "pt-BR");
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [data.participants, department, justificationOnly, presence, search, sort, source, status]);
  const cards = [
    { group: "confirmed" as const, label: "Confirmados para o local", value: data.summary.expected, icon: Users, tone: "text-[#285f73] bg-[#eaf5f7]", border: "hover:border-[#47cdd0]/60" },
    { group: "excused_absence" as const, label: "Ausências justificadas", value: data.summary.excused, icon: ShieldCheck, tone: "text-[#76551e] bg-[#fbf3e3]", border: "hover:border-[#d9b56c]/70" },
    { group: "present" as const, label: "Presenças registradas", value: data.summary.present, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50", border: "hover:border-emerald-300" },
    { group: "pending" as const, label: "Pendentes no encontro", value: data.summary.pending, icon: Clock3, tone: "text-slate-700 bg-slate-100", border: "hover:border-slate-300" },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((card) => <button type="button" key={card.label} onClick={() => onOpenGroup?.(card.group)} className={cn("group rounded-2xl border border-border/60 bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", card.border)}><div className="flex items-start justify-between gap-2"><span className={cn("flex size-9 items-center justify-center rounded-xl", card.tone)}><card.icon className="size-4" /></span><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground opacity-0 transition group-hover:opacity-100">Ver lista</span></div><p className="mt-4 text-2xl font-bold tracking-tight">{card.value}</p><p className="mt-1 text-xs leading-4 text-muted-foreground">{card.label}</p></button>)}
      </div>
      <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card xl:block">
        <div className="grid grid-cols-[minmax(230px,1.05fr)_minmax(160px,.65fr)_minmax(230px,1fr)_minmax(130px,.5fr)_minmax(275px,.95fr)] gap-4 border-b bg-[#f7f8f7] px-4 py-3 text-xs font-semibold text-muted-foreground"><span>Colaborador</span><span>Confirmação</span><span>Justificativa</span><span>Presença</span><span>Ações</span></div>
        {participants.map((participant) => <div key={participant.id} className="grid grid-cols-[minmax(230px,1.05fr)_minmax(160px,.65fr)_minmax(230px,1fr)_minmax(130px,.5fr)_minmax(275px,.95fr)] items-center gap-4 border-b border-border/50 px-4 py-3.5 last:border-0 hover:bg-[#fbfcfb]"><ParticipantIdentity participant={participant} /><div><Badge variant="outline" className={statusStyle(participant.expectationStatus)}>{statusLabel(participant.expectationStatus)}</Badge><p className="mt-1 text-[10px] text-muted-foreground">{sourceLabel(participant.expectationSource)}</p></div><JustificationPreview participant={participant} /><div className="text-xs"><p className={participant.checkinAt ? "font-semibold text-emerald-700" : "text-muted-foreground"}>{participant.checkinAt ? "Presente" : "Não registrada"}</p><p className="mt-0.5 text-muted-foreground">{formatDateTime(participant.checkinAt)}</p></div><ParticipantActions participant={participant} busy={busy} onChange={onParticipantChange} /></div>)}
      </div>
      <div className="grid gap-3 xl:hidden">
        {participants.map((participant) => <article key={participant.id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"><ParticipantIdentity participant={participant} /><div className="mt-4 flex flex-wrap items-center justify-between gap-2"><div><Badge variant="outline" className={statusStyle(participant.expectationStatus)}>{statusLabel(participant.expectationStatus)}</Badge><p className="mt-1 text-[10px] text-muted-foreground">{sourceLabel(participant.expectationSource)}</p></div><span className={cn("text-xs font-semibold", participant.checkinAt ? "text-emerald-700" : "text-muted-foreground")}>{participant.checkinAt ? formatDateTime(participant.checkinAt) : "Sem presença"}</span></div>{participant.responsumJustifications.length > 0 && <div className="mt-3"><JustificationPreview participant={participant} expanded /></div>}<div className="mt-4 border-t border-border/50 pt-4"><ParticipantActions participant={participant} busy={busy} onChange={onParticipantChange} /></div></article>)}
      </div>
      {participants.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhum colaborador corresponde aos filtros.</div>}
      <p className="text-right text-xs text-muted-foreground">Exibindo {participants.length} de {data.participants.length} colaboradores</p>
    </div>
  );
}

export function EventoPresencasTab({ eventId, onDataChange }: { eventId: string; onDataChange?: (data: CafeAdminData) => void }) {
  const [data, setData] = useState<CafeAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [view, setView] = useState<"participants" | "settings">("participants");
  const [search, setSearch] = useState(""); const [status, setStatus] = useState<FilterStatus>("all"); const [presence, setPresence] = useState<PresenceFilter>("all"); const [department, setDepartment] = useState("all"); const [source, setSource] = useState<"all" | CafeExpectationSource>("all"); const [justificationOnly, setJustificationOnly] = useState(false); const [sort, setSort] = useState<SortMode>("name");
  const [sheetGroup, setSheetGroup] = useState<SheetGroup>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "fallback">("connecting"); const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null); const realtimeDebounce = useRef<number | null>(null);
  const [settings, setSettings] = useState({ name: "", eventDate: "", location: "", cutoff: "", opens: "", closes: "" });

  const applyData = useCallback((next: CafeAdminData, syncSettings = true) => {
    setData(next); setLastUpdatedAt(new Date()); onDataChange?.(next);
    if (syncSettings) setSettings({ name: next.event.name, eventDate: next.event.eventDate, location: next.event.location ?? "", cutoff: toLocalInput(next.event.attendanceCutoffAt), opens: toLocalInput(next.event.checkinOpensAt), closes: toLocalInput(next.event.checkinClosesAt) });
  }, [onDataChange]);

  const load = useCallback(async ({ silent = false, syncSettings = true } = {}) => {
    if (!silent) setLoading(true); setError("");
    try { const response = await fetch(`/api/cafe-cultura/editions/${eventId}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Não foi possível carregar as presenças."); applyData(body.data, syncSettings); }
    catch (loadError) { if (!silent) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as presenças."); }
    finally { if (!silent) setLoading(false); }
  }, [applyData, eventId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setRealtimeStatus("connecting");
    const refreshSilently = () => { if (realtimeDebounce.current) window.clearTimeout(realtimeDebounce.current); realtimeDebounce.current = window.setTimeout(() => void load({ silent: true, syncSettings: false }), 250); };
    const channel = supabase.channel(`cafe-cultura-admin-${eventId}`).on("postgres_changes", { event: "*", schema: "public", table: "event_participants", filter: `event_id=eq.${eventId}` }, refreshSilently).subscribe((channelStatus) => { if (channelStatus === "SUBSCRIBED") setRealtimeStatus("live"); if (channelStatus === "CHANNEL_ERROR" || channelStatus === "TIMED_OUT") setRealtimeStatus("fallback"); });
    const reconciliation = window.setInterval(() => void load({ silent: true, syncSettings: false }), 20_000);
    return () => { if (realtimeDebounce.current) window.clearTimeout(realtimeDebounce.current); window.clearInterval(reconciliation); void supabase.removeChannel(channel); };
  }, [eventId, load]);

  async function request(path: string, options: RequestInit, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { const response = await fetch(path, options); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Não foi possível concluir."); if (body.data) applyData(body.data); else await load(); setNotice(success); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Não foi possível concluir."); }
    finally { setBusy(false); }
  }

  const departments = useMemo(() => data ? [...new Set(data.participants.map((participant) => participant.department ?? "Sem área"))].sort((a, b) => a.localeCompare(b, "pt-BR")) : [], [data]);
  const activeFilterCount = [status !== "all", presence !== "all", department !== "all", source !== "all", justificationOnly, sort !== "name"].filter(Boolean).length;
  const resetFilters = () => { setSearch(""); setStatus("all"); setPresence("all"); setDepartment("all"); setSource("all"); setJustificationOnly(false); setSort("name"); };

  if (loading) return <div className="flex min-h-64 items-center justify-center rounded-2xl border"><LoaderCircle className="size-6 animate-spin text-[#347796]" /></div>;
  if (!data) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">{error || "Painel indisponível."}<div><Button variant="outline" onClick={() => void load()} className="mt-4"><RefreshCw /> Tentar novamente</Button></div></div>;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[#347796]/20 bg-[linear-gradient(120deg,#eef7f7_0%,#fff_48%,#fbf2e5_100%)]">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#173d4d] text-[#f1c989]"><Coffee className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">Central de presença</h3><span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold", realtimeStatus === "live" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{realtimeStatus === "live" ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}{realtimeStatus === "live" ? "Atualização ao vivo" : realtimeStatus === "connecting" ? "Conectando…" : "Reconciliação automática"}</span></div><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">O RESPONSUM atualiza justificativas e cada leitura da etiqueta aparece no painel automaticamente.</p><p className="mt-2 text-[11px] font-medium text-[#285f73]">Dados atualizados {lastUpdatedAt ? `às ${formatTime(lastUpdatedAt)}` : "agora"} · RESPONSUM: {data.lastSync ? `${formatDateTime(data.lastSync.finishedAt ?? data.lastSync.startedAt)} · ${data.lastSync.status}` : "ainda não sincronizado"}</p></div></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => request(`/api/cafe-cultura/editions/${eventId}/roster`, { method: "POST" }, "Lista oficial atualizada.")}><Users /> Atualizar lista</Button><Button disabled={busy} onClick={() => request(`/api/cafe-cultura/editions/${eventId}/sync-responsum`, { method: "POST" }, "Justificativas sincronizadas.")}><RefreshCw className={busy ? "animate-spin" : ""} /> Sincronizar RESPONSUM</Button><Button asChild variant="outline"><a href={`/api/cafe-cultura/editions/${eventId}/export`}><Download /> Exportar planilha</a></Button></div>
        </div>
        <div className="flex border-t border-[#347796]/15 bg-white/55 px-3 pt-1"><button type="button" onClick={() => setView("participants")} className={cn("inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold", view === "participants" ? "border-[#347796] text-[#285f73]" : "border-transparent text-muted-foreground")}><ListFilter className="size-4" /> Participantes</button><button type="button" onClick={() => setView("settings")} className={cn("inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold", view === "settings" ? "border-[#347796] text-[#285f73]" : "border-transparent text-muted-foreground")}><Settings2 className="size-4" /> Configuração</button></div>
      </section>
      {(error || notice) && <div role={error ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>{error || notice}</div>}
      {view === "settings" ? (
        <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6"><div className="mb-5 flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf5f7] text-[#285f73]"><CalendarClock className="size-4" /></span><div><h3 className="text-sm font-semibold">Dados e janela de check-in</h3><p className="mt-1 text-xs text-muted-foreground">Essas alterações afetam somente a edição selecionada.</p></div></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7"><div className="space-y-1.5 sm:col-span-2 xl:col-span-2"><Label htmlFor="cafe-name">Nome da edição</Label><Input id="cafe-name" value={settings.name} onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))} /></div><div className="space-y-1.5"><Label htmlFor="cafe-date">Data</Label><Input id="cafe-date" type="date" value={settings.eventDate} onChange={(e) => setSettings((s) => ({ ...s, eventDate: e.target.value }))} /></div><div className="space-y-1.5"><Label htmlFor="cafe-location">Local</Label><Input id="cafe-location" value={settings.location} onChange={(e) => setSettings((s) => ({ ...s, location: e.target.value }))} placeholder="Informe o local" /></div><div className="space-y-1.5"><Label htmlFor="cafe-cutoff">Prazo para o local</Label><Input id="cafe-cutoff" type="datetime-local" value={settings.cutoff} onChange={(e) => setSettings((s) => ({ ...s, cutoff: e.target.value }))} /></div><div className="space-y-1.5"><Label htmlFor="cafe-opens">Abertura</Label><Input id="cafe-opens" type="datetime-local" value={settings.opens} onChange={(e) => setSettings((s) => ({ ...s, opens: e.target.value }))} /></div><div className="space-y-1.5"><Label htmlFor="cafe-closes">Encerramento</Label><Input id="cafe-closes" type="datetime-local" value={settings.closes} onChange={(e) => setSettings((s) => ({ ...s, closes: e.target.value }))} /></div></div><div className="mt-5 flex justify-end"><Button disabled={busy} onClick={() => request(`/api/cafe-cultura/editions/${eventId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: { name: settings.name, eventDate: settings.eventDate, location: settings.location || null, attendanceCutoffAt: fromLocalInput(settings.cutoff), checkinOpensAt: fromLocalInput(settings.opens), checkinClosesAt: fromLocalInput(settings.closes) } }) }, "Configuração salva.")}>Salvar configuração</Button></div></section>
      ) : (
        <><div className="rounded-2xl border border-border/60 bg-white p-3 shadow-sm sm:p-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, área, e-mail ou texto da justificativa" className="pl-9" /></div><div className="flex flex-wrap gap-2"><select aria-label="Filtrar situação" value={status} onChange={(e) => setStatus(e.target.value as FilterStatus)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">Todas as situações</option><option value="confirmed">Confirmados</option><option value="excused_absence">Justificados</option><option value="excluded">Excluídos</option></select><select aria-label="Filtrar presença" value={presence} onChange={(e) => setPresence(e.target.value as PresenceFilter)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">Toda presença</option><option value="present">Presentes</option><option value="pending">Check-in pendente</option></select><select aria-label="Filtrar área" value={department} onChange={(e) => setDepartment(e.target.value)} className="h-10 max-w-48 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">Todas as áreas</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select><select aria-label="Filtrar origem" value={source} onChange={(e) => setSource(e.target.value as "all" | CafeExpectationSource)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">Todas as origens</option><option value="automatic_roster">Lista oficial</option><option value="responsum">RESPONSUM</option><option value="admin">Ajuste manual</option></select><select aria-label="Ordenar participantes" value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="name">Nome A–Z</option><option value="checkin_recent">Check-in recente</option><option value="status">Situação</option></select></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><SlidersHorizontal className="size-3.5" /> Filtros rápidos</span><button type="button" onClick={() => setJustificationOnly((value) => !value)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition", justificationOnly ? "border-[#d9b56c] bg-[#fbf3e3] text-[#76551e]" : "border-border bg-white text-muted-foreground hover:border-[#d9b56c]/60")}><MessageSquareQuote className="size-3.5" /> Com justificativa</button></div>{(activeFilterCount > 0 || search) && <Button type="button" variant="ghost" size="sm" onClick={resetFilters}><RotateCcw className="size-3.5" /> Limpar {activeFilterCount > 0 ? `(${activeFilterCount})` : "busca"}</Button>}</div></div>
        <EventoPresencasContent data={data} search={search} status={status} presence={presence} department={department} source={source} justificationOnly={justificationOnly} sort={sort} busy={busy} onOpenGroup={setSheetGroup} onParticipantChange={(userId, patch) => request(`/api/cafe-cultura/editions/${eventId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ participant: { userId, ...patch } }) }, "Participação atualizada.")} /><SummarySheet group={sheetGroup} participants={data.participants} onOpenChange={(open) => { if (!open) setSheetGroup(null); }} /></>
      )}
    </div>
  );
}
