"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function EventPerson({ name, avatar, compact = false, className }: {
  name: string; avatar?: string | null; compact?: boolean; className?: string;
}) {
  const initials = name.trim().split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join("");
  return <span title={name} role={compact ? "img" : undefined} aria-label={compact ? name : undefined} className={cn("inline-flex min-w-0 items-center gap-2", className)}>
    <Avatar className={cn("ring-2 ring-card", compact ? "size-7" : "size-9")}>
      <AvatarImage src={avatar || undefined} alt={compact ? name : ""} className="object-cover" />
      <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">{initials || "?"}</AvatarFallback>
    </Avatar>
    {!compact && <span className="truncate text-sm">{name}</span>}
  </span>;
}
