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

/**
 * Ícone: um dos atalhos do modelo (desenhados no código) ou um da Iconify, gravado como
 * "iconify:lucide:scale". A IA só escolhe entre os atalhos e repete o da Iconify.
 */
export interface IconField extends BaseField {
  kind: "icone";
  opcoes: { value: string; label: string }[];
  padrao: string;
}

/** Imagem enviada pelo usuário (foto de capa, logo de cliente). A IA não mexe nela. */
export interface ImageField extends BaseField {
  kind: "imagem";
  /**
   * Pasta da galeria da coleção, para reaproveitar o que já foi enviado: "fotos" são
   * recortes sem fundo; "retratos", fotos com fundo para cartões.
   */
  pasta: "fotos" | "logos" | "retratos";
}

export interface ListField extends BaseField {
  kind: "lista";
  /** Nome de um item ("Palco", "Item"), usado no botão de adicionar. */
  item: string;
  min: number;
  max: number;
  campos: (TextField | OptionField | IconField)[];
}

export type StudioField = TextField | ToggleField | OptionField | IconField | ImageField | ListField;

/** Conjuntos da Iconify com licença que permite uso comercial sem crédito (MIT, Apache, ISC). */
export const ICONIFY_SETS = ["lucide", "tabler", "mdi", "ph", "material-symbols", "ri", "carbon", "fluent", "iconoir", "heroicons"] as const;

const ICONIFY_RE = /^iconify:([a-z0-9-]{2,24}):([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function parseIconify(value: string): { prefix: string; name: string } | null {
  const match = ICONIFY_RE.exec(value);
  if (!match || match[2].length > 80 || !(ICONIFY_SETS as readonly string[]).includes(match[1])) return null;
  return { prefix: match[1], name: match[2] };
}

/** Caminho no bucket ESTUDIO-PECAS: "<TAG>/<pasta>/<arquivo>". */
export const IMAGE_PATH_RE = /^[A-Za-z0-9_-]{1,24}\/(fotos|retratos|logos|fundos|modelos)\/[A-Za-z0-9._-]{1,140}$/;

export function imageKeys(fields: StudioField[]): string[] {
  return fields.filter((f) => f.kind === "imagem").map((f) => f.key);
}

/** Tira a marcação de negrito (**texto**) para o texto puro. */
export function stripMarkup(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}
export type ListItem = Record<string, string>;
export type FieldValue = string | boolean | ListItem[];
export type FieldValues = Record<string, FieldValue>;

function defaultItem(campos: ListField["campos"]): ListItem {
  return Object.fromEntries(campos.map((c) => [c.key, c.kind === "texto" ? "" : c.padrao]));
}

export function emptyListItem(field: ListField): ListItem {
  return defaultItem(field.campos);
}

export function defaultValues(fields: StudioField[]): FieldValues {
  const values: FieldValues = {};
  for (const f of fields) {
    if (f.kind === "texto" || f.kind === "imagem") values[f.key] = "";
    else if (f.kind === "alternar") values[f.key] = f.padrao;
    else if (f.kind === "opcao" || f.kind === "icone") values[f.key] = f.padrao;
    else values[f.key] = Array.from({ length: f.min }, () => defaultItem(f.campos));
  }
  return values;
}

/** Corta no limite sem partir palavra (texto da IA às vezes passa um pouco). */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:–—-]+$/, "");
}

function normalizeText(field: TextField, raw: unknown): string {
  const text = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  const clean = field.multilinha ? text.replace(/\r\n?/g, "\n") : text.replace(/\s*\n\s*/g, " ");
  return clip(clean, field.max);
}

function normalizeOption(field: OptionField, raw: unknown): string {
  return field.opcoes.some((o) => o.value === raw) ? (raw as string) : field.padrao;
}

function normalizeIcon(field: IconField, raw: unknown): string {
  if (typeof raw !== "string") return field.padrao;
  return field.opcoes.some((o) => o.value === raw) || parseIconify(raw) ? raw : field.padrao;
}

function normalizeSub(field: ListField["campos"][number], raw: unknown): string {
  if (field.kind === "texto") return normalizeText(field, raw);
  return field.kind === "icone" ? normalizeIcon(field, raw) : normalizeOption(field, raw);
}

