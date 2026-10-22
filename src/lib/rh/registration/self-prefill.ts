import {
  maskBankAccount,
  maskBankAgency,
  maskCEP,
  maskCPF,
  maskOAB,
  maskPhoneBR,
  onlyDigits,
} from "@/lib/masks-br";
import { NATIONALITY_OPTIONS } from "@/lib/rh/qualifications/types";
import {
  coerceRegistrationAnswers,
  emptyRegistrationAnswers,
  type RegistrationAnswers,
  type RegistrationField,
} from "./types";

/** Colunas de `hr_qualifications` aproveitadas na ficha. */
export type PrefillQualification = {
  full_name: string | null;
  birth_date: string | null;
  nationality: string | null;
  treatment_gender: string | null;
  cpf: string | null;
  rg: string | null;
  rg_issuer: string | null;
  oab_number: string | null;
  oab_uf: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  personal_phone: string | null;
  personal_email: string | null;
};

/** Colunas de `hr_employees` (cadastro do VIOS) aproveitadas na ficha. */
export type PrefillEmployee = {
  full_name: string;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  gender: string | null;
  oab_number: string | null;
  oab_uf: string | null;
};

/** Conta de pagamento vinda da folha (`hr_employee_bank_accounts`). */
export type PrefillPayrollAccount = {
  bank_code: string;
  bank_name: string;
  agency: string;
  account: string;
};

export const PAYROLL_ACCOUNT_SELECT = "employee_id, bank_code, bank_name, agency, account";

/** "Santander (033)", "0565", "01043989-0": o mesmo formato dos campos da ficha. */
export function payrollBankFields(payroll: PrefillPayrollAccount): {
  bankName: string;
  bankAgency: string;
  bankAccount: string;
} {
  const code = onlyDigits(payroll.bank_code).replace(/^0+(?=\d{3})/, "").padStart(3, "0");
  return {
    bankName: `${payroll.bank_name} (${code})`,
    bankAgency: maskBankAgency(payroll.agency),
    bankAccount: maskBankAccount(payroll.account),
  };
}

export const PREFILL_QUALIFICATION_SELECT =
  "full_name, birth_date, nationality, treatment_gender, cpf, rg, rg_issuer, oab_number, oab_uf, cep, street, number, complement, district, city, state, personal_phone, personal_email";

/** A qualificação guarda o valor ("brasileira"); a ficha mostra "Brasileira". */
function nationalityLabel(value: string | null): string {
  if (!value) return "";
  const option = NATIONALITY_OPTIONS.find((item) => item.value === value);
  const text = option?.feminine ?? value;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function genderFromCode(value: string | null): string {
  const code = (value ?? "").trim().toLowerCase();
  if (code === "f") return "feminino";
  if (code === "m") return "masculino";
  return "";
}

/**
 * Pré-preenche a ficha com o que o escritório já sabe: a ficha anterior vem
 * primeiro (é a palavra da própria pessoa), depois a conta da folha (dados
 * bancários), a qualificação jurídica e por último o cadastro do VIOS. Cada
 * fonte só ocupa campo ainda vazio.
 */
export function prefillSelfAnswers(
  previousAnswers: unknown | null,
  qualification: PrefillQualification | null,
  employee: PrefillEmployee,
  payroll: PrefillPayrollAccount | null = null
): RegistrationAnswers {
  const answers: RegistrationAnswers = previousAnswers
    ? coerceRegistrationAnswers(previousAnswers)
    : { ...emptyRegistrationAnswers(), nationality: "" };

  const fill = (field: Exclude<RegistrationField, "dietaryRestrictions">, value: string | null | undefined) => {
    const text = (value ?? "").trim();
    if (text && !String(answers[field] ?? "").trim()) answers[field] = text;
  };

  if (payroll) {
    const bank = payrollBankFields(payroll);
    fill("bankName", bank.bankName);
    fill("bankAgency", bank.bankAgency);
    fill("bankAccount", bank.bankAccount);
  }

  if (qualification) {
    fill("fullName", qualification.full_name);
    fill("birthDate", qualification.birth_date);
    fill("gender", genderFromCode(qualification.treatment_gender));
    fill("nationality", nationalityLabel(qualification.nationality));
    fill("cpf", qualification.cpf ? maskCPF(qualification.cpf) : null);
    fill("rg", qualification.rg);
    fill("rgIssuer", qualification.rg_issuer?.toUpperCase());
    fill("oabNumber", qualification.oab_number ? maskOAB(qualification.oab_number) : null);
    fill("oabUf", qualification.oab_uf?.toUpperCase());
    fill("cep", qualification.cep ? maskCEP(qualification.cep) : null);
    fill("street", qualification.street);
    fill("number", qualification.number);
    fill("complement", qualification.complement);
    fill("district", qualification.district);
    fill("city", qualification.city);
    fill("state", qualification.state?.toUpperCase());
    fill("personalPhone", qualification.personal_phone ? maskPhoneBR(qualification.personal_phone) : null);
    fill("personalEmail", qualification.personal_email?.toLowerCase());
  }

  fill("fullName", employee.full_name);
  fill("birthDate", employee.birth_date);
  fill("gender", genderFromCode(employee.gender));
  fill("cpf", employee.cpf && onlyDigits(employee.cpf).length === 11 ? maskCPF(employee.cpf) : null);
  fill("rg", employee.rg);
  fill("oabNumber", employee.oab_number ? maskOAB(employee.oab_number) : null);
  fill("oabUf", employee.oab_uf?.toUpperCase());
  fill("nationality", "Brasileira");

  return answers;
}
