/**
 * Ficha cadastral de admissão (CLT, Estágio, Sócio de serviço), respondida
 * pela pessoa por link público antes de existir no VIOS.
 */

export type RegistrationKind = "clt" | "estagio" | "socio_servico";
export type RegistrationStatus = "pendente" | "recebida" | "aprovada" | "cancelada";

export const REGISTRATION_KIND_LABEL: Record<RegistrationKind, string> = {
  clt: "CLT",
  estagio: "Estágio",
  socio_servico: "Sócio de serviço",
};

/** Valor equivalente em `hr_employees.employment_type`. */
export const REGISTRATION_KIND_EMPLOYMENT_TYPE: Record<RegistrationKind, string> = {
  clt: "CLT",
  estagio: "ESTAGIÁRIO",
  socio_servico: "SÓCIO DE SERVIÇO",
};

export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  pendente: "Aguardando resposta",
  recebida: "Recebida",
  aprovada: "Aprovada",
  cancelada: "Cancelada",
};

export const REGISTRATION_KINDS: readonly RegistrationKind[] = ["clt", "estagio", "socio_servico"];

export function isRegistrationKind(value: unknown): value is RegistrationKind {
  return typeof value === "string" && (REGISTRATION_KINDS as readonly string[]).includes(value);
}

export interface RegistrationAnswers {
  // Dados pessoais
  fullName: string;
  birthDate: string;
  gender: string;
  parentName: string;
  rg: string;
  rgIssuer: string;
  cpf: string;
  // Dados complementares (todos os vínculos)
  nationality: string;
  birthplace: string;
  raceColor: string;
  pis: string;
  // CLT
  ctpsNumber: string;
  voterTitle: string;
  // Estágio
  institution: string;
  coursePeriod: string;
  studentRa: string;
  // Sócio de serviço
  oabNumber: string;
  oabUf: string;
  // Contato
  personalPhone: string;
  emergencyPhone: string;
  emergencyContactName: string;
  personalEmail: string;
  // Saúde e alimentação
  bloodType: string;
  dietaryRestrictions: string[];
  dietaryNotes: string;
  // Dados bancários
  bankName: string;
  bankAgency: string;
  bankAccount: string;
  pixKey: string;
  // Endereço
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

export type RegistrationField = keyof RegistrationAnswers;

export function emptyRegistrationAnswers(): RegistrationAnswers {
  return {
    fullName: "",
    birthDate: "",
    gender: "",
    parentName: "",
    rg: "",
    rgIssuer: "",
    cpf: "",
    nationality: "Brasileira",
    birthplace: "",
    raceColor: "",
    pis: "",
    ctpsNumber: "",
    voterTitle: "",
    institution: "",
    coursePeriod: "",
    studentRa: "",
    oabNumber: "",
    oabUf: "",
    personalPhone: "",
    emergencyPhone: "",
    emergencyContactName: "",
    personalEmail: "",
    bloodType: "",
    dietaryRestrictions: [],
    dietaryNotes: "",
    bankName: "",
    bankAgency: "",
    bankAccount: "",
    pixKey: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
  };
}

/** Lê o jsonb salvo (possivelmente de versão anterior) num objeto completo. */
export function coerceRegistrationAnswers(raw: unknown): RegistrationAnswers {
  const base = emptyRegistrationAnswers();
  if (!raw || typeof raw !== "object") return base;
  const source = raw as Record<string, unknown>;
  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(base) as RegistrationField[]) {
    const value = source[key];
    if (key === "dietaryRestrictions") {
      result[key] = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
    } else if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result as unknown as RegistrationAnswers;
}

export interface Option {
  value: string;
  label: string;
}

export const GENDER_OPTIONS: Option[] = [
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
  { value: "nao_binario", label: "Não binário" },
  { value: "outro", label: "Outro" },
  { value: "prefiro_nao_informar", label: "Prefiro não informar" },
];

/** Classificação do IBGE (autodeclaração). */
export const RACE_COLOR_OPTIONS: Option[] = [
  { value: "branca", label: "Branca" },
  { value: "preta", label: "Preta" },
  { value: "parda", label: "Parda" },
  { value: "amarela", label: "Amarela" },
  { value: "indigena", label: "Indígena" },
  { value: "prefiro_nao_informar", label: "Prefiro não informar" },
];

export const BLOOD_TYPE_OPTIONS: Option[] = [
  { value: "A+", label: "A+" },
  { value: "A-", label: "A−" },
  { value: "B+", label: "B+" },
  { value: "B-", label: "B−" },
  { value: "AB+", label: "AB+" },
  { value: "AB-", label: "AB−" },
  { value: "O+", label: "O+" },
  { value: "O-", label: "O−" },
  { value: "nao_sei", label: "Não sei" },
];

export const DIETARY_NONE = "nenhuma";

export const DIETARY_OPTIONS: Option[] = [
  { value: DIETARY_NONE, label: "Nenhuma restrição" },
  { value: "vegetariano", label: "Vegetariano" },
  { value: "vegano", label: "Vegano" },
  { value: "lactose", label: "Intolerância à lactose" },
  { value: "gluten", label: "Intolerância ao glúten / Celíaco" },
  { value: "alergia", label: "Alergia alimentar" },
  { value: "religiosa", label: "Restrição religiosa" },
  { value: "outra", label: "Outra" },
];

/** Restrições que exigem o campo "especifique". */
export const DIETARY_NEEDS_DETAIL = new Set(["alergia", "religiosa", "outra"]);

export function optionLabel(options: Option[], value: string | null | undefined): string {
  if (!value) return "";
  return options.find((option) => option.value === value)?.label ?? value;
}

export function dietaryLabel(value: string): string {
  return optionLabel(DIETARY_OPTIONS, value);
}

/** Restrição alimentar compartilhada com Eventos / Café com Cultura. */
export interface DietaryInfo {
  restrictions: string[];
  notes: string | null;
}

export function hasDietaryRestriction(info: DietaryInfo | null | undefined): boolean {
  return Boolean(info && info.restrictions.some((item) => item !== DIETARY_NONE));
}

/** "Vegano, Alergia alimentar (amendoim)"; vazio quando não há ficha. */
export function formatDietary(info: DietaryInfo | null | undefined): string {
  if (!info || info.restrictions.length === 0) return "";
  if (!hasDietaryRestriction(info)) return "Nenhuma restrição";
  const labels = info.restrictions.filter((item) => item !== DIETARY_NONE).map(dietaryLabel).join(", ");
  return info.notes ? `${labels} (${info.notes})` : labels;
}

export interface RegistrationEmployeeRef {
  id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  is_active: boolean;
}

export interface RegistrationMatchSuggestion {
  employeeId: string;
  fullName: string;
  department: string | null;
  position: string | null;
  reason: "cpf" | "nome";
  score: number;
}

/** Linha da lista do RH (sem as respostas sensíveis). */
export interface RegistrationListItem {
  id: string;
  employment_kind: RegistrationKind;
  invitee_name: string;
  invitee_personal_email: string | null;
  invitee_phone: string | null;
  expected_admission_date: string | null;
  status: RegistrationStatus;
  expires_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  linked_at: string | null;
  applied_at: string | null;
  created_at: string;
  employee: RegistrationEmployeeRef | null;
  /** Nome declarado na ficha (pode diferir do convite). */
  declared_name: string | null;
  suggestions: RegistrationMatchSuggestion[];
  public_path: string;
}

export interface RegistrationDetail extends RegistrationListItem {
  answers: RegistrationAnswers;
  reopen_note: string | null;
  consent_at: string | null;
}

export function registrationPublicPath(token: string): string {
  return `/ficha-cadastral/${token}`;
}

export function isRegistrationExpired(expiresAt: string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
