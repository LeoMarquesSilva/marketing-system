import { maskCEP, maskPhoneBR, onlyDigits } from "@/lib/masks-br";
import type { PrefillQualification } from "./self-prefill";
import { REGISTRATION_FIELD_LABEL, type RegistrationAnswers, type RegistrationField } from "./types";

/**
 * Contato e endereço que a ficha aprovada leva para a qualificação jurídica
 * (`hr_qualifications`), que é a fonte dos documentos. Nome, CPF, nascimento
 * e OAB ficam de fora: vêm do VIOS ou da própria qualificação.
 */
export type QualificationContactColumn =
  | "rg"
  | "rg_issuer"
  | "cep"
  | "street"
  | "number"
  | "complement"
  | "district"
  | "city"
  | "state"
  | "personal_phone"
  | "personal_email";

export type QualificationContact = Pick<PrefillQualification, QualificationContactColumn>;

export const QUALIFICATION_CONTACT_SELECT =
  "rg, rg_issuer, cep, street, number, complement, district, city, state, personal_phone, personal_email";

export interface QualificationChange {
  column: QualificationContactColumn;
  label: string;
  /** Como está hoje na qualificação, pronto para leitura ("" = vazio). */
  current: string;
  /** Como fica depois da aprovação ("" = vazio). */
  next: string;
  /** Valor gravado na coluna. */
  value: string | null;
}

/** O que a aprovação faz na qualificação (`exists: false` = colaborador ainda sem qualificação). */
export interface QualificationSyncPreview {
  exists: boolean;
  changes: QualificationChange[];
}

interface ContactField {
  column: QualificationContactColumn;
  field: RegistrationField;
  label?: string;
  /** Chave de comparação: diferenças só de formato não contam como mudança. */
  key: (value: string) => string;
  /** Valor no formato que a qualificação guarda. */
  store: (value: string) => string;
  show: (value: string) => string;
  /** Campo opcional na ficha: vazio é resposta ("sem complemento") e limpa a qualificação. */
  clearable?: boolean;
}

const squash = (value: string) => value.trim().replace(/\s+/g, " ");
const same = (value: string) => value;

const CONTACT_FIELDS: ContactField[] = [
  {
    column: "rg",
    field: "rg",
    key: (value) => value.toUpperCase().replace(/[^0-9A-Z]/g, ""),
    store: squash,
    show: same,
  },
  { column: "rg_issuer", field: "rgIssuer", key: (value) => squash(value).toUpperCase(), store: squash, show: same },
  { column: "cep", field: "cep", key: onlyDigits, store: onlyDigits, show: maskCEP },
  { column: "street", field: "street", key: squash, store: squash, show: same },
  { column: "number", field: "number", label: "Número do endereço", key: squash, store: squash, show: same },
  { column: "complement", field: "complement", key: squash, store: squash, show: same, clearable: true },
  { column: "district", field: "district", key: squash, store: squash, show: same },
  { column: "city", field: "city", key: squash, store: squash, show: same },
  {
    column: "state",
    field: "state",
    key: (value) => squash(value).toUpperCase(),
    store: (value) => squash(value).toUpperCase(),
    show: (value) => value.toUpperCase(),
  },
  // O formulário da qualificação guarda o telefone com máscara.
  { column: "personal_phone", field: "personalPhone", key: onlyDigits, store: maskPhoneBR, show: maskPhoneBR },
  {
    column: "personal_email",
    field: "personalEmail",
    key: (value) => value.trim().toLowerCase(),
    store: (value) => value.trim().toLowerCase(),
    show: same,
  },
];

/**
 * O que muda na qualificação se a ficha for aprovada. Campo vazio na ficha não
 * apaga o que a qualificação já tem, exceto o complemento (opcional na ficha).
 */
export function diffQualificationContact(
  current: QualificationContact,
  answers: RegistrationAnswers
): QualificationChange[] {
  const changes: QualificationChange[] = [];
  for (const spec of CONTACT_FIELDS) {
    const before = (current[spec.column] ?? "").trim();
    const submitted = String(answers[spec.field] ?? "").trim();
    if (!submitted && !spec.clearable) continue;
    if (spec.key(before) === spec.key(submitted)) continue;
    const value = submitted ? spec.store(submitted) : null;
    changes.push({
      column: spec.column,
      label: spec.label ?? REGISTRATION_FIELD_LABEL[spec.field],
      current: before ? spec.show(before) : "",
      next: value ? spec.show(value) : "",
      value,
    });
  }
  return changes;
}

/** Patch de `hr_qualifications` com as mudanças calculadas. */
export function qualificationContactPatch(changes: QualificationChange[]): Partial<QualificationContact> {
  return Object.fromEntries(changes.map((change) => [change.column, change.value]));
}
