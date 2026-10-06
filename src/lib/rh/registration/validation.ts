import { isValidCPF, onlyDigits } from "@/lib/masks-br";
import { BRAZIL_UF_OPTIONS } from "@/lib/rh/qualifications/types";
import {
  BLOOD_TYPE_OPTIONS,
  coerceRegistrationAnswers,
  DIETARY_NEEDS_DETAIL,
  DIETARY_NONE,
  DIETARY_OPTIONS,
  GENDER_OPTIONS,
  RACE_COLOR_OPTIONS,
  type Option,
  type RegistrationAnswers,
  type RegistrationField,
  type RegistrationKind,
} from "./types";

export type RegistrationErrors = Partial<Record<RegistrationField, string>>;

/** Campos que só aparecem para um vínculo específico. */
export const KIND_ONLY_FIELDS: Record<RegistrationKind, RegistrationField[]> = {
  clt: ["ctpsNumber", "voterTitle"],
  estagio: ["institution", "coursePeriod", "studentRa"],
  socio_servico: ["oabNumber", "oabUf"],
};

const ALL_KIND_ONLY = new Set<RegistrationField>(Object.values(KIND_ONLY_FIELDS).flat());

/** Ordem de exibição — usada para rolar até o primeiro erro. */
export const REGISTRATION_FIELD_ORDER: RegistrationField[] = [
  "fullName",
  "birthDate",
  "gender",
  "parentName",
  "rg",
  "rgIssuer",
  "cpf",
  "nationality",
  "birthplace",
  "raceColor",
  "pis",
  "ctpsNumber",
  "voterTitle",
  "institution",
  "coursePeriod",
  "studentRa",
  "oabNumber",
  "oabUf",
  "personalPhone",
  "emergencyPhone",
  "emergencyContactName",
  "personalEmail",
  "bloodType",
  "dietaryRestrictions",
  "dietaryNotes",
  "bankName",
  "bankAgency",
  "bankAccount",
  "pixKey",
  "cep",
  "street",
  "number",
  "complement",
  "district",
  "city",
  "state",
];

const MAX_TEXT = 200;