/** Ajusta valores vindos do banco ou da IA ao formato do modelo (tipos, limites, tamanho das listas). */
export function normalizeValues(fields: StudioField[], raw: unknown): FieldValues {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const values: FieldValues = {};
  for (const f of fields) {
    const v = source[f.key];
    if (f.kind === "texto") values[f.key] = normalizeText(f, v);
    else if (f.kind === "imagem") values[f.key] = typeof v === "string" && IMAGE_PATH_RE.test(v) ? v : "";
    else if (f.kind === "alternar") values[f.key] = typeof v === "boolean" ? v : f.padrao;
    else if (f.kind === "opcao") values[f.key] = normalizeOption(f, v);
    else if (f.kind === "icone") values[f.key] = normalizeIcon(f, v);
    else {
      const items = (Array.isArray(v) ? v : []).slice(0, f.max).map((item) => {
        const obj = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return Object.fromEntries(f.campos.map((c) => [c.key, normalizeSub(c, obj[c.key])])) as ListItem;
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

const iconChoices = (field: IconField) => field.opcoes.map((o) => o.value).join(" | ");

// texto livre: o ícone da Iconify escolhido à mão precisa poder voltar igual
function iconSchema(field: IconField) {
  return z
    .string()
    .describe([field.label, field.dica, `um destes: ${iconChoices(field)}`, `se o valor atual começar com "iconify:", repita igual`].filter(Boolean).join(". "));
}

function subSchema(field: ListField["campos"][number]) {
  if (field.kind === "texto") return textSchema(field);
  return field.kind === "icone" ? iconSchema(field) : optionSchema(field);
}

/** Schema dos valores de um modelo para a IA (campo vazio = não usar). Imagens ficam de fora. */
export function aiValuesSchema(fields: StudioField[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    if (f.kind === "imagem") continue;
    if (f.kind === "texto") shape[f.key] = textSchema(f);
    else if (f.kind === "alternar") shape[f.key] = z.boolean().describe([f.label, f.dica].filter(Boolean).join(". "));
    else if (f.kind === "opcao") shape[f.key] = optionSchema(f);
    else if (f.kind === "icone") shape[f.key] = iconSchema(f);
    else {
      const itemShape: Record<string, z.ZodType> = {};
      for (const c of f.campos) itemShape[c.key] = subSchema(c);
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
    .filter((f) => f.kind !== "imagem")
    .map((f) => {
      if (f.kind === "texto") return `- ${f.key} (texto, até ${f.max}): ${f.label}${f.dica ? ` — ${f.dica}` : ""}`;
      if (f.kind === "alternar") return `- ${f.key} (sim/não): ${f.label}${f.dica ? ` — ${f.dica}` : ""}`;
      if (f.kind === "opcao") return `- ${f.key} (${f.opcoes.map((o) => o.value).join(" | ")}): ${f.label}${f.dica ? ` — ${f.dica}` : ""}`;
      if (f.kind === "icone") return `- ${f.key} (ícone: ${iconChoices(f)}, ou o iconify:… atual): ${f.label}${f.dica ? ` — ${f.dica}` : ""}`;
      const sub = f.campos.map((c) =>
        c.kind === "texto" ? `${c.key} (até ${c.max})` : c.kind === "icone" ? `${c.key} (ícone: ${iconChoices(c)})` : `${c.key} (${c.opcoes.map((o) => o.value).join(" | ")})`
      );
      return `- ${f.key} (lista de ${f.min} a ${f.max} ${f.item.toLowerCase()}s: ${sub.join(", ")}): ${f.label}${f.dica ? ` — ${f.dica}` : ""}`;
    })
    .join("\n");
}

/** Texto do slide em linhas ("Título: …"), para o checklist do planner. Campos vazios e chaves ficam de fora. */
export function valuesToLines(fields: StudioField[], values: FieldValues): string[] {
  const lines: string[] = [];
  for (const f of fields) {
    const v = values[f.key];
    if (f.kind === "texto" && typeof v === "string" && v.trim()) lines.push(`${f.label}: ${stripMarkup(v.trim())}`);
    if (f.kind === "lista" && Array.isArray(v)) {
      for (const item of v) {
        const parts = f.campos
          .filter((c) => c.kind === "texto")
          .map((c) => stripMarkup(item[c.key]?.trim() ?? ""))
          .filter(Boolean);
        if (parts.length) lines.push(`${f.item}: ${parts.join(" — ")}`);
      }
    }
  }
  return lines;
}
