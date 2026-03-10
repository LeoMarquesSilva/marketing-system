"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAreaIcon } from "@/lib/area-icons";
import { getTypeColor } from "@/lib/type-icons";
import { COMPLETION_TYPES } from "@/lib/constants";
import type { CompletionTypeConfig } from "@/lib/app-settings";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  CalendarCheck,
  Timer,
  User,
  Search,
  ExternalLink,
} from "lucide-react";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const COMPLETION_CONFIG: Record<string, { label: string; className: string; dotClass: string }> = {
  design_concluido:  { label: "Design",   className: "bg-[#101f2e]/8 text-[#101f2e] dark:bg-white/10 dark:text-white/80",                 dotClass: "bg-[#101f2e]" },
  postagem_feita:    { label: "Postagem", className: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",   dotClass: "bg-emerald-500" },
  conteudo_entregue: { label: "Conteúdo", className: "bg-violet-100/80 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",       dotClass: "bg-violet-500" },
};

interface CompletedCardProps {
  req: MarketingRequest;
  onClick?: () => void;
  completionTypes?: CompletionTypeConfig[];
}

function CompletedCard({ req, onClick, completionTypes }: CompletedCardProps) {
  const configStyle = req.completion_type ? COMPLETION_CONFIG[req.completion_type] : null;
  const labelFromSettings = completionTypes?.find((c) => c.value === req.completion_type)?.label;
  const completion = configStyle
    ? configStyle
    : labelFromSettings
      ? { label: labelFromSettings, className: "bg-muted text-muted-foreground", dotClass: "bg-muted-foreground" }
      : null;
  const solicitante = req.solicitante_user?.name ?? req.solicitante;
  const designer = req.assignee_user?.name ?? req.assignee;
  const daysToDeliver = req.delivered_at
    ? differenceInDays(new Date(req.delivered_at), new Date(req.requested_at))
    : null;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter") onClick?.(); }}
      aria-label={`Ver detalhes: ${req.title}`}
      className="group flex flex-col gap-3 rounded-2xl p-4 cursor-pointer
        bg-gradient-to-br from-white/90 via-white/70 to-white/50
        dark:from-white/10 dark:via-white/5 dark:to-white/[0.02]
        backdrop-blur-xl border border-white/60 dark:border-white/10
        shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)]
        hover:shadow-[0_8px_28px_-6px_rgba(16,31,46,0.14),0_0_0_1px_rgba(16,31,46,0.06)]
        hover:-translate-y-0.5 hover:border-white/80
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101f2e]/30 focus-visible:ring-offset-2
        transition-all duration-200 ease-out"
    >
      {/* Top row: type badge + completion type + open icon */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge
          variant="secondary"
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium border-0 ${getTypeColor(req.request_type || "")}`}
        >
          {req.request_type || "Solicitação"}
        </Badge>
        <div className="flex items-center gap-1.5 ml-auto">
          {completion && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${completion.className}`}>
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${completion.dotClass}`} aria-hidden />
              {completion.label}
            </span>
          )}
          <ExternalLink className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" aria-hidden />
        </div>
      </div>

      {/* Title + description */}
      <div className="space-y-1 min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-foreground line-clamp-2 leading-snug">
          {req.title}
        </h3>
        {req.description && (
          <p className="text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
            {req.description}
          </p>
        )}
      </div>

      {/* People */}
      <div className="space-y-1.5">
        {solicitante && (
          <div className="flex items-center gap-2" title="Solicitante">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#101f2e]/8 dark:bg-white/10">
              <User className="h-3 w-3 text-[#101f2e]/60 dark:text-white/50" aria-hidden />
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
              {req.solicitante_user && (
                <Avatar className="h-4 w-4 shrink-0 border border-white/50">
                  <AvatarImage src={req.solicitante_user.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px] bg-[#101f2e]/10 text-[#101f2e]">
                    {getInitials(req.solicitante_user.name)}
                  </AvatarFallback>
                </Avatar>
              )}
              <span className="text-xs font-medium text-foreground/80 truncate">{solicitante}</span>
            </div>
          </div>
        )}

        {designer && (
          <div className="flex items-center gap-2" title="Designer responsável">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-3 w-3 text-emerald-600/70" aria-hidden />
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
              {req.assignee_user && (
                <Avatar className="h-4 w-4 shrink-0 border border-white/50">
                  <AvatarImage src={req.assignee_user.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px] bg-emerald-500/10 text-emerald-700">
                    {getInitials(req.assignee_user.name)}
                  </AvatarFallback>
                </Avatar>
              )}
              <span className="text-xs text-muted-foreground truncate">{designer}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer: date + days */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/5 dark:border-white/8 mt-auto">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600/70" aria-hidden />
          {req.delivered_at
            ? format(new Date(req.delivered_at), "dd/MM/yyyy", { locale: ptBR })
            : format(new Date(req.requested_at), "dd/MM/yyyy", { locale: ptBR })}
        </span>
        {daysToDeliver !== null && (
          <span className={`flex items-center gap-1 text-[11px] font-medium tabular-nums rounded-full px-2 py-0.5 ${
            daysToDeliver > 10
              ? "bg-amber-100/60 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
              : "bg-emerald-100/60 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          }`}>
            <Timer className="h-3 w-3 shrink-0" aria-hidden />
            {daysToDeliver}d
          </span>
        )}
      </div>
    </article>
  );
}

