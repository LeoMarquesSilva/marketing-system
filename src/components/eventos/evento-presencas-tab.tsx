"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Coffee,
  Download,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  CafeAdminData,
  CafeAdminParticipant,
  CafeExpectationStatus,
} from "@/lib/cafe-cultura/types";
import { cn } from "@/lib/utils";

type FilterStatus = "all" | CafeExpectationStatus | "present" | "pending";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}

function statusLabel(value: CafeExpectationStatus): string {
  if (value === "excused_absence") return "Ausência justificada";
  if (value === "excluded") return "Excluído";
  return "Confirmado";
}

function statusStyle(value: CafeExpectationStatus): string {
  if (value === "excused_absence") return "border-amber-200 bg-amber-50 text-amber-800";
  if (value === "excluded") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-sky-200 bg-sky-50 text-sky-800";
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}:00-03:00`).toISOString();
}

function ParticipantIdentity({ participant }: { participant: CafeAdminParticipant }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-10 shrink-0 border border-border/70">
        {participant.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={participant.avatarUrl} alt={participant.name} className="size-full object-cover" />
        ) : (
          <AvatarFallback className="bg-[#e6f2f3] text-xs font-semibold text-[#285f73]">
            {initials(participant.name)}
          </AvatarFallback>
        )}
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{participant.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[participant.department, participant.email].filter(Boolean).join(" · ") || "Sem área informada"}
        </p>
      </div>
    </div>
  );
}

function ParticipantActions({
  participant,
  busy,
  onChange,
}: {
  participant: CafeAdminParticipant;
  busy: boolean;
  onChange: (userId: string, patch: { expectationStatus?: CafeExpectationStatus; present?: boolean }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={`Situação de ${participant.name}`}
        value={participant.expectationStatus}
        disabled={busy}
        onChange={(event) => onChange(participant.userId, { expectationStatus: event.target.value as CafeExpectationStatus })}
        className="h-9 min-w-40 rounded-lg border border-input bg-background px-2.5 text-xs font-medium"
      >
        <option value="confirmed">Confirmado</option>
        <option value="excused_absence">Ausência justificada</option>
        <option value="excluded">Excluído</option>
      </select>
      <Button
        type="button"
        size="sm"
        variant={participant.checkinAt ? "outline" : "default"}
        disabled={busy}
        onClick={() => onChange(participant.userId, { present: !participant.checkinAt })}
        className="h-9"
      >
        {participant.checkinAt ? <><UserMinus className="size-4" /> Remover presença</> : <><UserCheck className="size-4" /> Registrar presença</>}
      </Button>
    </div>
  );
}

export function EventoPresencasContent({
  data,
  search,
  status,
  busy,
  onParticipantChange,
}: {
  data: CafeAdminData;
  search: string;
  status: FilterStatus;
  busy: boolean;
  onParticipantChange: (userId: string, patch: { expectationStatus?: CafeExpectationStatus; present?: boolean }) => void;
}) {
  const participants = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-BR");
    return data.participants.filter((participant) => {
      const matchesText =
        !normalized ||
        [participant.name, participant.email, participant.department]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalized));
      const matchesStatus =
        status === "all" ||
        (status === "present" && Boolean(participant.checkinAt)) ||
        (status === "pending" && participant.expectationStatus === "confirmed" && !participant.checkinAt) ||
        participant.expectationStatus === status;
      return matchesText && matchesStatus;
    });
  }, [data.participants, search, status]);

  const cards = [
    { label: "Confirmados para o local", value: data.summary.expected, icon: Users, tone: "text-sky-700 bg-sky-50" },
    { label: "Ausências justificadas", value: data.summary.excused, icon: ShieldCheck, tone: "text-amber-700 bg-amber-50" },
    { label: "Presenças registradas", value: data.summary.present, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Pendentes no encontro", value: data.summary.pending, icon: Clock3, tone: "text-slate-700 bg-slate-100" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <span className={cn("flex size-9 items-center justify-center rounded-xl", card.tone)}>
              <card.icon className="size-4" />
            </span>
            <p className="mt-4 text-2xl font-bold tracking-tight">{card.value}</p>
            <p className="mt-1 text-xs leading-4 text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card md:block">
        <div className="grid grid-cols-[minmax(250px,1.4fr)_minmax(160px,.7fr)_minmax(145px,.6fr)_minmax(330px,1fr)] gap-4 border-b bg-muted/35 px-4 py-3 text-xs font-semibold text-muted-foreground">
          <span>Colaborador</span><span>Situação</span><span>Presença</span><span>Ações</span>
        </div>
        {participants.map((participant) => (
          <div key={participant.id} className="grid grid-cols-[minmax(250px,1.4fr)_minmax(160px,.7fr)_minmax(145px,.6fr)_minmax(330px,1fr)] items-center gap-4 border-b border-border/50 px-4 py-3 last:border-0">
            <ParticipantIdentity participant={participant} />
            <div>
              <Badge variant="outline" className={statusStyle(participant.expectationStatus)}>{statusLabel(participant.expectationStatus)}</Badge>
              {participant.responsumTicketCount > 0 && <p className="mt-1 text-[10px] text-muted-foreground">{participant.responsumTicketCount} registro(s) no RESPONSUM</p>}
            </div>
            <div className="text-xs">
              <p className={participant.checkinAt ? "font-semibold text-emerald-700" : "text-muted-foreground"}>{participant.checkinAt ? "Presente" : "Não registrada"}</p>
              <p className="mt-0.5 text-muted-foreground">{formatDateTime(participant.checkinAt)}</p>
            </div>
            <ParticipantActions participant={participant} busy={busy} onChange={onParticipantChange} />
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:hidden">
        {participants.map((participant) => (
          <article key={participant.id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <ParticipantIdentity participant={participant} />
            <div className="mt-4 flex items-center justify-between gap-3">
              <Badge variant="outline" className={statusStyle(participant.expectationStatus)}>{statusLabel(participant.expectationStatus)}</Badge>
              <span className={cn("text-xs font-semibold", participant.checkinAt ? "text-emerald-700" : "text-muted-foreground")}>
                {participant.checkinAt ? formatDateTime(participant.checkinAt) : "Sem presença"}
              </span>
            </div>
            <div className="mt-4 border-t border-border/50 pt-4">
              <ParticipantActions participant={participant} busy={busy} onChange={onParticipantChange} />
            </div>
          </article>
        ))}
      </div>
      {participants.length === 0 && (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhum colaborador corresponde aos filtros.</div>
      )}
    </div>
  );
}

export function EventoPresencasTab({ eventId }: { eventId: string }) {
  const [data, setData] = useState<CafeAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [settings, setSettings] = useState({ eventDate: "", location: "", cutoff: "", opens: "", closes: "" });

  const applyData = useCallback((next: CafeAdminData) => {
    setData(next);
    setSettings({
      eventDate: next.event.eventDate,
      location: next.event.location ?? "",
      cutoff: toLocalInput(next.event.attendanceCutoffAt),
      opens: toLocalInput(next.event.checkinOpensAt),
      closes: toLocalInput(next.event.checkinClosesAt),
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/eventos/${eventId}/attendance`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar as presenças.");
      applyData(body.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as presenças.");
    } finally {
      setLoading(false);
    }
  }, [eventId, applyData]);

  useEffect(() => {
    void load();
  }, [load]);

  async function request(path: string, options: RequestInit, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(path, options);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível concluir.");
      if (body.data) applyData(body.data);
      else await load();
      setNotice(success);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center rounded-2xl border"><LoaderCircle className="size-6 animate-spin text-[#347796]" /></div>;
  }
  if (!data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">{error || "Painel indisponível."}<div><Button variant="outline" onClick={load} className="mt-4"><RefreshCw /> Tentar novamente</Button></div></div>;
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[#347796]/20 bg-[linear-gradient(120deg,#eff8f8_0%,#fff_52%,#fbf2e5_100%)] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#173d4d] text-[#f1c989]"><Coffee className="size-5" /></span>
            <div>
              <h3 className="font-semibold">Operação do encontro</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                Todos entram confirmados. O RESPONSUM aplica as justificativas e a etiqueta registra quem chegou.
              </p>
              <p className="mt-2 text-xs font-medium text-[#285f73]">
                Última sincronização: {data.lastSync ? `${formatDateTime(data.lastSync.finishedAt ?? data.lastSync.startedAt)} · ${data.lastSync.status}` : "ainda não executada"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => request(`/api/eventos/${eventId}/attendance/roster`, { method: "POST" }, "Lista de colaboradores atualizada.")}><Users /> Atualizar lista</Button>
            <Button disabled={busy} onClick={() => request(`/api/eventos/${eventId}/attendance/sync-responsum`, { method: "POST" }, "Justificativas sincronizadas.")}><RefreshCw className={busy ? "animate-spin" : ""} /> Sincronizar agora</Button>
            <Button asChild variant="outline"><a href={`/api/eventos/${eventId}/attendance/export`}><Download /> Exportar CSV</a></Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2"><CalendarClock className="size-4 text-[#347796]" /><h3 className="text-sm font-semibold">Data e janela de confirmação</h3></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5"><Label htmlFor="cafe-date">Data</Label><Input id="cafe-date" type="date" value={settings.eventDate} onChange={(e) => setSettings((s) => ({ ...s, eventDate: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label htmlFor="cafe-location">Local</Label><Input id="cafe-location" value={settings.location} onChange={(e) => setSettings((s) => ({ ...s, location: e.target.value }))} placeholder="Informe o local" /></div>
          <div className="space-y-1.5"><Label htmlFor="cafe-cutoff">Prazo para o local</Label><Input id="cafe-cutoff" type="datetime-local" value={settings.cutoff} onChange={(e) => setSettings((s) => ({ ...s, cutoff: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label htmlFor="cafe-opens">Abertura</Label><Input id="cafe-opens" type="datetime-local" value={settings.opens} onChange={(e) => setSettings((s) => ({ ...s, opens: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label htmlFor="cafe-closes">Encerramento</Label><Input id="cafe-closes" type="datetime-local" value={settings.closes} onChange={(e) => setSettings((s) => ({ ...s, closes: e.target.value }))} /></div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button disabled={busy} onClick={() => request(`/api/eventos/${eventId}/attendance`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: { eventDate: settings.eventDate, location: settings.location || null, attendanceCutoffAt: fromLocalInput(settings.cutoff), checkinOpensAt: fromLocalInput(settings.opens), checkinClosesAt: fromLocalInput(settings.closes) } }) }, "Configuração salva.")}>Salvar configuração</Button>
        </div>
      </section>

      {(error || notice) && <div role={error ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>{error || notice}</div>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, área ou e-mail" className="pl-9" /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value as FilterStatus)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
          <option value="all">Todos</option><option value="confirmed">Confirmados</option><option value="excused_absence">Ausências justificadas</option><option value="present">Presentes</option><option value="pending">Pendentes</option><option value="excluded">Excluídos</option>
        </select>
      </div>

      <EventoPresencasContent
        data={data}
        search={search}
        status={status}
        busy={busy}
        onParticipantChange={(userId, patch) => request(`/api/eventos/${eventId}/attendance`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ participant: { userId, ...patch } }) }, "Participação atualizada.")}
      />
    </div>
  );
}
