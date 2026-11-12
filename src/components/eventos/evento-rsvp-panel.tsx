"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  Car,
  Check,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  Hourglass,
  Link2,
  RefreshCw,
  UserPlus,
  UserRoundX,
  UsersRound,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventPerson } from "@/components/eventos/event-person";
import { cn } from "@/lib/utils";
import {
  RSVP_TRANSPORT_LABEL,
  countRsvp,
  formatRsvpDeadline,
  usesOutbound,
  usesReturn,
  type RsvpPanelData,
  type RsvpPerson,
} from "@/lib/event-rsvp";

type Filter = "confirmado" | "onibus" | "sem_resposta" | "recusado" | "todos";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "confirmado", label: "Vão" },
  { value: "onibus", label: "Micro-ônibus" },
  { value: "sem_resposta", label: "Sem resposta" },
  { value: "recusado", label: "Não vão" },
  { value: "todos", label: "Todos" },
];

const STATUS_LABEL: Record<RsvpPerson["status"], string> = {
  confirmado: "Vai",
  recusado: "Não vai",
  sem_resposta: "Sem resposta",
};

const TRANSPORT_ICON: Record<NonNullable<RsvpPerson["transport"]>, LucideIcon> = {
  ida_volta: Bus,
  so_ida: ArrowRight,
  so_volta: ArrowLeft,
  nao: Car,
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

async function exportExcel(people: RsvpPerson[], fileName: string) {
  const XLSX = await import("xlsx");
  const header = ["Nome", "Área", "Resposta", "Micro-ônibus", "Ida no ônibus", "Volta no ônibus", "Restrição alimentar", "Acompanhante", "Restrição do acompanhante", "Respondido em"];
  const rows = people.map((person) => [
    person.name,
    person.department ?? "",
    STATUS_LABEL[person.status],
    person.transport ? RSVP_TRANSPORT_LABEL[person.transport] : "",
    usesOutbound(person.transport) && person.status === "confirmado" ? "Sim" : "",
    usesReturn(person.transport) && person.status === "confirmado" ? "Sim" : "",
    person.dietary ?? "",
    person.plusOneName ?? "",
    person.plusOneDietary ?? "",
    formatDateTime(person.respondedAt),
  ]);
  const going = people.filter((person) => person.status === "confirmado");
  // O acompanhante segue a escolha de quem o leva: entra na mesma lista do ônibus.
  const leg = (pick: (person: RsvpPerson) => boolean) => [
    ["Nome", "Área"],
    ...going.filter(pick).flatMap((person) => [
      [person.name, person.department ?? ""],
      ...(person.plusOneName ? [[person.plusOneName, `Acompanhante de ${person.shortName}`]] : []),
    ]),
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([header, ...rows]), "Respostas");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(leg((person) => usesOutbound(person.transport))), "Ônibus - ida");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(leg((person) => usesReturn(person.transport))), "Ônibus - volta");
  XLSX.writeFile(book, fileName);
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
  active,
  onClick,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail?: string;
  active: boolean;
  onClick: () => void;
  tone: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-background p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary",
        active ? "border-primary/60 bg-primary/5" : "border-border/60 hover:border-primary/40"
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)} aria-hidden>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold leading-none tabular-nums">{value}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {label}
          {detail ? ` · ${detail}` : ""}
        </span>
      </span>
    </button>
  );
}