interface ConcluidosTabProps {
  requests: MarketingRequest[];
  onCardClick?: (request: MarketingRequest) => void;
  completionTypes?: CompletionTypeConfig[];
}

export function ConcluidosTab({ requests, onCardClick, completionTypes }: ConcluidosTabProps) {
  const completionOptions = completionTypes?.length ? completionTypes : COMPLETION_TYPES.map((c) => ({ value: c.value, label: c.label }));
  const [search, setSearch] = useState("");
  const [completionFilter, setCompletionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const concluded = useMemo(
    () => requests.filter((r) => r.workflow_stage === "concluido"),
    [requests]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return concluded.filter((r) => {
      const matchCompletion = completionFilter === "all" || r.completion_type === completionFilter;
      const reqDate = new Date(r.delivered_at || r.requested_at);
      const matchFrom = !dateFrom || reqDate >= new Date(dateFrom);
      const matchTo = !dateTo || reqDate <= new Date(dateTo + "T23:59:59");
      const matchSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        (r.solicitante_user?.name ?? r.solicitante ?? "").toLowerCase().includes(q) ||
        (r.assignee_user?.name ?? r.assignee ?? "").toLowerCase().includes(q);
      return matchCompletion && matchFrom && matchTo && matchSearch;
    });
  }, [concluded, completionFilter, dateFrom, dateTo, search]);

  // Group by area, sorted by count desc; within each group newest first
  const grouped = useMemo(() => {
    const map = new Map<string, MarketingRequest[]>();
    for (const req of filtered) {
      const area = req.requesting_area || "Outros";
      if (!map.has(area)) map.set(area, []);
      map.get(area)!.push(req);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const da = a.delivered_at ?? a.requested_at;
        const db = b.delivered_at ?? b.requested_at;
        return new Date(db).getTime() - new Date(da).getTime();
      });
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" aria-hidden />
          <Input
            placeholder="Buscar título, solicitante, designer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 rounded-xl border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm"
          />
        </div>
        <Select value={completionFilter} onValueChange={setCompletionFilter}>
          <SelectTrigger className="w-[160px] h-9 rounded-xl border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm">
            <SelectValue placeholder="Tipo de conclusão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {completionOptions.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DatePickerField
          value={dateFrom}
          onChange={setDateFrom}
          placeholder="DD/MM/AAAA"
          className="w-[130px] h-9 rounded-xl border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm"
        />
        <DatePickerField
          value={dateTo}
          onChange={setDateTo}
          placeholder="DD/MM/AAAA"
          className="w-[130px] h-9 rounded-xl border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm"
        />

        {/* Summary pill */}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-full px-3 py-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          {filtered.length} concluíd{filtered.length !== 1 ? "os" : "o"}
          {grouped.length > 0 && ` · ${grouped.length} área${grouped.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {concluded.length === 0
              ? "Nenhuma solicitação concluída ainda."
              : "Nenhum concluído encontrado para os filtros selecionados."}
          </p>
        </div>
      )}

      {/* Groups */}
      {grouped.map(([area, areaRequests]) => {
        const AreaIcon = getAreaIcon(area);
        return (
          <section key={area} aria-labelledby={`concluido-area-${area}`}>
            {/* Area header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#101f2e]/8 dark:bg-white/10">
                <AreaIcon className="h-4 w-4 text-[#101f2e]/70 dark:text-white/60" aria-hidden />
              </div>
              <h2
                id={`concluido-area-${area}`}
                className="text-sm font-bold text-foreground tracking-tight"
              >
                {area}
              </h2>
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#101f2e]/8 dark:bg-white/10 text-[10px] font-bold text-[#101f2e]/70 dark:text-white/60 px-1.5">
                {areaRequests.length}
              </span>
              <div className="flex-1 h-px bg-border/40" />
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {areaRequests.map((req) => (
                <CompletedCard
                  key={req.id}
                  req={req}
                  onClick={() => onCardClick?.(req)}
                  completionTypes={completionOptions}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
