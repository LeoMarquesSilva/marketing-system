import { formatISODateBR, LEAVE_KIND_LABEL } from "@/lib/ferias/balance";
import {
  isVacationCreditKind,
  type EmployeeDetail,
  type PeriodBalance,
  type VacationLeave,
} from "@/lib/ferias/types";

export type VacationMessageChannel = "whatsapp" | "email";

export type VacationMessageScope =
  | { type: "all" }
  | { type: "year"; year: number };

export interface VacationBalanceMessage {
  subject?: string;
  body: string;
}

function firstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || fullName.trim() || "colaborador";
}

function daysLabel(n: number): string {
  const abs = Math.abs(n);
  return `${n} ${abs === 1 ? "dia" : "dias"}`;
}

function yearBounds(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function overlapsRange(start: string, end: string, rangeStart: string, rangeEnd: string): boolean {
  return start <= rangeEnd && end >= rangeStart;
}

function leaveDateLabel(leave: VacationLeave): string {
  if (leave.start_date === leave.end_date) {
    return formatISODateBR(leave.start_date);
  }
  return `${formatISODateBR(leave.start_date)} a ${formatISODateBR(leave.end_date)}`;
}

/** Anos disponíveis a partir de períodos e lançamentos. */
export function listVacationMessageYears(detail: EmployeeDetail): number[] {
  const years = new Set<number>();
  for (const leave of detail.leaves) {
    years.add(Number(leave.start_date.slice(0, 4)));
    years.add(Number(leave.end_date.slice(0, 4)));
  }
  for (const item of detail.balance.periods) {
    years.add(Number(item.period.period_start.slice(0, 4)));
    years.add(Number(item.period.period_end.slice(0, 4)));
    years.add(Number(item.period.concessive_end.slice(0, 4)));
  }
  if (years.size === 0) {
    years.add(new Date().getFullYear());
  }
  return [...years].sort((a, b) => b - a);
}

function filterLeaves(
  leaves: VacationLeave[],
  scope: VacationMessageScope
): VacationLeave[] {
  if (scope.type === "all") {
    return [...leaves].sort((a, b) => a.start_date.localeCompare(b.start_date));
  }
  const { start, end } = yearBounds(scope.year);
  return leaves
    .filter((leave) => overlapsRange(leave.start_date, leave.end_date, start, end))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}

function filterPeriods(
  periods: PeriodBalance[],
  scope: VacationMessageScope
): PeriodBalance[] {
  if (scope.type === "all") return periods;
  const { start, end } = yearBounds(scope.year);
  return periods.filter((item) =>
    overlapsRange(item.period.period_start, item.period.period_end, start, end)
  );
}

function sumLeaveDays(leaves: VacationLeave[]): {
  debit: number;
  credit: number;
  byKind: Array<{ kind: VacationLeave["kind"]; days: number }>;
} {
  const byKindMap = new Map<VacationLeave["kind"], number>();
  let debit = 0;
  let credit = 0;

  for (const leave of leaves) {
    byKindMap.set(leave.kind, (byKindMap.get(leave.kind) ?? 0) + leave.days);
    if (isVacationCreditKind(leave.kind)) {
      credit += leave.days;
    } else {
      debit += leave.days;
    }
  }

  const order: VacationLeave["kind"][] = [
    "ferias",
    "recesso",
    "abono",
    "trabalho_recesso",
    "trabalho_ferias",
  ];

  return {
    debit,
    credit,
    byKind: order
      .filter((kind) => (byKindMap.get(kind) ?? 0) > 0)
      .map((kind) => ({ kind, days: byKindMap.get(kind)! })),
  };
}

function scopeHeadline(scope: VacationMessageScope): string {
  if (scope.type === "all") return "histórico completo";
  return `ano de ${scope.year}`;
}

function formatLeavesBlock(
  leaves: VacationLeave[],
  style: "whatsapp" | "email"
): string {
  if (leaves.length === 0) {
    return style === "whatsapp"
      ? "Lançamentos\n• Nenhum lançamento neste recorte."
      : "Lançamentos\n- Nenhum lançamento neste recorte.";
  }

  const lines = leaves.map((leave) => {
    const kind = LEAVE_KIND_LABEL[leave.kind];
    const dates = leaveDateLabel(leave);
    const sign = isVacationCreditKind(leave.kind) ? "+" : "";
    if (style === "whatsapp") {
      return `• ${kind}: ${dates} (${sign}${daysLabel(leave.days)})`;
    }
    return `- ${kind}: ${dates} (${sign}${daysLabel(leave.days)})`;
  });

  return ["Lançamentos", ...lines].join("\n");
}

function formatPeriodsBlock(
  periods: PeriodBalance[],
  style: "whatsapp" | "email"
): string {
  if (periods.length === 0) {
    return style === "whatsapp"
      ? "Períodos aquisitivos\n• Nenhum período neste recorte."
      : "Períodos aquisitivos\n- Nenhum período neste recorte.";
  }

  const lines = periods.map((item) => {
    const range = `${formatISODateBR(item.period.period_start)} a ${formatISODateBR(item.period.period_end)}`;
    const prazo = formatISODateBR(item.period.concessive_end);
    if (style === "whatsapp") {
      return `• ${range} — direito ${item.period.entitled_days}, usados ${item.usedDays}, restante ${item.remainingDays} (prazo até ${prazo})`;
    }
    return `- ${range}: direito ${item.period.entitled_days} · usados ${item.usedDays} · restante ${item.remainingDays} · prazo concessivo até ${prazo}`;
  });

  return ["Períodos aquisitivos", ...lines].join("\n");
}

function formatSummaryBlock(
  detail: EmployeeDetail,
  scope: VacationMessageScope,
  filteredLeaves: VacationLeave[],
  filteredPeriods: PeriodBalance[],
  style: "whatsapp" | "email"
): string {
  const leaveStats = sumLeaveDays(filteredLeaves);

  if (scope.type === "all") {
    const { totalEntitledDays, totalTakenDays, pendingDays, scheduledDays } = detail.balance;
    if (style === "whatsapp") {
      return [
        "Resumo",
        `• Adquiridos: ${daysLabel(totalEntitledDays)}`,
        `• Gozados: ${daysLabel(totalTakenDays)}`,
        `• Saldo: ${daysLabel(pendingDays)}`,
        ...(scheduledDays > 0 ? [`• Já programados (não descontam o saldo ainda): ${daysLabel(scheduledDays)}`] : []),
        ...leaveStats.byKind.map(
          ({ kind, days }) =>
            `• ${LEAVE_KIND_LABEL[kind]}: ${isVacationCreditKind(kind) ? "+" : ""}${daysLabel(days)}`
        ),
      ].join("\n");
    }
    return [
      "Resumo",
      `Adquiridos: ${daysLabel(totalEntitledDays)}`,
      `Gozados: ${daysLabel(totalTakenDays)}`,
      `Saldo: ${daysLabel(pendingDays)}`,
      ...(scheduledDays > 0 ? [`Já programados (não descontam o saldo ainda): ${daysLabel(scheduledDays)}`] : []),
      ...leaveStats.byKind.map(
        ({ kind, days }) =>
          `${LEAVE_KIND_LABEL[kind]}: ${isVacationCreditKind(kind) ? "+" : ""}${daysLabel(days)}`
      ),
    ].join("\n");
  }

  const entitled = filteredPeriods.reduce((sum, p) => sum + p.period.entitled_days, 0);
  const remaining = filteredPeriods.reduce((sum, p) => sum + p.remainingDays, 0);

  if (style === "whatsapp") {
    return [
      `Resumo (${scope.year})`,
      `• Direito nos períodos do ano: ${daysLabel(entitled)}`,
      `• Dias lançados no ano: ${daysLabel(leaveStats.debit)}`,
      `• Créditos no ano: ${daysLabel(leaveStats.credit)}`,
      `• Saldo restante nesses períodos: ${daysLabel(remaining)}`,
      ...leaveStats.byKind.map(
        ({ kind, days }) =>
          `• ${LEAVE_KIND_LABEL[kind]}: ${isVacationCreditKind(kind) ? "+" : ""}${daysLabel(days)}`
      ),
    ].join("\n");
  }

  return [
    `Resumo (${scope.year})`,
    `Direito nos períodos do ano: ${daysLabel(entitled)}`,
    `Dias lançados no ano: ${daysLabel(leaveStats.debit)}`,
    `Créditos no ano: ${daysLabel(leaveStats.credit)}`,
    `Saldo restante nesses períodos: ${daysLabel(remaining)}`,
    ...leaveStats.byKind.map(
      ({ kind, days }) =>
        `${LEAVE_KIND_LABEL[kind]}: ${isVacationCreditKind(kind) ? "+" : ""}${daysLabel(days)}`
    ),
  ].join("\n");
}

function buildExemptBody(channel: VacationMessageChannel, name: string): string {
  if (channel === "whatsapp") {
    return [
      `Oi, ${name}!`,
      "",
      "Você está cadastrado fora do controle de férias (isenção).",
      "Se precisar de algum esclarecimento, fale com o RH.",
    ].join("\n");
  }

  return [
    `Olá, ${name},`,
    "",
    "Você está cadastrado fora do controle de férias (isenção).",
    "Em caso de dúvidas, entre em contato com o RH.",
    "",
    "Atenciosamente,",
  ].join("\n");
}

function buildBalanceBody(
  channel: VacationMessageChannel,
  detail: EmployeeDetail,
  scope: VacationMessageScope
): string {
  const name = firstName(detail.employee.full_name);
  const leaves = filterLeaves(detail.leaves, scope);
  const periods = filterPeriods(detail.balance.periods, scope);
  const headline = scopeHeadline(scope);
  const style = channel === "whatsapp" ? "whatsapp" : "email";

  if (channel === "whatsapp") {
    return [
      `Oi, ${name}!`,
      "",
      `Segue o resumo do seu saldo de férias (${headline}):`,
      "",
      formatSummaryBlock(detail, scope, leaves, periods, style),
      "",
      formatLeavesBlock(leaves, style),
      "",
      formatPeriodsBlock(periods, style),
    ].join("\n");
  }

  return [
    `Olá, ${name},`,
    "",
    `Segue o resumo do seu saldo de férias (${headline}):`,
    "",
    formatSummaryBlock(detail, scope, leaves, periods, style),
    "",
    formatLeavesBlock(leaves, style),
    "",
    formatPeriodsBlock(periods, style),
    "",
    "Atenciosamente,",
  ].join("\n");
}

/** Monta mensagem modelo de saldo para WhatsApp ou e-mail. */
export function buildVacationBalanceMessage(
  detail: EmployeeDetail,
  channel: VacationMessageChannel,
  scope: VacationMessageScope = { type: "all" }
): VacationBalanceMessage {
  const fullName = detail.employee.full_name.trim() || "Colaborador";
  const name = firstName(fullName);
  const subjectSuffix =
    scope.type === "year" ? ` (${scope.year})` : "";

  if (detail.employee.vacation_exempt) {
    return {
      subject:
        channel === "email" ? `Saldo de férias — ${fullName}${subjectSuffix}` : undefined,
      body: buildExemptBody(channel, name),
    };
  }

  return {
    subject:
      channel === "email" ? `Saldo de férias — ${fullName}${subjectSuffix}` : undefined,
    body: buildBalanceBody(channel, detail, scope),
  };
}
