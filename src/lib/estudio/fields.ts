import { z } from "zod";

/**
 * Campos editáveis de um modelo do Estúdio de peças. A mesma definição gera o
 * formulário, os valores-padrão, o schema que a IA preenche e o texto que vai
 * para o checklist do planner.
 */

interface BaseField {
  key: string;
  label: string;
  /** Explica o campo para a IA (o que vai ali, estilo, caixa alta…). */
  dica?: string;
}

export interface TextField extends BaseField {
  kind: "texto";
  max: number;
  multilinha?: boolean;
  placeholder?: string;
}

export interface ToggleField extends BaseField {
  kind: "alternar";
  padrao: boolean;
}

export interface OptionField extends BaseField {
  kind: "opcao";
  opcoes: { value: string; label: string }[];
  padrao: string;
}

export interface ListField extends BaseField {
  kind: "lista";
  /** Nome de um item ("Palco", "Item"), usado no botão de adicionar. */
  item: string;
  min: number;
  max: number;
  campos: (TextField | OptionField)[];
}

export type StudioField = TextField | ToggleField | OptionField | ListField;
export type ListItem = Record<string, string>;
export type FieldValue = string | boolean | ListItem[];
export type FieldValues = Record<string, FieldValue>;

function defaultItem(campos: ListField["campos"]): ListItem {
  return Object.fromEntries(campos.map((c) => [c.key, c.kind === "opcao" ? c.padrao : ""]));
}

export function emptyListItem(field: ListField): ListItem {
  return defaultItem(field.campos);
}

export function defaultValues(fields: StudioField[]): FieldValues {
  const values: FieldValues = {};
  for (const f of fields) {
    if (f.kind === "texto") values[f.key] = "";
    else if (f.kind === "alternar") values[f.key] = f.padrao;
    else if (f.kind === "opcao") values[f.key] = f.padrao;
    else values[f.key] = Array.from({ length: f.min }, () => defaultItem(f.campos));
  }
  return values;
}

function normalizeText(field: TextField, raw: unknown): string {
  const text = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  const clean = field.multilinha ? text.replace(/\r\n?/g, "\n") : text.replace(/\s*\n\s*/g, " ");
  return clean.slice(0, field.max);
}

function normalizeOption(field: OptionField, raw: unknown): string {
  return field.opcoes.some((o) => o.value === raw) ? (raw as string) : field.padrao;
}

/** Ajusta valores vindos do banco ou da IA ao formato do modelo (tipos, limites, tamanho das listas). */
export function normalizeValues(fields: StudioField[], raw: unknown): FieldValues {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const values: FieldValues = {};
  for (const f of fields) {
    const v = source[f.key];
    if (f.kind === "texto") values[f.key] = normalizeText(f, v);
    else if (f.kind === "alternar") values[f.key] = typeof v === "boolean" ? v : f.padrao;
    else if (f.kind === "opcao") values[f.key] = normalizeOption(f, v);
    else {
      const items = (Array.isArray(v) ? v : []).slice(0, f.max).map((item) => {
        const obj = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return Object.fromEntries(
          f.campos.map((c) => [c.key, c.kind === "texto" ? normalizeText(c, obj[c.key]) : normalizeOption(c, obj[c.key])])
        ) as ListItem;
      });
      while (items.length < f.min) items.push(defaultItem(f.campos));
      values[f.key] = items;
    }
  }
  return values;
}

function textSchema(field: TextField) {
  const hint = [field.label, field.dica, `até ${field.max} caracteres`, field.multilinha ? "pode quebrar linha com \\n" : null]
    .filter(Boolean)
    .join(". ");
  return z.string().describe(hint);
}

function optionSchema(field: OptionField) {
  const values = field.opcoes.map((o) => o.value) as [string, ...string[]];
  return z.enum(values).describe([field.label, field.dica].filter(Boolean).join(". "));
}

/** Schema dos valores de um modelo para a IA (campo vazio = não usar). */
export function aiValuesSchema(fields: StudioField[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    if (f.kind === "texto") shape[f.key] = textSchema(f);
    else if (f.kind === "alternar") shape[f.key] = z.boolean().describe([f.label, f.dica].filter(Boolean).join(". "));
    else if (f.kind === "opcao") shape[f.key] = optionSchema(f);
    else {
      const itemShape: Record<string, z.ZodType> = {};
      for (const c of f.campos) itemShape[c.key] = c.kind === "texto" ? textSchema(c) : optionSchema(c);
      shape[f.key] = z
        .array(z.object(itemShape))
        .describe(`${f.label}: de ${f.min} a ${f.max} itens. ${f.dica ?? ""}`.trim());
    }
  }
  return z.object(shape);
}

/** Lista legível dos campos de um modelo, para o prompt da IA. */
export function describeFields(fields: StudioField[]): string {
  return fields
    .map((f) => {
      if (f.kind === "texto") return `- ${f.key} (texto, até ${f.max}): ${f.label}${f.dica ? ` — ${f.dica}` : ""}`;
      if (f.kind === "alternar") return `- ${f.key} (sim/não): ${f.label}${f.dica ? ` — ${f.dica}` : ""}`;
      if (f.kind === "opcao") return `- ${f.key} (${f.opcoes.map((o) => o.value).join(" | ")}): ${f.label}${f.dica ? ` — ${f.dica}` : ""}`;
      const sub = f.campos.map((c) => (c.kind === "texto" ? `${c.key} (até ${c.max})` : `${c.key} (${c.opcoes.map((o) => o.value).join(" | ")})`));
      return `- ${f.key} (lista de ${f.min} a ${f.max} ${f.item.toLowerCase()}s: ${sub.join(", ")}): ${f.label}${f.dica ? ` — ${f.dica}` : ""}`;
    })
    .join("\n");
}

/** Texto do slide em linhas ("Título: …"), para o checklist do planner. Campos vazios e chaves ficam de fora. */
export function valuesToLines(fields: StudioField[], values: FieldValues): string[] {
  const lines: string[] = [];
  for (const f of fields) {
    const v = values[f.key];
    if (f.kind === "texto" && typeof v === "string" && v.trim()) lines.push(`${f.label}: ${v.trim()}`);
    if (f.kind === "lista" && Array.isArray(v)) {
      for (const item of v) {
        const parts = f.campos
          .filter((c) => c.kind === "texto")
          .map((c) => item[c.key]?.trim())
          .filter(Boolean);
        if (parts.length) lines.push(`${f.item}: ${parts.join(" — ")}`);
      }
    }
  }
  return lines;
}
