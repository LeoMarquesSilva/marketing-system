"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CollaboratorPhoto, PhotoUsageType } from "@/lib/collaborator-photos/types";

interface PhotoUsageSelectorProps {
  photo: CollaboratorPhoto;
  usageTypes: PhotoUsageType[];
  busy?: boolean;
  mode?: "card" | "panel";
  firstCard?: boolean;
  onToggle: (photo: CollaboratorPhoto, usage: PhotoUsageType) => void | Promise<void>;
}

export function PhotoUsageSelector({
  photo,
  usageTypes,
  busy = false,
  mode = "card",
  firstCard = false,
  onToggle,
}: PhotoUsageSelectorProps) {
  if (usageTypes.length === 0) return null;

  return (
    <div
      className={cn(mode === "card" ? "grid grid-cols-2 gap-1.5" : "space-y-2")}
      data-tour={firstCard ? "mf-usage-options" : undefined}
      aria-label="Usos desta foto"
    >
      {usageTypes.map((usage) => {
        const active = photo.usageSlugs.includes(usage.slug);
        return (
          <button
            key={usage.id}
            type="button"
            disabled={busy}
            aria-pressed={active}
            onClick={() => {
              void Promise.resolve(onToggle(photo, usage)).catch(() => undefined);
            }}
            data-tour={firstCard && usage.slug === "oficial" ? "mf-official-usage" : undefined}
            className={cn(
              "group flex items-center border text-left text-xs font-medium outline-none transition-[border-color,background-color,color,transform] duration-200 active:translate-y-px focus-visible:ring-2 focus-visible:ring-[#47cdd0]/35 disabled:cursor-wait disabled:opacity-60",
              mode === "card"
                ? "min-h-8 justify-center gap-1 rounded-md px-1.5 py-1"
                : "min-h-11 w-full gap-3 rounded-lg px-3 py-2.5",
              active
                ? usage.isOfficial
                  ? "border-[#347796] bg-[#e8f8f8] text-[#153f51]"
                  : "border-[#8bbcc7] bg-[#f0f9f9] text-[#153f51]"
                : "border-[#dce9eb] bg-white text-[#456370] hover:border-[#8bbcc7] hover:bg-[#f7fbfb] hover:text-[#153f51]"
            )}
          >
            <span
              className={cn(
                "grid shrink-0 place-items-center border transition-colors",
                mode === "card" ? "h-3.5 w-3.5 rounded-[3px]" : "h-5 w-5 rounded-md",
                active
                  ? "border-[#347796] bg-[#347796] text-white"
                  : "border-[#b8cdd2] bg-white text-transparent group-hover:border-[#6da5b2]"
              )}
              aria-hidden="true"
            >
              <Check className={mode === "card" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} strokeWidth={3} />
            </span>
            <span className={cn("min-w-0", mode === "card" && "truncate")}>{usage.label}</span>
          </button>
        );
      })}
    </div>
  );
}
