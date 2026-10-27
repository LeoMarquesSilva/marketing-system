"use client";

import { UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { WhatsappAgent } from "./whatsapp-crm-types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase() || "?";
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Foto de quem atende; sem responsável mostra um ícone neutro. */
export function WhatsappAgentAvatar({
  agent,
  size = "sm",
  className,
}: {
  agent: WhatsappAgent | null | undefined;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={cn("bg-[#347796]/10", className)}>
      {agent?.avatar_url ? <AvatarImage src={agent.avatar_url} alt={agent.name} /> : null}
      <AvatarFallback className="bg-[#347796]/10 text-xs font-semibold text-[#285f7a]">
        {agent ? initials(agent.name) : <UserRound className="h-3.5 w-3.5" aria-hidden />}
      </AvatarFallback>
    </Avatar>
  );
}
