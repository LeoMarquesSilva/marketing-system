/**
 * Visão de uma área em texto (WhatsApp, com *negrito*) e em tabela HTML (Teams,
 * Outlook, Excel), para o RH colar e mandar ao gestor da área.
 */

import { previousMonth, type AreaReport } from "./metrics";
import { AREA_BAND_LABEL, MONTH_LABELS, categoryLabel } from "./types";

/** "2026-10-02" → "02/10". */
export function dayMonth(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function reportTitle(report: AreaReport): string {
  return `Feedbacks de boas práticas — ${report.area} — ${MONTH_LABELS[report.month.month - 1].toLowerCase()} de ${report.month.year}`;
}

/** Linha de resumo: total, mês anterior, pessoas, faixa e retorno. */
export function reportSummaryLine(report: AreaReport): string {
  const previousName = MONTH_LABELS[previousMonth(report.month).month - 1].toLowerCase();
  const people = report.people.filter((row) => !row.isTeam).length;
  const team = report.people.some((row) => row.isTeam);
  return [
    `${plural(report.total, "feedback", "feedbacks")} no mês (${report.previousTotal} em ${previousName})`,
    `${plural(people, "pessoa", "pessoas")}${team ? " e a equipe inteira" : ""}`,
    `${report.yearToDate} no ano até ${MONTH_LABELS[report.month.month - 1].toLowerCase()}`,
    report.band ? `faixa: ${AREA_BAND_LABEL[report.band]}` : null,
    report.total ? `retorno do gestor: ${report.responded} de ${report.total}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

type NameOf = (row: { name: string; employeeId: string | null }) => string;

const categoriesText = (row: AreaReport["people"][number]) =>
  row.categories.map((entry) => (entry.sent > 1 ? `${entry.category} (${entry.sent})` : entry.category)).join("; ");

export function areaReportText(report: AreaReport, nameOf: NameOf, includeItems: boolean): string {
  const lines = [`*${reportTitle(report)}*`, reportSummaryLine(report)];
  if (!report.total) {
    lines.push("", "Nenhum feedback no mês.");
    return lines.join("\n");
  }
  lines.push("", "*Quem recebeu*");
  for (const row of report.people) {
    const year = row.isTeam ? "" : ` (${row.yearToDate} no ano)`;
    lines.push(`• ${nameOf(row)} — ${row.sent} no mês${year} — ${categoriesText(row)} — ${row.dates.map(dayMonth).join(", ")}`);
  }
  if (includeItems) {
    lines.push("", "*Ocorrências*");
    for (const item of report.items) {
      const who = nameOf({ name: item.employee_name, employeeId: item.is_team ? null : item.employee_id });
      lines.push(`${dayMonth(item.sent_on)} — ${who} — ${categoryLabel(item)} — ${item.description.replace(/\s+/g, " ").trim()}`);
    }
  }
  return lines.join("\n");
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CELL = "border:1px solid #dce9eb;padding:6px 10px;text-align:left;vertical-align:top;";
const HEAD = `${CELL}background:#eef6f8;color:#10293a;font-weight:600;`;

export function areaReportHtml(report: AreaReport, nameOf: NameOf, includeItems: boolean): string {
  const parts = [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#10293a;">`,
    `<p style="margin:0 0 4px;font-size:15px;"><b>${escapeHtml(reportTitle(report))}</b></p>`,
    `<p style="margin:0 0 12px;color:#4b5f6b;">${escapeHtml(reportSummaryLine(report))}</p>`,
  ];
  if (!report.total) {
    parts.push(`<p style="margin:0;">Nenhum feedback no mês.</p></div>`);
    return parts.join("");
  }
  parts.push(
    `<table style="border-collapse:collapse;margin-bottom:14px;">`,
    `<tr><th style="${HEAD}">Pessoa</th><th style="${HEAD}">No mês</th><th style="${HEAD}">Temas</th><th style="${HEAD}">Datas</th><th style="${HEAD}">No ano</th><th style="${HEAD}">Retorno do gestor</th></tr>`,
    ...report.people.map(
      (row) =>
        `<tr><td style="${CELL}">${escapeHtml(nameOf(row))}</td><td style="${CELL}text-align:center;"><b>${row.sent}</b></td>` +
        `<td style="${CELL}">${escapeHtml(categoriesText(row))}</td><td style="${CELL}">${row.dates.map(dayMonth).join(", ")}</td>` +
        `<td style="${CELL}text-align:center;">${row.isTeam ? "—" : row.yearToDate}</td><td style="${CELL}">${row.responded} de ${row.sent}</td></tr>`
    ),
    `</table>`
  );
  if (includeItems) {
    parts.push(
      `<table style="border-collapse:collapse;">`,
      `<tr><th style="${HEAD}">Data</th><th style="${HEAD}">Pessoa</th><th style="${HEAD}">Tema</th><th style="${HEAD}">Ocorrência</th></tr>`,
      ...report.items.map((item) => {
        const who = nameOf({ name: item.employee_name, employeeId: item.is_team ? null : item.employee_id });
        return (
          `<tr><td style="${CELL}">${dayMonth(item.sent_on)}</td><td style="${CELL}">${escapeHtml(who)}</td>` +
          `<td style="${CELL}">${escapeHtml(categoryLabel(item))}</td><td style="${CELL}">${escapeHtml(item.description)}</td></tr>`
        );
      }),
      `</table>`
    );
  }
  parts.push(`</div>`);
  return parts.join("");
}
