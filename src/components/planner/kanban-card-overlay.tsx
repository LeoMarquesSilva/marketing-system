"use client";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAreaIcon } from "@/lib/area-icons";
import { getTypeColor } from "@/lib/type-icons";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, MessageSquare } from "lucide-react";
import type { MarketingRequest } from "@/lib/marketing-requests";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface KanbanCardOverlayProps {
  request: MarketingRequest;
  timeTotal?: string;
  commentsCount?: number;
}

/**
 * Versão do card para o DragOverlay - sem listeners de drag,
 * renderizado em portal para aparecer sempre na frente.
 */
export function KanbanCardOverlay({ request, timeTotal, commentsCount = 0 }: KanbanCardOverlayProps) {
  const AreaIcon = getAreaIcon(request.requesting_area);
  const typeColor = getTypeColor(request.request_type || "");
  const solicitanteName = request.solicitante_user?.name || request.solicitante;

  return (
    <div
      className="
        w-72 rotate-2 cursor-grabbing overflow-hidden rounded-2xl p-5 opacity-95
        bg-gradient-to-br from-white/80 via-white/50 to-white/30 dark:from-white/20 dark:via-white/10 dark:to-white/5
        backdrop-blur-xl border border-white/50 dark:border-white/20
        shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15)] ring-2 ring-primary
      "
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <span className="text-base font-semibold tracking-tight line-clamp-2 leading-snug flex-1 min-w-0">
            {request.title}
          </span>
          <Badge
            variant="secondary"
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${typeColor}`}
          >
            {request.request_type}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <AreaIcon className="h-4 w-4 shrink-0 opacity-80" />
            {request.requesting_area}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 shrink-0 opacity-80" />
            {format(new Date(request.requested_at), "dd/MM/yyyy", { locale: ptBR })}
          </span>
          {timeTotal && timeTotal !== "0min" && (
            <span className="flex items-center gap-1.5 text-primary font-medium">
              <Clock className="h-4 w-4 shrink-0" />
              {timeTotal}
            </span>
          )}
        </div>

        {request.description && (
          <p className="text-sm text-muted-foreground/80 line-clamp-2 leading-relaxed">
            {request.description}
          </p>
        )}

        <div className="border-t border-border/20" />

        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MessageSquare className="h-4 w-4 shrink-0 opacity-80" />
            {commentsCount} comentário{commentsCount !== 1 ? "s" : ""}
          </span>
          <div className="flex -space-x-3">
            {request.assignee_user ? (
              <>
                <Avatar className="h-8 w-8 shrink-0 border-2 border-white dark:border-background ring-2 ring-background">
                  <AvatarImage src={request.assignee_user.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(request.assignee_user.name)}
                  </AvatarFallback>
                </Avatar>
                {solicitanteName && request.assignee_user.name !== solicitanteName && (
                  <Avatar className="h-8 w-8 shrink-0 border-2 border-white dark:border-background ring-2 ring-background">
                    <AvatarImage src={request.solicitante_user?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-muted">
                      {getInitials(solicitanteName)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </>
            ) : (
              <span className="text-xs text-muted-foreground italic">Não atribuído</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
