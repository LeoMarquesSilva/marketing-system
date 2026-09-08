import { CheckCircle2, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface IdentityBriefingStatusBadgeProps {
  status: "pending" | "submitted" | null;
  className?: string;
}

export function IdentityBriefingStatusBadge({
  status,
  className,
}: IdentityBriefingStatusBadgeProps) {
  const submitted = status === "submitted";
  const Icon = submitted ? CheckCircle2 : Clock3;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        submitted
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
          : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {submitted ? "Briefing respondido" : "Aguardando briefing"}
    </span>
  );
}
