import {
  BLOOD_TYPE_OPTIONS,
  DIETARY_NONE,
  dietaryLabel,
  GENDER_OPTIONS,
  HAS_OAB_OPTIONS,
  optionLabel,
  RACE_COLOR_OPTIONS,
  REGISTRATION_FIELD_LABEL,
  type RegistrationAnswers,
  type RegistrationField,
  type RegistrationKind,
} from "./types";
import { KIND_ONLY_FIELDS, REGISTRATION_FIELD_ORDER } from "./validation";

/**
 * Linha do tempo da ficha cadastral e os campos marcados ao devolver.
 * `changes` de cada evento guarda os valores crus; a tela formata.
 */

export type RegistrationEventType = "enviada" | "reenviada" | "devolvida" | "corrigida" | "aprovada" | "cancelada";

export interface RegistrationFieldChange {
  field: RegistrationField;
  before: string;
  after: string;
}

export interface RegistrationEvent {
  id: string;
  type: RegistrationEventType;
  actor: "pessoa" | "rh";
  /** Nome de quem fez (RH); para "pessoa", a tela usa o nome da ficha. */
  actorName: string | null;
  note: string | null;
  fields: RegistrationField[];
  changes: RegistrationFieldChange[];
  createdAt: string;
}

export const REGISTRATION_EVENT_LABEL: Record<RegistrationEventType, string> = {
  enviada: "Enviou a ficha",
  reenviada: "Reenviou a ficha",
  devolvida: "Devolveu para ajuste",
  corrigida: "Corrigiu a ficha",
  aprovada: "Aprovou a ficha",
  cancelada: "Cancelou a ficha",
};

/** Seções da ficha, na ordem do formulário (para marcar campos ao devolver). */
export const REGISTRATION_SECTIONS: { title: string; fields: RegistrationField[] }[] = [
  { title: "Dados pessoais", fields: ["fullName", "birthDate", "gender", "parentName", "rg", "rgIssuer", "cpf"] },
  {
    title: "Dados complementares",
    fields: [
      "nationality",
      "birthplace",
      "raceColor",
      "pis",
      "ctpsNumber",
      "voterTitle",
      "institution",
      "coursePeriod",
      "studentRa",
      "hasOab",
      "oabNumber",
      "oabUf",
    ],
  },
  { title: "Contato", fields: ["personalPhone", "personalEmail", "emergencyPhone", "emergencyContactName"] },
  { title: "Saúde e alimentação", fields: ["bloodType", "dietaryRestrictions", "dietaryNotes"] },
  { title: "Dados bancários", fields: ["bankName", "bankAgency", "bankAccount", "pixKey"] },
  { title: "Endereço", fields: ["cep", "street", "number", "complement", "district", "city", "state"] },
];

const ALL_FIELDS = new Set<string>(REGISTRATION_FIELD_ORDER);
const KIND_ONLY = new Set<RegistrationField>(Object.values(KIND_ONLY_FIELDS).flat());

/** Campos que existem na ficha deste vínculo. */
export function fieldsForKind(kind: RegistrationKind): RegistrationField[] {
  const own = new Set(KIND_ONLY_FIELDS[kind]);
  return REGISTRATION_FIELD_ORDER.filter((field) => !KIND_ONLY.has(field) || own.has(field));
}

/** Só nomes de campo válidos, sem repetição, na ordem da ficha. */
export function sanitizeFields(raw: unknown): RegistrationField[] {
  if (!Array.isArray(raw)) return [];
  const wanted = new Set(raw.filter((item): item is string => typeof item === "string" && ALL_FIELDS.has(item)));
  return REGISTRATION_FIELD_ORDER.filter((field) => wanted.has(field));
}

function rawValue(answers: RegistrationAnswers, field: RegistrationField): string {
  const value = answers[field];
  if (Array.isArray(value)) return [...value].sort().join(",");
  return String(value ?? "").trim();
}

