"use client";

import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface WhatsappLeadAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function WhatsappLeadAvatar({
  name,
  avatarUrl,
  size = "default",
  className,
}: WhatsappLeadAvatarProps) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <Avatar size={size} className={cn("bg-[#101f2e]/8", className)}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={name ?? "Lead"} referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback className="bg-[#101f2e]/8 text-[#101f2e]/70 font-medium">
        {avatarUrl ? initial : <User className="h-5 w-5 text-[#101f2e]/60" />}
      </AvatarFallback>
    </Avatar>
  );
}
