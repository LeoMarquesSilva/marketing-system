"use client";

import { useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getAreaIcon } from "@/lib/area-icons";
import { getTypeColor } from "@/lib/type-icons";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { CheckCircle2, CalendarCheck, Timer, User } from "lucide-react";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const COMPLETION_CONFIG: Record<string, { label: string; className: string; dotClass: string }> = {
  design_concluido:  { label: "Design",   className: "bg-[#101f2e]/8 text-[#101f2e] dark:bg-white/10 dark:text-white/80",     dotClass: "bg-[#101f2e]" },
  postagem_feita:    { label: "Postagem", className: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400", dotClass: "bg-emerald-500" },
  conteudo_entregue: { label: "Conteúdo", className: "bg-violet-100/80 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",    dotClass: "bg-violet-500" },
};

function CompletedCard({ req }: { req: MarketingRequest }) {
  const completion = req.completion_type ? COMPLETION_CONFIG[req.completion_type] : null;
  const solicitante = req.solicitante_user?.name ?? req.solicitante;
  const designer = req.assignee_user?.name ?? req.assignee;
  const daysToDeliver =
    req.delivered_at
      ? differenceInDays(new Date(req.delivered_at), new Date(req.requested_at))
      : null;

  return (
    <article className="group flex flex-col gap-3 rounded-2xl p-4 cursor-default
      bg-gradient-to-br from-white/90 via-white/70 to-white/50
      dark:from-white/10 dark:via-white/5 dark:to-white/[0.02]
      backdrop-blur-xl border border-white/60 dark:border-white/10
      shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)]
      hover:shadow-[0_8px_24px_-6px_rgba(16,31,46,0.12),0_0_0_1px_rgba(16,31,46,0.05)]
      hover:-translate-y-0.5 transition-all duration-200 ease-out"
    >
      {/* Top: type + completion badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge
          variant="secondary"
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium border-0 ${getTypeColor(req.request_type || "")}`}
        >
          {req.request_type || "Solicitação"}
        </Badge>
        {completion && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${completion.className}`}>
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${completion.dotClass}`} aria-hidden />
            {completion.label}
          </span>
        )}
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
        {/* Solicitante — who to deliver to */}
        {solicitante && (
          <div className="flex items-center gap-2">
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
              <span className="text-xs font-medium text-foreground/80 truncate">
                {solicitante}
              </span>
            </div>
          </div>
        )}

        {/* Designer */}
        {designer && (
          <div className="flex items-center gap-2">
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

      {/* Footer: delivery date + days */}
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

interface CompletedByAreaProps {
  requests: MarketingRequest[];
  searchQuery?: string;
}

export function CompletedByArea({ requests, searchQuery = "" }: CompletedByAreaProps) {
  const completed = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return requests.filter(
      (r) =>
        r.status === "completed" &&
        (!q ||
          r.title.toLowerCase().includes(q) ||
          (r.solicitante_user?.name ?? r.solicitante ?? "").toLowerCase().includes(q) ||
          (r.assignee_user?.name ?? r.assignee ?? "").toLowerCase().includes(q))
    );
  }, [requests, searchQuery]);

  // Group by area, sorted by count desc
  const grouped = useMemo(() => {
    const map = new Map<string, MarketingRequest[]>();
    for (const req of completed) {
      const area = req.requesting_area || "Outros";
      if (!map.has(area)) map.set(area, []);
      map.get(area)!.push(req);
    }
    // Sort each group by delivered_at desc (most recent first)
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        const da = a.delivered_at ?? a.requested_at;
        const db = b.delivered_at ?? b.requested_at;
        return new Date(db).getTime() - new Date(da).getTime();
      });
    }
    // Sort groups by count desc
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [completed]);

  if (completed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CheckCircle2 className="h-10 w-10 text-muted-foreground/20 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          {searchQuery ? "Nenhum concluído encontrado para essa busca." : "Nenhuma solicitação concluída ainda."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/40 rounded-full px-3 py-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          {completed.length} solicitaç{completed.length !== 1 ? "ões" : "ão"} concluída{completed.length !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-full px-3 py-1.5">
          {grouped.length} área{grouped.length !== 1 ? "s" : ""}
        </span>
      </div>

      {grouped.map(([area, areaRequests]) => {
        const AreaIcon = getAreaIcon(area);
        return (
          <section key={area} aria-labelledby={`area-${area}`}>
            {/* Area header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#101f2e]/8 dark:bg-white/10">
                <AreaIcon className="h-4 w-4 text-[#101f2e]/70 dark:text-white/60" aria-hidden />
              </div>
              <h2 id={`area-${area}`} className="text-sm font-bold text-foreground tracking-tight">
                {area}
              </h2>
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#101f2e]/8 dark:bg-white/10 text-[10px] font-bold text-[#101f2e]/70 dark:text-white/60 px-1.5">
                {areaRequests.length}
              </span>
              <div className="flex-1 h-px bg-border/40" />
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {areaRequests.map((req) => (
                <CompletedCard key={req.id} req={req} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
