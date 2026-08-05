import { Badge } from "@/components/ui/badge";
import { PERIOD_STATUS_LABEL } from "@/lib/ferias/balance";
import type { VacationPeriodStatus } from "@/lib/ferias/types";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<VacationPeriodStatus, string> = {
  quitado: "border-emerald-200 bg-emerald-50 text-emerald-700",
  em_dia: "border-[#47cdd0]/35 bg-[#47cdd0]/15 text-[#285f7a]",
  a_vencer: "border-amber-200 bg-amber-50 text-amber-700",
  vencido: "border-red-200 bg-red-50 text-red-700",
};

export function VacationStatusBadge({
  status,
  className,
}: {
  status: VacationPeriodStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASS[status], className)}>
      {PERIOD_STATUS_LABEL[status]}
    </Badge>
  );
}
