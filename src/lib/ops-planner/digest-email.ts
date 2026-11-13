/** E-mail diário do Planner de Operações Legais (HTML simples, estilos inline). */

import { formatShortDate, type Digest, type DigestItem } from "./alerts";
import { OPS_PLANNER_PATH } from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function taskUrl(baseUrl: string, item: DigestItem): string {
  return `${baseUrl}${OPS_PLANNER_PATH}?tarefa=${encodeURIComponent(item.task_id)}`;
}

function itemsTable(baseUrl: string, items: DigestItem[], showAssignees: boolean): string {
  const rows = items
    .slice(0, 15)
    .map(
      (item) => `<tr>
  <td style="padding:8px 0;border-bottom:1px solid #e6eef0;">
    <a href="${taskUrl(baseUrl, item)}" style="color:#285f7a;font-weight:600;text-decoration:none;">${escapeHtml(item.title)}</a>
    <div style="color:#5b6b73;font-size:12px;margin-top:2px;">${escapeHtml(item.space)}${showAssignees ? ` · ${escapeHtml(item.assignees)}` : ""}</div>
  </td>
  <td style="padding:8px 0 8px 12px;border-bottom:1px solid #e6eef0;color:#5b6b73;font-size:13px;white-space:nowrap;text-align:right;">${item.due_date ? formatShortDate(item.due_date) : ""}</td>
</tr>`
    )
    .join("");
  const more = items.length > 15 ? `<p style="color:#5b6b73;font-size:12px;margin:6px 0 0;">E mais ${items.length - 15}.</p>` : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">${rows}</table>${more}`;
}

function section(title: string, tone: string, body: string): string {
  return `<h2 style="font-size:15px;margin:24px 0 6px;color:${tone};">${escapeHtml(title)}</h2>${body}`;
}

export function renderDigestEmail(
  digest: Digest,
  options: { name: string; baseUrl: string; today: string }
): { subject: string; html: string; text: string } {
  const { baseUrl } = options;
  const firstName = options.name.trim().split(/\s+/)[0] ?? "";
  const parts: string[] = [];
  const lines: string[] = [];

  const add = (title: string, tone: string, items: DigestItem[], showAssignees = false) => {
    if (items.length === 0) return;
    parts.push(section(`${title} (${items.length})`, tone, itemsTable(baseUrl, items, showAssignees)));
    lines.push(`${title} (${items.length})`, ...items.map((item) => `- ${item.title} · ${item.space}${item.due_date ? ` · ${formatShortDate(item.due_date)}` : ""}`), "");
  };

  add("Atrasadas", "#b42318", digest.overdue);
  add("Vencem hoje", "#285f7a", digest.today);
  add("Vencem no próximo dia útil", "#285f7a", digest.next);
  for (const team of digest.teams) {
    add(`${team.space}: atrasadas há mais de 2 dias úteis`, "#b42318", team.overdue, true);
    add(`${team.space}: paradas em Aguardando há mais de 5 dias úteis`, "#b54708", team.stalled, true);
  }

  const mine = digest.overdue.length + digest.today.length;
  const subject =
    mine > 0
      ? `Planner Ops: ${mine} tarefa${mine === 1 ? "" : "s"} para hoje ou atrasada${mine === 1 ? "" : "s"}`
      : "Planner Ops: resumo do dia";

  const html = `<!doctype html><html><body style="margin:0;background:#f4f8f9;font-family:Arial,Helvetica,sans-serif;color:#1c1c1c;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dce9eb;border-radius:8px;">
<tr><td style="padding:24px 28px;">
<p style="margin:0;color:#3e84a8;font-size:12px;font-weight:600;text-transform:uppercase;">Operações Legais · Planner</p>
<h1 style="margin:6px 0 4px;font-size:20px;">Bom dia, ${escapeHtml(firstName)}</h1>
<p style="margin:0;color:#5b6b73;font-size:14px;">Resumo de ${formatShortDate(options.today)}.</p>
${parts.join("")}
<p style="margin:28px 0 0;"><a href="${baseUrl}${OPS_PLANNER_PATH}" style="display:inline-block;background:#347796;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:6px;">Abrir Minhas tarefas</a></p>
<p style="margin:20px 0 0;color:#8a989e;font-size:12px;">Você recebe este e-mail porque participa do Planner de Operações Legais. Dá para desligar em Planner Ops &gt; Minhas tarefas &gt; Avisos por e-mail.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [`Bom dia, ${firstName}. Resumo de ${formatShortDate(options.today)}.`, "", ...lines, `${baseUrl}${OPS_PLANNER_PATH}`].join("\n");
  return { subject, html, text };
}