function inOptions(options: Option[], value: string): boolean {
  return options.some((option) => option.value === value);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function ageOn(birthDate: string, now: Date): number {
  const [y, m, d] = birthDate.split("-").map(Number);
  let age = now.getUTCFullYear() - y;
  const beforeBirthday =
    now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Limpa as respostas: corta espaços, limita tamanho, descarta campos de outros
 * vínculos e normaliza a lista de restrições ("nenhuma" é exclusiva).
 */
export function normalizeRegistrationAnswers(
  raw: unknown,
  kind: RegistrationKind
): RegistrationAnswers {
  const answers = coerceRegistrationAnswers(raw);
  const allowed = new Set(KIND_ONLY_FIELDS[kind]);
  const result = { ...answers } as Record<string, unknown>;

  for (const key of Object.keys(answers) as RegistrationField[]) {
    if (key === "dietaryRestrictions") continue;
    const value = String(answers[key] ?? "").trim().slice(0, key === "dietaryNotes" ? 500 : MAX_TEXT);
    result[key] = ALL_KIND_ONLY.has(key) && !allowed.has(key) ? "" : value;
  }

  const known = new Set(DIETARY_OPTIONS.map((option) => option.value));
  let dietary = [...new Set(answers.dietaryRestrictions.filter((item) => known.has(item)))];
  if (dietary.includes(DIETARY_NONE) && dietary.length > 1) {
    dietary = dietary.filter((item) => item !== DIETARY_NONE);
  }
  result.dietaryRestrictions = dietary;
  if (!dietary.some((item) => DIETARY_NEEDS_DETAIL.has(item))) {
    result.dietaryNotes = "";
  }

  result.personalEmail = String(result.personalEmail).toLowerCase();
  result.oabUf = String(result.oabUf).toUpperCase();
  result.state = String(result.state).toUpperCase();
  return result as unknown as RegistrationAnswers;
}

export function validateRegistrationAnswers(
  answers: RegistrationAnswers,
  kind: RegistrationKind,
  now: Date = new Date()
): RegistrationErrors {
  const errors: RegistrationErrors = {};
  const required = (field: RegistrationField, message: string) => {
    const value = answers[field];
    if (typeof value === "string" && !value.trim()) errors[field] = message;
  };

  required("fullName", "Informe o nome completo.");
  if (answers.fullName && answers.fullName.trim().split(/\s+/).length < 2) {
    errors.fullName = "Informe nome e sobrenome.";
  }

  if (!answers.birthDate) {
    errors.birthDate = "Informe a data de nascimento.";
  } else if (!isValidIsoDate(answers.birthDate)) {
    errors.birthDate = "Data inválida.";
  } else {
    const age = ageOn(answers.birthDate, now);
    if (age < 14 || age > 100) errors.birthDate = "Confira a data de nascimento.";
  }

  if (!inOptions(GENDER_OPTIONS, answers.gender)) errors.gender = "Selecione uma opção.";
  required("parentName", "Informe o nome da mãe ou do pai.");
  required("rg", "Informe o número do RG.");
  required("rgIssuer", "Informe o órgão emissor e a UF (ex.: SSP/SP).");

  if (!answers.cpf) errors.cpf = "Informe o CPF.";
  else if (!isValidCPF(answers.cpf)) errors.cpf = "CPF inválido.";

  required("nationality", "Informe a nacionalidade.");
  required("birthplace", "Informe a naturalidade (cidade/UF onde nasceu).");
  if (!inOptions(RACE_COLOR_OPTIONS, answers.raceColor)) errors.raceColor = "Selecione uma opção.";

  const pisDigits = onlyDigits(answers.pis);
  if (kind === "clt" && !pisDigits) errors.pis = "Informe o PIS.";
  else if (pisDigits && pisDigits.length !== 11) errors.pis = "O PIS tem 11 dígitos.";

  if (kind === "clt") {
    required("ctpsNumber", "Informe o número da carteira de trabalho digital.");
    const voter = onlyDigits(answers.voterTitle);
    if (!voter) errors.voterTitle = "Informe o título de eleitor.";
    else if (voter.length !== 12) errors.voterTitle = "O título de eleitor tem 12 dígitos.";
  }

  if (kind === "estagio") {
    required("institution", "Informe a instituição de ensino.");
    required("coursePeriod", "Informe o ano/período atual.");
    required("studentRa", "Informe o número do RA.");
  }

  if (kind === "socio_servico") {
    required("oabNumber", "Informe o número da OAB.");
    if (!(BRAZIL_UF_OPTIONS as readonly string[]).includes(answers.oabUf)) {
      errors.oabUf = "Selecione a UF da OAB.";
    }
  }

  const phone = onlyDigits(answers.personalPhone);
  if (phone.length < 10) errors.personalPhone = "Informe um telefone com DDD.";
  const emergency = onlyDigits(answers.emergencyPhone);
  if (emergency.length < 10) errors.emergencyPhone = "Informe um telefone de emergência com DDD.";
  else if (emergency === phone) errors.emergencyPhone = "Use o telefone de outra pessoa.";

  if (!answers.personalEmail) errors.personalEmail = "Informe o e-mail pessoal.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.personalEmail)) {
    errors.personalEmail = "E-mail inválido.";
  }

  if (answers.bloodType && !inOptions(BLOOD_TYPE_OPTIONS, answers.bloodType)) {
    errors.bloodType = "Selecione uma opção.";
  }
  if (answers.dietaryRestrictions.length === 0) {
    errors.dietaryRestrictions = "Marque uma opção (ou \"Nenhuma restrição\").";
  }
  if (
    answers.dietaryRestrictions.some((item) => DIETARY_NEEDS_DETAIL.has(item)) &&
    !answers.dietaryNotes.trim()
  ) {
    errors.dietaryNotes = "Conte qual é a restrição.";
  }

  required("bankName", "Informe o banco.");
  required("bankAgency", "Informe a agência.");
  required("bankAccount", "Informe o número da conta.");

  if (onlyDigits(answers.cep).length !== 8) errors.cep = "Informe o CEP (8 dígitos).";
  required("street", "Informe a rua/avenida.");
  required("number", "Informe o número.");
  required("district", "Informe o bairro.");
  required("city", "Informe a cidade.");
  if (!(BRAZIL_UF_OPTIONS as readonly string[]).includes(answers.state)) {
    errors.state = "Selecione a UF.";
  }

  return errors;
}

export function firstErrorField(errors: RegistrationErrors): RegistrationField | null {
  return REGISTRATION_FIELD_ORDER.find((field) => errors[field]) ?? null;
}
