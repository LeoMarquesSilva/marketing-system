import { z } from "zod";
import { isValidCPF, onlyDigits } from "@/lib/masks-br";
import {
  BRAZIL_UF_OPTIONS,
  NATIONALITY_OPTIONS,
} from "@/lib/rh/qualifications/types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, {
    message: "E-mail inválido",
  });

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Data inválida",
  });

const optionalCpf = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const digits = onlyDigits(v);
    return digits.length > 0 ? digits : null;
  })
  .refine((v) => v === null || isValidCPF(v), {
    message: "CPF inválido",
  });

const optionalCep = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const digits = onlyDigits(v);
    return digits.length > 0 ? digits : null;
  })
  .refine((v) => v === null || v.length === 8, {
    message: "CEP deve ter 8 dígitos",
  });

const optionalUf = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v.toUpperCase() : null))
  .refine(
    (v) =>
      v === null ||
      (BRAZIL_UF_OPTIONS as readonly string[]).includes(v),
    { message: "UF inválida" }
  );

export const qualificationUpsertSchema = z.object({
  full_name: optionalText(200),
  birth_date: optionalDate,
  nationality: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine(
      (v) => NATIONALITY_OPTIONS.some((option) => option.value === v),
      "Nacionalidade inválida"
    ),
  marital_status: optionalText(40),
  profession: optionalText(120),
  treatment_gender: z
    .enum(["f", "m"])
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  cpf: optionalCpf,
  rg: optionalText(40),
  rg_issuer: optionalText(40),
  oab_number: optionalText(30),
  oab_uf: optionalUf,
  cep: optionalCep,
  street: optionalText(200),
  number: optionalText(30),
  complement: optionalText(120),
  district: optionalText(120),
  city: optionalText(120),
  state: optionalUf,
  personal_phone: optionalText(20),
  personal_email: optionalEmail,
});

export type QualificationUpsertInput = z.infer<typeof qualificationUpsertSchema>;

/** Campos mínimos para marcar a qualificação como completa. */
export function isQualificationComplete(data: QualificationUpsertInput): boolean {
  return Boolean(
    data.full_name &&
      data.nationality &&
      data.marital_status &&
      data.profession &&
      data.treatment_gender &&
      data.cpf &&
      data.rg &&
      data.cep &&
      data.street &&
      data.number &&
      data.district &&
      data.city &&
      data.state
  );
}
