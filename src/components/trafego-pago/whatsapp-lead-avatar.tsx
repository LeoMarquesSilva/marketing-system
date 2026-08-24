"use client";

import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface WhatsappLeadAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  conversationId?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}

/** pps.whatsapp.net devolve link assinado que expira — carregar direto no
 * browser dá 403 depois de um tempo. Passamos pelo proxy do servidor, que
 * busca uma URL fresca a cada request. */
function isWhatsappCdnUrl(url: string): boolean {
  return /\.whatsapp\.net\//i.test(url);
}

function resolveAvatarSrc(avatarUrl: string, conversationId?: string | null): string {
  if (isWhatsappCdnUrl(avatarUrl) && conversationId) {
    return `/api/evolution/avatar?conversationId=${encodeURIComponent(conversationId)}`;
  }
  return avatarUrl;
}

export function WhatsappLeadAvatar({
  name,
  avatarUrl,
  conversationId,
  size = "default",
  className,
}: WhatsappLeadAvatarProps) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  const resolvedSrc = avatarUrl ? resolveAvatarSrc(avatarUrl, conversationId) : null;

  return (
    <Avatar size={size} className={cn("bg-[#04202f]/8", className)}>
      {resolvedSrc ? (
        <AvatarImage src={resolvedSrc} alt={name ?? "Lead"} referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback className="bg-[#04202f]/8 text-[#04202f]/70 font-medium">
        {avatarUrl ? initial : <User className="h-5 w-5 text-[#04202f]/60" />}
      </AvatarFallback>
    </Avatar>
  );
}
