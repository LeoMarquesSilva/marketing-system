import { Badge } from "@/components/ui/badge";
import type { EmployeeBalance } from "@/lib/ferias/types";
import { cn } from "@/lib/utils";

function daysLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Tags do saldo de férias sob a ótica do RH/CLT.
 *
 * "Deve" só aparece quando a pessoa gozou mais dias do que o direito adquirido
 * (`unallocatedDays`). Saldo pendente de fruição não é dívida do colaborador.
 */
export function VacationDebtTags({
  balance,
  className,
  compact = false,
}: {
  balance: EmployeeBalance;
  className?: string;
  compact?: boolean;
}) {
  const tags: Array<{ key: string; label: string; className: string }> = [];

  if (balance.unallocatedDays > 0) {
    tags.push({
      key: "deve",
      label: compact
        ? `Deve ${balance.unallocatedDays}`
        : daysLabel(balance.unallocatedDays, "dia a mais", "dias a mais"),
      className: "border-red-300 bg-red-50 text-red-800",
    });
  }

  if (balance.overdueDays > 0) {
    tags.push({
      key: "vencidas",
      label: compact
        ? `${balance.overdueDays} vencidas`
        : daysLabel(balance.overdueDays, "dia vencido", "dias vencidos"),
      className: "border-red-200 bg-red-50 text-red-700",
    });
  }

  if (balance.dueTodayDays > 0) {
    tags.push({
      key: "hoje",
      label: compact
        ? `${balance.dueTodayDays} vencem hoje`
        : daysLabel(balance.dueTodayDays, "dia vence hoje", "dias vencem hoje"),
      className: "border-orange-200 bg-orange-50 text-orange-700",
    });
  }

  if (balance.dueSoonDays > 0) {
    tags.push({
      key: "a_vencer",
      label: compact
        ? `${balance.dueSoonDays} a vencer`
        : daysLabel(balance.dueSoonDays, "dia a vencer", "dias a vencer"),
      className: "border-amber-200 bg-amber-50 text-amber-700",
    });
  }

  if (balance.onTimeDays > 0) {
    tags.push({
      key: "em_dia",
      label: compact
        ? `${balance.onTimeDays} em dia`
        : daysLabel(balance.onTimeDays, "dia em dia", "dias em dia"),
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    });
  }

  if (balance.onLeaveNow) {
    tags.push({
      key: "em_ferias",
      label: "Em férias",
      className: "border-[#47cdd0]/35 bg-[#47cdd0]/15 text-[#285f7a]",
    });
  }

  if (balance.scheduledDays > 0) {
    tags.push({
      key: "programado",
      label: compact
        ? `${balance.scheduledDays} programados`
        : daysLabel(balance.scheduledDays, "dia programado", "dias programados"),
      className: "border-sky-200 bg-sky-50 text-sky-700",
    });
  }

  if (tags.length === 0) {
    tags.push({
      key: "quitado",
      label: "Sem saldo",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {tags.map((tag) => (
        <Badge key={tag.key} variant="outline" className={tag.className}>
          {tag.label}
        </Badge>
      ))}
    </div>
  );
}
