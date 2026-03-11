"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { getAreaIcon } from "@/lib/area-icons";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface PostRowProps {
  request: MarketingRequest;
  className?: string;
}

export function PostRow({ request, className }: PostRowProps) {
  const AreaIcon = getAreaIcon(request.requesting_area);
  const displayName =
    request.nome_advogado || request.solicitante_user?.name || request.solicitante || "—";
  const title = request.description || request.title;

  return (
    <div
      className={`flex items-center gap-3 min-w-0 p-2 rounded-lg border border-transparent ${className ?? ""}`}
    >
      {request.solicitante_user ? (
        <Avatar className="h-8 w-8 shrink-0 border border-white/50 dark:border-white/20">
          <AvatarImage src={request.solicitante_user.avatar_url || undefined} />
          <AvatarFallback className="text-xs bg-muted text-muted-foreground">
            {getInitials(request.solicitante_user.name)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <Avatar className="h-8 w-8 shrink-0 border border-white/50 dark:border-white/20">
          <AvatarFallback className="text-xs bg-muted text-muted-foreground">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate" title={title}>
          {title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <AreaIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          <span className="text-xs text-muted-foreground truncate">{displayName}</span>
        </div>
      </div>
    </div>
  );
}
