/**
 * Ficha cadastral. Duas origens:
 * - admissão: respondida pela pessoa por link público antes de existir no VIOS;
 * - atualização: o colaborador logado completa a própria ficha em /minha-ficha.
 */

/** `geral` = colaborador sem vínculo no VIOS (só os campos comuns). */
export type RegistrationKind = "clt" | "estagio" | "socio_servico" | "prestador" | "geral";
export type RegistrationStatus = "pendente" | "recebida" | "aprovada" | "cancelada";
export type RegistrationOrigin = "admissao" | "atualizacao";

export const REGISTRATION_KIND_LABEL: Record<RegistrationKind, string> = {
  clt: "CLT",
  estagio: "Estágio",
  socio_servico: "Sócio de serviço",
  prestador: "Prestador de serviço",
  geral: "Sem vínculo definido",
};

/** Valor equivalente em `hr_employees.employment_type` (null = não preencher). */
export const REGISTRATION_KIND_EMPLOYMENT_TYPE: Record<RegistrationKind, string | null> = {
  clt: "CLT",
  estagio: "ESTAGIÁRIO",
  socio_servico: "SÓCIO DE SERVIÇO",
  prestador: "PRESTADOR",
  geral: null,
};

function employmentTypeKey(value: string | null | undefined): string {
  return (value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
}

/**
 * Ficha de cada `hr_employees.employment_type`. Assistente segue a CLT e os
 * sócios (cotista/patrimonial) usam a ficha com OAB do sócio de serviço.
 */
const KIND_BY_EMPLOYMENT_TYPE: Record<string, RegistrationKind> = {
  CLT: "clt",
  ASSISTENTE: "clt",
  ESTAGIARIO: "estagio",
  "SOCIO DE SERVICO": "socio_servico",
  "SOCIO COTISTA": "socio_servico",
  "SOCIO PATRIMONIAL": "socio_servico",
  PRESTADOR: "prestador",
};

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  CLT: "CLT",
  ASSISTENTE: "Assistente",
  ESTAGIARIO: "Estágio",
  "SOCIO DE SERVICO": "Sócio de serviço",
  "SOCIO COTISTA": "Sócio cotista",
  "SOCIO PATRIMONIAL": "Sócio patrimonial",
  PRESTADOR: "Prestador de serviço",
};

export function registrationKindForEmploymentType(value: string | null | undefined): RegistrationKind {
  return KIND_BY_EMPLOYMENT_TYPE[employmentTypeKey(value)] ?? "geral";
}

/** Nome do vínculo para mostrar à pessoa ("Sócio cotista", não "Sócio de serviço"). */
export function employmentTypeLabel(value: string | null | undefined, fallback: RegistrationKind): string {
  return EMPLOYMENT_TYPE_LABEL[employmentTypeKey(value)] ?? REGISTRATION_KIND_LABEL[fallback];
}

export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  pendente: "Aguardando resposta",
  recebida: "Recebida",
  aprovada: "Aprovada",
  cancelada: "Cancelada",
};

/** Vínculos que a RH escolhe. `geral` só surge na atualização de quem não tem vínculo no VIOS. */
export const REGISTRATION_KINDS: readonly RegistrationKind[] = ["clt", "estagio", "socio_servico", "prestador"];

const ALL_REGISTRATION_KINDS: readonly string[] = [...REGISTRATION_KINDS, "geral"];

export function isRegistrationKind(value: unknown): value is RegistrationKind {
  return typeof value === "string" && ALL_REGISTRATION_KINDS.includes(value);
}

export const REGISTRATION_ORIGIN_LABEL: Record<RegistrationOrigin, string> = {
  admissao: "Admissão",
  atualizacao: "Atualização",
};

/** Página com login onde o colaborador atualiza a própria ficha. */
export const SELF_REGISTRATION_PATH = "/minha-ficha";

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

/** Nome curto de cada campo (lista do que falta, avisos). */
export const REGISTRATION_FIELD_LABEL: Record<RegistrationField, string> = {
  fullName: "Nome completo",
  birthDate: "Data de nascimento",
  gender: "Gênero",
  parentName: "Nome da mãe ou do pai",
  rg: "RG",
  rgIssuer: "Órgão emissor do RG",
  cpf: "CPF",
  nationality: "Nacionalidade",
  birthplace: "Naturalidade",
  raceColor: "Raça/cor",
  pis: "PIS",
  ctpsNumber: "Carteira de trabalho",
  voterTitle: "Título de eleitor",
  institution: "Instituição de ensino",
  coursePeriod: "Período do curso",
  studentRa: "RA",
  oabNumber: "Número da OAB",
  oabUf: "UF da OAB",
  personalPhone: "Telefone particular",
  emergencyPhone: "Telefone de emergência",
  emergencyContactName: "Contato de emergência",
  personalEmail: "E-mail particular",
  bloodType: "Tipo sanguíneo",
  dietaryRestrictions: "Restrição alimentar",
  dietaryNotes: "Detalhe da restrição",
  bankName: "Banco",
  bankAgency: "Agência",
  bankAccount: "Conta",
  pixKey: "Chave Pix",
  cep: "CEP",
  street: "Rua",
  number: "Número",
  complement: "Complemento",
  district: "Bairro",
  city: "Cidade",
  state: "UF",
};

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
  employment_type?: string | null;
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
  origin: RegistrationOrigin;
  employment_kind: RegistrationKind;
  invitee_name: string;
  invitee_personal_email: string | null;
  invitee_phone: string | null;
  expected_admission_date: string | null;
  status: RegistrationStatus;
  /** Null quando a ficha não tem link público (atualização com login). */
  expires_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  linked_at: string | null;
  applied_at: string | null;
  created_at: string;
  employee: RegistrationEmployeeRef | null;
  /** Nome declarado na ficha (pode diferir do convite). */
  declared_name: string | null;
  suggestions: RegistrationMatchSuggestion[];
  /** Null quando a ficha não tem link público (atualização com login). */
  public_path: string | null;
}

export interface RegistrationDetail extends RegistrationListItem {
  answers: RegistrationAnswers;
  reopen_note: string | null;
  consent_at: string | null;
}

export function registrationPublicPath(token: string): string {
  return `/ficha-cadastral/${token}`;
}

export function isRegistrationExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= now.getTime();
}
