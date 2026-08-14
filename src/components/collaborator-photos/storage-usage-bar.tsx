"use client";

import { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import { fetchStorageUsage } from "@/lib/collaborator-photos/api";
import {
  formatStorageBytes,
  storageBarTone,
  type StorageUsageSummary,
} from "@/lib/collaborator-photos/storage-usage";
import { cn } from "@/lib/utils";

const BAR_CLASS: Record<ReturnType<typeof storageBarTone>, string> = {
  ok: "bg-[#1a6b72]",
  warn: "bg-amber-500",
  danger: "bg-red-500",
};

export function StorageUsageBar() {
  const [usage, setUsage] = useState<StorageUsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchStorageUsage();
        if (!cancelled) setUsage(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível medir o storage.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="text-xs text-muted-foreground">
        Storage: {error}
      </p>
    );
  }

  if (!usage) {
    return (
      <div className="h-16 animate-pulse rounded-2xl border border-[#dce9eb] bg-white" />
    );
  }

  const tone = storageBarTone(usage.percent);
  const width = usage.percent === 0 && usage.usedBytes > 0 ? 1 : usage.percent;

  return (
    <section className="rounded-2xl border border-[#dce9eb] bg-white p-4 shadow-[0_1px_2px_rgba(3,32,47,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#04202f] text-[#47cdd0]">
            <HardDrive className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[#04202f]">Storage do projeto</h3>
            <p className="text-xs text-muted-foreground">
              Plano Pro inclui {formatStorageBytes(usage.quotaBytes)}. A cota é compartilhada com
              eventos, projetos e fotos.
            </p>
          </div>
        </div>
        <p className="text-sm font-semibold tabular-nums text-[#04202f]">
          {formatStorageBytes(usage.usedBytes)}
          <span className="font-normal text-muted-foreground">
            {" "}
            de {formatStorageBytes(usage.quotaBytes)}
          </span>
        </p>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#e8f2f3]">
        <div
          className={cn("h-full rounded-full transition-all duration-500", BAR_CLASS[tone])}
          style={{ width: `${width}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#04202f]/70">
        <p>
          {formatStorageBytes(usage.photosBytes)} nas fotos dos colaboradores
          {usage.photosFiles > 0 ? ` · ${usage.photosFiles} arquivos` : ""}
        </p>
        <p className="tabular-nums">
          {formatStorageBytes(usage.availableBytes)} livres · {usage.percent}% usado
        </p>
      </div>
    </section>
  );
}