/** Campos que mudaram entre duas versões da ficha. */
export function diffAnswers(before: RegistrationAnswers, after: RegistrationAnswers): RegistrationFieldChange[] {
  return REGISTRATION_FIELD_ORDER.flatMap((field) => {
    const a = rawValue(before, field);
    const b = rawValue(after, field);
    return a === b ? [] : [{ field, before: a, after: b }];
  });
}

/** Valor legível para a linha do tempo ("Feminino", "10/04/1990", "Vegano, Lactose"). */
export function formatAnswerValue(field: RegistrationField, value: string): string {
  if (!value) return "";
  switch (field) {
    case "birthDate": {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
    }
    case "gender":
      return optionLabel(GENDER_OPTIONS, value);
    case "raceColor":
      return optionLabel(RACE_COLOR_OPTIONS, value);
    case "bloodType":
      return optionLabel(BLOOD_TYPE_OPTIONS, value);
    case "hasOab":
      return optionLabel(HAS_OAB_OPTIONS, value);
    case "dietaryRestrictions":
      return value
        .split(",")
        .filter(Boolean)
        .map((item) => (item === DIETARY_NONE ? "Nenhuma restrição" : dietaryLabel(item)))
        .join(", ");
    default:
      return value;
  }
}

export function fieldLabel(field: RegistrationField): string {
  return REGISTRATION_FIELD_LABEL[field];
}

/** Lê o jsonb `changes` salvo (descarta o que não for campo conhecido). */
export function coerceChanges(raw: unknown): RegistrationFieldChange[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    if (typeof source.field !== "string" || !ALL_FIELDS.has(source.field)) return [];
    return [
      {
        field: source.field as RegistrationField,
        before: typeof source.before === "string" ? source.before : "",
        after: typeof source.after === "string" ? source.after : "",
      },
    ];
  });
}

/** Campos que andam juntos na tela: mexer em um conta como mexer no grupo. */
const FIELD_GROUPS: { label: string; fields: RegistrationField[] }[] = [
  { label: "OAB", fields: ["hasOab", "oabNumber", "oabUf"] },
  { label: "Restrição alimentar", fields: ["dietaryRestrictions", "dietaryNotes"] },
  { label: "Cidade/UF", fields: ["city", "state"] },
];

/** Dos campos pedidos na devolução, os que continuam iguais (nem o campo nem o grupo dele mudou). */
export function untouchedFields(
  flagged: readonly RegistrationField[],
  changed: Iterable<RegistrationField>
): RegistrationField[] {
  const touched = new Set(changed);
  for (const { fields } of FIELD_GROUPS) {
    if (fields.some((field) => touched.has(field))) for (const field of fields) touched.add(field);
  }
  return flagged.filter((field) => !touched.has(field));
}

/** Primeiro campo da lista na ordem do formulário (onde a ficha abre). */
export function firstField(fields: Iterable<RegistrationField>): RegistrationField | null {
  const wanted = new Set(fields);
  return REGISTRATION_FIELD_ORDER.find((field) => wanted.has(field)) ?? null;
}

export interface FlaggedItem {
  /** Campo onde a ficha abre ao clicar. */
  field: RegistrationField;
  label: string;
  fields: RegistrationField[];
}

/** Campos pedidos para mostrar à pessoa: grupo marcado inteiro vira um item só ("OAB"). */
export function flaggedItems(flagged: readonly RegistrationField[]): FlaggedItem[] {
  const wanted = new Set(flagged);
  const grouped = new Map<RegistrationField, FlaggedItem>();
  const skip = new Set<RegistrationField>();
  for (const group of FIELD_GROUPS) {
    if (!group.fields.every((field) => wanted.has(field))) continue;
    grouped.set(group.fields[0], { field: group.fields[0], label: group.label, fields: group.fields });
    for (const field of group.fields.slice(1)) skip.add(field);
  }
  return REGISTRATION_FIELD_ORDER.flatMap((field) => {
    if (!wanted.has(field) || skip.has(field)) return [];
    return [grouped.get(field) ?? { field, label: REGISTRATION_FIELD_LABEL[field], fields: [field] }];
  });
}
