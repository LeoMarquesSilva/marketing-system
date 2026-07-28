import { cn } from "@/lib/utils";
import type { ProfessionalProfileStatus } from "@/lib/profiles/types";

/** Rótulo e cor de cada situação de publicação. */
export const PROFILE_STATUS_META: Record<
  ProfessionalProfileStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Rascunho",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  published: {
    label: "Publicado",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  archived: {
    label: "Arquivado",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  },
};

export function ProfileStatusBadge({
  status,
  className,
}: {
  status: ProfessionalProfileStatus;
  className?: string;
}) {
  const meta = PROFILE_STATUS_META[status] ?? PROFILE_STATUS_META.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        meta.className,
        className
      )}
    >
      {meta.label}
    </span>
  );
}

/** Barra de completude do perfil, com rótulo acessível. */
export function ProfileCompletenessBar({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  const tone =
    safe >= 100 ? "bg-emerald-500" : safe >= 60 ? "bg-[#47cdd0]" : "bg-amber-400";
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Perfil ${safe}% completo`}
      >
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${safe}%` }} />
      </div>
      <span className="tabular-nums text-xs text-muted-foreground">{safe}%</span>
    </div>
  );
}
