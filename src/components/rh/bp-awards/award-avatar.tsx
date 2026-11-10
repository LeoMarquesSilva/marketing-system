"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/ferias/filters";
import { awardPhotoUrl } from "@/lib/rh/bp-awards/format";
import type { AwardPerson } from "@/lib/rh/bp-awards/types";
import { cn } from "@/lib/utils";

/** Classe do tamanho + pixels pedidos ao Supabase (2x para telas retina). */
const SIZES = {
  sm: { className: "size-8 text-xs", pixels: 96 },
  md: { className: "size-11 text-sm", pixels: 128 },
  lg: { className: "size-16 text-lg", pixels: 160 },
  xl: { className: "size-24 text-2xl", pixels: 256 },
} as const;

/**
 * Foto do colaborador. `tone="night"` para as telas da festa (azul-marinho e
 * dourado); `tone="system"` segue o ORQESTRAI.
 */
export function AwardAvatar({
  person,
  size = "md",
  tone = "night",
  className,
}: {
  person: Pick<AwardPerson, "short_name" | "avatar_url"> | null;
  size?: keyof typeof SIZES;
  tone?: "night" | "system";
  className?: string;
}) {
  const name = person?.short_name ?? "?";
  const src = awardPhotoUrl(person?.avatar_url ?? null, SIZES[size].pixels);
  return (
    <Avatar
      className={cn(
        "shrink-0",
        tone === "night" ? "ring-1 ring-[var(--aw-line)]" : "ring-1 ring-black/5",
        SIZES[size].className,
        className
      )}
    >
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback
        className={cn(
          "font-semibold",
          tone === "night" ? "bg-[var(--aw-raised)] text-[var(--aw-gold)]" : "bg-[#e8f1f5] text-[#315f73]"
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
