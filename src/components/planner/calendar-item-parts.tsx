"use client";

import { AlertTriangle, Share2, Sparkles, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { CalendarPerson } from "@/lib/planner-calendar";
import { cn } from "@/lib/utils";

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ContentTypeTag({ reel, className }: { reel: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        reel
          ? "bg-violet-100/80 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
          : "bg-sky-100/80 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
        className
      )}
    >
      {reel ? <Video className="h-3 w-3" aria-hidden /> : <Share2 className="h-3 w-3" aria-hidden />}
      {reel ? "Reel" : "Post"}
    </span>
  );
}

export type RotationHint = "recommended" | "last-area" | "repeat";

const HINTS: Record<RotationHint, { label: string; title: string; className: string; icon: typeof Sparkles }> = {
  recommended: {
    label: "Vez da área",
    title: "Área recomendada pelo rodízio para o próximo post",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    icon: Sparkles,
  },
  "last-area": {
    label: "Área do último post",
    title: "Mesma área do post mais recente do calendário; se der, poste outra antes",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    icon: AlertTriangle,
  },
  repeat: {
    label: "Repete área",
    title: "Mesma área do post anterior no calendário",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    icon: AlertTriangle,
  },
};

export function RotationHintTag({ hint, className }: { hint: RotationHint; className?: string }) {
  const { label, title, className: tone, icon: Icon } = HINTS[hint];
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", tone, className)}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

export function PeopleAvatars({
  people,
  size = "sm",
  showNames = true,
}: {
  people: CalendarPerson[];
  size?: "xs" | "sm" | "md";
  showNames?: boolean;
}) {
  if (people.length === 0) return null;
  const avatarSize = size === "xs" ? "h-5 w-5" : size === "sm" ? "h-6 w-6" : "h-9 w-9";
  const fallbackText = size === "md" ? "text-xs" : "text-[8px]";
  const names = people.map((p) => p.name).join(", ");
  return (
    <div className="flex min-w-0 items-center gap-1.5" title={names}>
      <div className="flex shrink-0 -space-x-1.5">
        {people.slice(0, 3).map((person) => (
          <Avatar key={person.name} className={cn(avatarSize, "border border-background")}>
            <AvatarImage src={person.avatarUrl || undefined} />
            <AvatarFallback className={cn(fallbackText, "bg-muted text-muted-foreground")}>
              {getInitials(person.name || "?")}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      {showNames && (
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
          {people.length === 1 ? people[0].name : `${people[0].name.split(" ")[0]} e mais ${people.length - 1}`}
        </span>
      )}
    </div>
  );
}
