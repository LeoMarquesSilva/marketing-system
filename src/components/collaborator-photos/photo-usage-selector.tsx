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

  const officialUsage = usageTypes.find((usage) => usage.isOfficial);
  const regularUsages = usageTypes.filter((usage) => !usage.isOfficial);

  if (mode === "card") {
    return (
      <div
        className="space-y-1.5"
        data-tour={firstCard ? "mf-usage-options" : undefined}
        aria-label="Usos desta foto"
      >
        {officialUsage && (() => {
          const active = photo.usageSlugs.includes(officialUsage.slug);
          return (
            <button
              type="button"
              disabled={busy}
              aria-pressed={active}
              onClick={() => {
                void Promise.resolve(onToggle(photo, officialUsage)).catch(() => undefined);
              }}
              data-tour={firstCard ? "mf-official-usage" : undefined}
              className={cn(
                "flex min-h-9 w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs font-semibold outline-none transition-[border-color,background-color,color,transform] duration-200 active:translate-y-px focus-visible:ring-2 focus-visible:ring-[#47cdd0]/40 disabled:cursor-wait disabled:opacity-60",
                active
                  ? "border-[#285f7a] bg-[#347796] text-white shadow-[0_2px_7px_rgba(52,119,150,0.2)]"
                  : "border-[#9fc8ce] bg-[#eef9f9] text-[#153f51] hover:border-[#5aa5b1] hover:bg-[#e3f5f5]"
              )}
            >
              <span>Foto dos sistemas</span>
              <span
                className={cn(
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
                  active
                    ? "border-white/45 bg-white text-[#347796]"
                    : "border-[#76aeb8] bg-white text-transparent"
                )}
                aria-hidden="true"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            </button>
          );
        })()}

        {regularUsages.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {regularUsages.map((usage) => {
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
                  className={cn(
                    "group flex min-h-8 items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-xs font-medium outline-none transition-[border-color,background-color,color,transform] duration-200 active:translate-y-px focus-visible:ring-2 focus-visible:ring-[#47cdd0]/35 disabled:cursor-wait disabled:opacity-60",
                    active
                      ? "border-[#8bbcc7] bg-[#f0f9f9] text-[#153f51]"
                      : "border-[#dce9eb] bg-white text-[#456370] hover:border-[#8bbcc7] hover:bg-[#f7fbfb]"
                  )}
                >
                  <span
                    className={cn(
                      "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border transition-colors",
                      active
                        ? "border-[#347796] bg-[#347796] text-white"
                        : "border-[#b8cdd2] bg-white text-transparent group-hover:border-[#6da5b2]"
                    )}
                    aria-hidden="true"
                  >
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                  <span className="min-w-0 truncate">{usage.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="space-y-2"
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
              "min-h-11 w-full gap-3 rounded-lg px-3 py-2.5",
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
                "h-5 w-5 rounded-md",
                active
                  ? "border-[#347796] bg-[#347796] text-white"
                  : "border-[#b8cdd2] bg-white text-transparent group-hover:border-[#6da5b2]"
              )}
              aria-hidden="true"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className="min-w-0">{usage.label}</span>
          </button>
        );
      })}
    </div>
  );
}
