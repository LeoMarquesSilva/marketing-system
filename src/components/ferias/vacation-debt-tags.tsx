"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TableCell } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatISODateBR } from "@/lib/ferias/balance";
import {
  scheduledExceedsBalanceWarning,
  simulateScheduledShortfall,
} from "@/lib/ferias/schedule-balance";
import type { EmployeeBalance, VacationLeave } from "@/lib/ferias/types";
import { cn } from "@/lib/utils";

function daysLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function scheduledWhileInDebtWarning(
  balance: Pick<EmployeeBalance, "unallocatedDays" | "scheduledDays">
): string | null {
  if (balance.unallocatedDays <= 0 || balance.scheduledDays <= 0) return null;
  return `Já deve ${daysLabel(balance.unallocatedDays, "dia", "dias")} e ainda tem ${daysLabel(balance.scheduledDays, "dia programado", "dias programados")}. Quando o gozo começar, a dívida aumenta.`;
}

export function splitScheduledLeaves(leaves: VacationLeave[]): {
  programming: VacationLeave[];
  programmingDays: number;
  nextRecess: VacationLeave | null;
} {
  const programming = leaves.filter((leave) => leave.kind !== "recesso");
  const nextRecess = leaves.find((leave) => leave.kind === "recesso") ?? null;
  return {
    programming,
    programmingDays: programming.reduce((sum, leave) => sum + leave.days, 0),
    nextRecess,
  };
}

export function nextRecessDebtWarning(
  balance: Pick<EmployeeBalance, "unallocatedDays" | "pendingDays" | "scheduledLeaves">,
  recess: VacationLeave,
  admissionDate?: string,
  referenceDate?: string
): { warning: string; title: string; tone: "debt" | "shortfall" } | null {
  if (balance.unallocatedDays > 0) {
    return {
      warning: `Já deve ${daysLabel(balance.unallocatedDays, "dia", "dias")} e o próximo recesso é de ${daysLabel(recess.days, "dia", "dias")} a partir de ${formatISODateBR(recess.start_date)}. Quando o recesso começar, a dívida aumenta.`,
      title: "Atenção",
      tone: "debt",
    };
  }
  if (!admissionDate) return null;
  const shortfall = simulateScheduledShortfall({
    pendingDays: balance.pendingDays,
    admissionDate,
    leaves: balance.scheduledLeaves.length > 0 ? balance.scheduledLeaves : [recess],
    referenceDate,
  });
  if (shortfall <= 0) return null;
  return {
    warning: `Tem ${daysLabel(Math.max(0, balance.pendingDays), "dia", "dias")} de saldo e o recesso é de ${daysLabel(recess.days, "dia", "dias")} a partir de ${formatISODateBR(recess.start_date)}. Quando o gozo começar, ficará devendo ${daysLabel(shortfall, "dia", "dias")}.`,
    title: "Saldo insuficiente",
    tone: "shortfall",
  };
}

export function scheduledSituationMeta(
  balance: EmployeeBalance,
  admissionDate?: string,
  referenceDate?: string,
  leaves?: VacationLeave[]
): {
  warning: string | null;
  title: string | null;
  tone: "debt" | "shortfall" | null;
} {
  const targetLeaves = leaves ?? balance.scheduledLeaves;
  const scheduledDays = leaves
    ? leaves.reduce((sum, leave) => sum + leave.days, 0)
    : balance.scheduledDays;
  const debtWarning = scheduledWhileInDebtWarning({
    unallocatedDays: balance.unallocatedDays,
    scheduledDays,
  });
  if (debtWarning) {
    return { warning: debtWarning, title: "Atenção", tone: "debt" };
  }
  const shortfallWarning = scheduledExceedsBalanceWarning({
    pendingDays: balance.pendingDays,
    unallocatedDays: balance.unallocatedDays,
    scheduledDays,
    admissionDate,
    scheduledLeaves: targetLeaves,
    referenceDate,
  });
  if (shortfallWarning) {
    return { warning: shortfallWarning, title: "Saldo insuficiente", tone: "shortfall" };
  }
  return { warning: null, title: null, tone: null };
}

function SituationDaysCell({
  column,
  value,
  className,
  children,
}: {
  column: string;
  value: number;
  className: string;
  children?: ReactNode;
}) {
  return (
    <TableCell
      data-situation={column}
      className={cn(
        "text-center text-sm tabular-nums",
        value > 0 ? className : "text-muted-foreground"
      )}
    >
      {children ?? (value > 0 ? value : "—")}
    </TableCell>
  );
}

