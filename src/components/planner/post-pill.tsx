"use client";

import { cn } from "@/lib/utils";

const PILL_STYLES = {
  disponivel:
    "bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/50",
  postado:
    "bg-blue-100/90 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/50",
} as const;

interface PostPillProps {
  label: "Disponível" | "Postado";
  timeLabel?: string;
  onClick?: () => void;
  className?: string;
}

export function PostPill({ label, timeLabel, onClick, className }: PostPillProps) {
  const isPostado = label === "Postado";
  const style = isPostado ? PILL_STYLES.postado : PILL_STYLES.disponivel;
  const pillContent = (
    <>
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          isPostado ? "bg-blue-500" : "bg-emerald-500"
        )}
        aria-hidden
      />
      <span>{label}</span>
      {timeLabel && (
        <span className="text-[10px] opacity-80 truncate max-w-[4rem]">{timeLabel}</span>
      )}
    </>
  );
  const pillClassName = cn(
    "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium",
    style,
    onClick && "transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
    className
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={pillClassName}>
        {pillContent}
      </button>
    );
  }
  return <span className={pillClassName}>{pillContent}</span>;
}