/** Respostas da equipe à confirmação de presença (só aparece quando o evento tem prazo de confirmação). */
export function EventoRsvpPanel({ eventId, refreshKey }: { eventId: string; refreshKey?: string }) {
  const [data, setData] = useState<RsvpPanelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("confirmado");
  const [copied, setCopied] = useState<"link" | "nomes" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/eventos/${eventId}/rsvp`, { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as (RsvpPanelData & { error?: string }) | null;
      if (!response.ok || !body) throw new Error(body?.error ?? "Não foi possível carregar as respostas.");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as respostas.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const people = useMemo(() => data?.people ?? [], [data]);
  const counts = useMemo(() => countRsvp(people), [people]);
  const visible = useMemo(() => {
    if (filter === "todos") return people;
    if (filter === "onibus") {
      return people.filter((person) => person.status === "confirmado" && (usesOutbound(person.transport) || usesReturn(person.transport)));
    }
    return people.filter((person) => person.status === filter);
  }, [people, filter]);

  if (error && !data) {
    return (
      <section className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
        {error}{" "}
        <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => void load()}>
          Tentar de novo
        </button>
      </section>
    );
  }
  if (!data?.enabled) return null;

  const total = people.length;
  const answered = counts.confirmed + counts.declined;
  const percent = total ? Math.round((answered / total) * 100) : 0;
  const pageUrl = data.pagePath && typeof window !== "undefined" ? `${window.location.origin}${data.pagePath}` : null;
  const busRiders = counts.riders;

  const copy = async (text: string, kind: "link" | "nomes") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eaf5f7] text-[#285f73]" aria-hidden>
            <ClipboardCheck className="size-[18px]" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Confirmação da equipe</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.closesAt ? (
                <>
                  {data.open ? "Aberta até" : "Encerrada em"} {formatRsvpDeadline(data.closesAt, true)} · {answered} de {total} responderam
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {pageUrl && (
            <>
              <Button variant="outline" size="sm" onClick={() => void copy(pageUrl, "link")}>
                {copied === "link" ? <Check className="size-4" /> : <Link2 className="size-4" />}
                {copied === "link" ? "Link copiado" : "Copiar link"}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`${data.pagePath}?previa=1`} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Ver página
                </a>
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => void exportExcel(people, "confirmacao-equipe.xlsx")}>
            <Download className="size-4" />
            Excel
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Atualizar respostas" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={UsersRound}
          label="Vão"
          value={counts.headcount}
          detail={counts.companions ? `${counts.confirmed} + ${counts.companions} ${counts.companions === 1 ? "acompanhante" : "acompanhantes"}` : `${percent}% responderam`}
          active={filter === "confirmado"}
          onClick={() => setFilter("confirmado")}
          tone="bg-emerald-50 text-emerald-700"
        />
        <Stat icon={Bus} label="Micro-ônibus" value={busRiders} detail={`ida ${counts.outbound} · volta ${counts.returning}`} active={filter === "onibus"} onClick={() => setFilter("onibus")} tone="bg-amber-50 text-amber-700" />
        <Stat icon={Hourglass} label="Sem resposta" value={counts.pending} active={filter === "sem_resposta"} onClick={() => setFilter("sem_resposta")} tone="bg-slate-100 text-slate-600" />
        <Stat icon={UserRoundX} label="Não vão" value={counts.declined} active={filter === "recusado"} onClick={() => setFilter("recusado")} tone="bg-rose-50 text-rose-700" />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar respostas">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === option.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {filter === "sem_resposta" && visible.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => void copy(visible.map((person) => person.shortName).join("\n"), "nomes")}>
            {copied === "nomes" ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied === "nomes" ? "Nomes copiados" : "Copiar nomes para cobrar"}
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Ninguém nesta lista por enquanto.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((person) => {
            const TransportIcon = person.transport ? TRANSPORT_ICON[person.transport] : null;
            return (
              <li key={person.inviteId} className="flex items-center gap-3 rounded-xl border border-border/50 bg-background px-3 py-2.5">
                <EventPerson name={person.shortName} avatar={person.avatarUrl} compact />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={person.name}>
                    {person.shortName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {person.department ?? "—"}
                    {person.respondedAt ? ` · ${formatDateTime(person.respondedAt)}` : ""}
                  </p>
                  {person.dietary && person.dietary !== "Nenhuma restrição" && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-amber-700" title={person.dietary}>
                      <UtensilsCrossed className="size-3 shrink-0" aria-hidden />
                      {person.dietary}
                    </p>
                  )}
                  {person.plusOneName && (
                    <p
                      className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-foreground/75"
                      title={person.plusOneDietary ? `${person.plusOneName} · ${person.plusOneDietary}` : person.plusOneName}
                    >
                      <UserPlus className="size-3 shrink-0" aria-hidden />
                      {person.plusOneName}
                      {person.plusOneDietary ? <span className="text-amber-700"> · {person.plusOneDietary}</span> : null}
                    </p>
                  )}
                </div>
                {person.status === "confirmado" && TransportIcon && person.transport ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-foreground/80">
                    <TransportIcon className="size-3.5" aria-hidden />
                    {person.transport === "nao" ? "Por conta" : RSVP_TRANSPORT_LABEL[person.transport]}
                  </span>
                ) : filter === "todos" ? (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{STATUS_LABEL[person.status]}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