function WarningCellValue({
  value,
  warning,
  title,
  tone,
  detail,
}: {
  value: ReactNode;
  warning: string | null;
  title: string | null;
  tone: "debt" | "shortfall" | null;
  detail?: string | null;
}) {
  if (!warning && !detail) return <>{value}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex cursor-help items-center justify-center gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          {tone === "shortfall" ? (
            <CalendarClock className="size-3" aria-hidden />
          ) : tone === "debt" ? (
            <AlertTriangle className="size-3" aria-hidden />
          ) : null}
          {value}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        <p className="text-sm font-semibold leading-snug text-[#b7f0f1]">
          {title ?? "Detalhes"}
        </p>
        {detail ? (
          <p className="mt-1.5 text-xs leading-relaxed text-white/80">{detail}</p>
        ) : null}
        {warning ? (
          <p className="mt-1.5 text-xs leading-relaxed text-white/80">{warning}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

function warningToneClass(tone: "debt" | "shortfall" | null): string {
  if (tone === "debt") return "font-semibold text-amber-900";
  if (tone === "shortfall") return "font-semibold text-orange-950";
  return "font-semibold text-sky-700";
}

/** Colunas da lista: situação, programação de férias e próximo recesso. */
export function VacationSituationCells({
  balance,
  admissionDate,
  referenceDate,
}: {
  balance: EmployeeBalance;
  admissionDate?: string;
  referenceDate?: string;
}) {
  const { programming, programmingDays, nextRecess } = splitScheduledLeaves(
    balance.scheduledLeaves
  );
  const scheduled = scheduledSituationMeta(
    balance,
    admissionDate,
    referenceDate,
    programming
  );
  const recessMeta = nextRecess
    ? nextRecessDebtWarning(balance, nextRecess, admissionDate, referenceDate)
    : null;

  return (
    <TooltipProvider delayDuration={150}>
      <TableCell data-situation="em_ferias" className="text-center text-sm">
        {balance.onLeaveNow ? (
          <Badge
            variant="outline"
            className="border-[#47cdd0]/35 bg-[#47cdd0]/15 text-[#285f7a]"
          >
            Em férias
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <SituationDaysCell
        column="programados"
        value={programmingDays}
        className={warningToneClass(scheduled.tone)}
      >
        {programmingDays <= 0 ? (
          "-"
        ) : (
          <WarningCellValue
            value={programmingDays}
            warning={scheduled.warning}
            title={scheduled.title}
            tone={scheduled.tone}
          />
        )}
      </SituationDaysCell>
      <TableCell
        data-situation="proximo_recesso"
        className={cn(
          "text-center text-sm tabular-nums",
          nextRecess
            ? warningToneClass(recessMeta?.tone ?? null)
            : "text-muted-foreground"
        )}
      >
        {nextRecess ? (
          <WarningCellValue
            value={nextRecess.days}
            warning={recessMeta?.warning ?? null}
            title={recessMeta?.title ?? "Próximo recesso"}
            tone={recessMeta?.tone ?? null}
            detail={`${formatISODateBR(nextRecess.start_date)} a ${formatISODateBR(nextRecess.end_date)}`}
          />
        ) : (
          "-"
        )}
      </TableCell>
    </TooltipProvider>
  );
}

/**
 * Tags do saldo de férias sob a ótica do RH/CLT.
 *
 * "Deve" só aparece quando a pessoa gozou mais dias do que o direito adquirido
 * (`unallocatedDays`). Saldo pendente de fruição não é dívida do colaborador.
 */
export function VacationDebtTags({
  balance,
  admissionDate,
  referenceDate,
  className,
  compact = false,
}: {
  balance: EmployeeBalance;
  admissionDate?: string;
  referenceDate?: string;
  className?: string;
  compact?: boolean;
}) {
  const scheduled = scheduledSituationMeta(balance, admissionDate, referenceDate);
  const scheduledWarning = scheduled.warning;
  const scheduledTone = scheduled.tone;
  const tags: Array<{
    key: string;
    label: string;
    className: string;
    warning?: string | null;
    warningTitle?: string;
    warningTone?: "debt" | "shortfall";
  }> = [];

  if (balance.unallocatedDays > 0) {
    tags.push({
      key: "deve",
      label: `-${balance.unallocatedDays}`,
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
        ? `${balance.onTimeDays} ${balance.onTimeDays === 1 ? "positivo" : "positivos"}`
        : daysLabel(balance.onTimeDays, "dia positivo", "dias positivos"),
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
      label: daysLabel(balance.scheduledDays, "dia programado", "dias programados"),
      className: scheduledTone === "debt"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : scheduledTone === "shortfall"
          ? "border-orange-300 bg-orange-50 text-orange-950"
          : "border-sky-200 bg-sky-50 text-sky-700",
      warning: scheduledWarning,
      warningTitle: scheduledTone === "shortfall" ? "Saldo insuficiente" : "Atenção",
      warningTone: scheduledTone ?? undefined,
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
    <TooltipProvider delayDuration={150}>
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        {tags.map((tag) =>
          tag.warning ? (
            <Tooltip key={tag.key}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={cn("cursor-help", tag.className)}
                  onClick={(event) => event.stopPropagation()}
                >
                  {tag.warningTone === "shortfall" ? (
                    <CalendarClock className="size-3" aria-hidden />
                  ) : (
                    <AlertTriangle className="size-3" aria-hidden />
                  )}
                  {tag.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-64">
                <p className="text-sm font-semibold leading-snug text-[#b7f0f1]">
                  {tag.warningTitle ?? "Atenção"}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-white/80">{tag.warning}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Badge key={tag.key} variant="outline" className={tag.className}>
              {tag.label}
            </Badge>
          )
        )}
      </div>
    </TooltipProvider>
  );
}
