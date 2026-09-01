import { cn } from "@/lib/utils";
import { scoreBandLabel } from "@/lib/gustavo-content/score";

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  const value = score ?? 0;
  const tone =
    value >= 90
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : value >= 80
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : value >= 70
          ? "border-[#47cdd0]/40 bg-[#e8f8f8] text-[#285f7a]"
          : value >= 55
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-black/10 bg-black/[0.04] text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
        tone
      )}
    >
      <span className="tabular-nums">{score ?? "—"}</span>
      <span className="editorial-kicker text-[9px] uppercase opacity-75">{scoreBandLabel(score)}</span>
    </span>
  );
}
