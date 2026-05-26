import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FormerEmployeeBadgeProps {
  className?: string;
  size?: "sm" | "xs";
}

export function FormerEmployeeBadge({ className, size = "xs" }: FormerEmployeeBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full shrink-0 font-medium border-amber-300/80 bg-amber-50 text-amber-800",
        size === "xs" ? "text-[10px] px-1.5 py-0" : "text-xs",
        className
      )}
    >
      Ex-funcionário
    </Badge>
  );
}
