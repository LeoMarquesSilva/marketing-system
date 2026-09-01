import { GustavoContentError } from "@/lib/gustavo-content/errors";

export interface StrategyPillar {
  title: string;
  description: string;
  reason: string;
}

export interface StrategyChannelRole {
  channel: string;
  role: string;
  reason: string;
}

export interface GustavoStrategyInput {
  positioning?: unknown;
  editorial_promise?: unknown;
  strategic_rationale?: unknown;
  icp?: unknown;
  icp_context?: unknown;
  content_pillars?: unknown;
  channel_roles?: unknown;
  editorial_principles?: unknown;
  avoidances?: unknown;
  success_signals?: unknown;
}

export interface ValidatedGustavoStrategy {
  positioning: string;
  editorial_promise: string;
  strategic_rationale: string;
  icp: string[];
  icp_context: string;
  content_pillars: StrategyPillar[];
  channel_roles: StrategyChannelRole[];
  editorial_principles: string[];
  avoidances: string[];
  success_signals: string[];
}

export interface GustavoStrategy extends ValidatedGustavoStrategy {
  id: "main";
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

function requiredText(value: unknown, label: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new GustavoContentError(`Informe ${label}.`, 400);
  return text;
}

function optionalText(value: unknown): string {
  return String(value ?? "").trim();
}

function textList(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value.map((item) => String(item))
    : String(value ?? "").split(/[;\n]+/);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    const text = part.trim();
    const key = text.toLocaleLowerCase("pt-BR");
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function structuredList<T extends object>(
  value: unknown,
  fields: readonly (keyof T)[],
  requiredField: keyof T
): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const record = raw as Record<string, unknown>;
    const item = Object.fromEntries(
      fields.map((field) => [field, optionalText(record[String(field)])])
    ) as T;
    return String(item[requiredField] ?? "") ? [item] : [];
  });
}

export function validateStrategyInput(
  input: GustavoStrategyInput
): ValidatedGustavoStrategy {
  const icp = textList(input.icp);
  if (icp.length === 0) {
    throw new GustavoContentError("Informe pelo menos um público do ICP.", 400);
  }

  return {
    positioning: requiredText(input.positioning, "o posicionamento desejado"),
    editorial_promise: requiredText(input.editorial_promise, "a promessa editorial"),
    strategic_rationale: requiredText(input.strategic_rationale, "a razão estratégica"),
    icp,
    icp_context: optionalText(input.icp_context),
    content_pillars: structuredList<StrategyPillar>(
      input.content_pillars,
      ["title", "description", "reason"],
      "title"
    ),
    channel_roles: structuredList<StrategyChannelRole>(
      input.channel_roles,
      ["channel", "role", "reason"],
      "channel"
    ),
    editorial_principles: textList(input.editorial_principles),
    avoidances: textList(input.avoidances),
    success_signals: textList(input.success_signals),
  };
}

export function buildStrategyPrompt(strategy: ValidatedGustavoStrategy): string {
  const pillars = strategy.content_pillars
    .map(
      (pillar) =>
        `- ${pillar.title}: ${pillar.description || "—"} POR QUÊ: ${pillar.reason || "—"}`
    )
    .join("\n");
  const channels = strategy.channel_roles
    .map(
      (channel) =>
        `- ${channel.channel}: ${channel.role || "—"} POR QUÊ: ${channel.reason || "—"}`
    )
    .join("\n");

  return [
    `POSICIONAMENTO DESEJADO\n${strategy.positioning}`,
    `PROMESSA EDITORIAL\n${strategy.editorial_promise}`,
    `POR QUE ESSA ESTRATÉGIA EXISTE\n${strategy.strategic_rationale}`,
    `ICP\n${strategy.icp.join(" | ")}\n${strategy.icp_context}`,
    `PILARES E JUSTIFICATIVAS\n${pillars || "—"}`,
    `PAPEL DOS CANAIS\n${channels || "—"}`,
    `PRINCÍPIOS: ${strategy.editorial_principles.join(" | ") || "—"}`,
    `EVITAR: ${strategy.avoidances.join(" | ") || "—"}`,
    `SINAIS DE SUCESSO: ${strategy.success_signals.join(" | ") || "—"}`,
  ].join("\n\n");
}
