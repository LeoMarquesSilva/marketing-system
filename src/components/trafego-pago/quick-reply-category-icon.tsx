import {
  Building2,
  CircleHelp,
  Forward,
  Hand,
  Inbox,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuickReplyCategory } from "@/lib/whatsapp-quick-replies";

const CATEGORY_STYLE: Record<QuickReplyCategory, { icon: LucideIcon; tile: string }> = {
  primeiro_contato: { icon: Hand, tile: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  duvidas: { icon: CircleHelp, tile: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  qualificacao: { icon: ListChecks, tile: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  encaminhamento: { icon: Forward, tile: "bg-[#347796]/10 text-[#285f7a] dark:bg-[#47cdd0]/15 dark:text-[#47cdd0]" },
  terceiros: { icon: Building2, tile: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  outros: { icon: Inbox, tile: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300" },
};

export function QuickReplyCategoryIcon({
  category,
  className,
}: {
  category: QuickReplyCategory;
  className?: string;
}) {
  const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.outros;
  const Icon = style.icon;
  return (
    <span
      className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", style.tile, className)}
      aria-hidden
    >
      <Icon className="size-3.5" />
    </span>
  );
}
