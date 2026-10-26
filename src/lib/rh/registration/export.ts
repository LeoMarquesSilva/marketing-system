import {
  BLOOD_TYPE_OPTIONS,
  DIETARY_NONE,
  dietaryLabel,
  EMPLOYEE_FICHA_STATUS_LABEL,
  GENDER_OPTIONS,
  optionLabel,
  RACE_COLOR_OPTIONS,
  REGISTRATION_FIELD_LABEL,
  REGISTRATION_ORIGIN_LABEL,
  type EmployeeRegistrationRow,
  type PersonalBankAccount,
  type RegistrationAnswers,
} from "./types";
import { OAB_KINDS, resolveHasOab } from "./validation";

/**
 * Colunas da planilha de fichas cadastrais (uma linha por colaborador),
 * agrupadas como na ficha. Os valores saem prontos para leitura: rótulos no
 * lugar de códigos e datas em dd/mm/aaaa.
 */

export interface ExportRecord {
  row: EmployeeRegistrationRow;
  answers: RegistrationAnswers;
  /** Conta particular declarada antes da conta da folha. */
  personalBank?: PersonalBankAccount | null;
}

export interface ExportColumn {
  group: string;
  header: string;
  width: number;
  wrap?: boolean;
  value: (record: ExportRecord) => string;
}

export function formatDateBR(value: string | null | undefined): string {
  if (!value) return "";
  const iso = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const answer = (key: keyof RegistrationAnswers) => (record: ExportRecord) => String(record.answers[key] ?? "");

function dietaryText(answers: RegistrationAnswers): string {
  const items = answers.dietaryRestrictions;
  if (items.length === 0) return "";
  if (items.includes(DIETARY_NONE)) return "Nenhuma restrição";
  return items.map(dietaryLabel).join(", ");
}

function hasOabText(record: ExportRecord): string {
  if (!OAB_KINDS.has(record.row.kind)) return "";
  const value = resolveHasOab(record.answers);
  return value === "sim" ? "Sim" : value === "nao" ? "Não" : "";
}

export const EXPORT_COLUMNS: ExportColumn[] = [
  // Colaborador (cadastro do VIOS)
  { group: "Colaborador", header: "Nome", width: 32, value: (r) => r.row.fullName },
  { group: "Colaborador", header: "E-mail corporativo", width: 34, value: (r) => r.row.email ?? "" },
  { group: "Colaborador", header: "Área", width: 22, value: (r) => r.row.department ?? "" },
  { group: "Colaborador", header: "Cargo", width: 26, value: (r) => r.row.position ?? "" },
  { group: "Colaborador", header: "Vínculo", width: 18, value: (r) => r.row.vinculoLabel },
  { group: "Colaborador", header: "Admissão", width: 12, value: (r) => formatDateBR(r.row.admissionDate) },
  { group: "Colaborador", header: "Situação", width: 11, value: (r) => (r.row.isActive ? "Ativo" : "Inativo") },
  // Ficha
  { group: "Ficha", header: "Situação da ficha", width: 22, value: (r) => EMPLOYEE_FICHA_STATUS_LABEL[r.row.status] },
  {
    group: "Ficha",
    header: "Preenchimento",
    width: 14,
    value: (r) => `${r.row.filledCount} de ${r.row.requiredCount}`,
  },
  {
    group: "Ficha",
    header: "O que falta",
    width: 44,
    wrap: true,
    value: (r) => r.row.missingFields.map((field) => REGISTRATION_FIELD_LABEL[field]).join(", "),
  },
  { group: "Ficha", header: "Origem", width: 13, value: (r) => (r.row.formOrigin ? REGISTRATION_ORIGIN_LABEL[r.row.formOrigin] : "") },
  { group: "Ficha", header: "Enviada em", width: 12, value: (r) => formatDateBR(r.row.submittedAt) },
  { group: "Ficha", header: "Aprovada em", width: 12, value: (r) => formatDateBR(r.row.approvedAt) },
  // Dados pessoais
  { group: "Dados pessoais", header: "Nome completo", width: 32, value: answer("fullName") },
  { group: "Dados pessoais", header: "Nascimento", width: 12, value: (r) => formatDateBR(r.answers.birthDate) },
  { group: "Dados pessoais", header: "Idade", width: 7, value: (r) => (r.row.age === null ? "" : String(r.row.age)) },
  { group: "Dados pessoais", header: "Gênero", width: 14, value: (r) => optionLabel(GENDER_OPTIONS, r.answers.gender) },
  { group: "Dados pessoais", header: "Nome da mãe ou do pai", width: 30, value: answer("parentName") },
  { group: "Dados pessoais", header: "RG", width: 15, value: answer("rg") },
  { group: "Dados pessoais", header: "Órgão emissor", width: 13, value: answer("rgIssuer") },
  { group: "Dados pessoais", header: "CPF", width: 15, value: answer("cpf") },
  // Complementares
  { group: "Complementares", header: "Nacionalidade", width: 14, value: answer("nationality") },
  { group: "Complementares", header: "Naturalidade", width: 22, value: answer("birthplace") },
  { group: "Complementares", header: "Raça/cor", width: 13, value: (r) => optionLabel(RACE_COLOR_OPTIONS, r.answers.raceColor) },
  { group: "Complementares", header: "PIS", width: 16, value: answer("pis") },
  { group: "Complementares", header: "CTPS", width: 16, value: answer("ctpsNumber") },
  { group: "Complementares", header: "Título de eleitor", width: 17, value: answer("voterTitle") },
  { group: "Complementares", header: "Instituição de ensino", width: 26, value: answer("institution") },
  { group: "Complementares", header: "Período", width: 16, value: answer("coursePeriod") },
  { group: "Complementares", header: "RA", width: 14, value: answer("studentRa") },
  { group: "Complementares", header: "Tem OAB", width: 10, value: hasOabText },
  { group: "Complementares", header: "Nº OAB", width: 12, value: answer("oabNumber") },
  { group: "Complementares", header: "UF OAB", width: 9, value: answer("oabUf") },
  // Contato
  { group: "Contato", header: "Telefone", width: 17, value: answer("personalPhone") },
  { group: "Contato", header: "E-mail pessoal", width: 30, value: answer("personalEmail") },
  { group: "Contato", header: "Telefone de emergência", width: 19, value: answer("emergencyPhone") },
  { group: "Contato", header: "Contato de emergência", width: 26, value: answer("emergencyContactName") },
  // Saúde e alimentação
  {
    group: "Saúde e alimentação",
    header: "Tipo sanguíneo",
    width: 13,
    value: (r) => optionLabel(BLOOD_TYPE_OPTIONS, r.answers.bloodType),
  },
  { group: "Saúde e alimentação", header: "Restrição alimentar", width: 26, wrap: true, value: (r) => dietaryText(r.answers) },
  { group: "Saúde e alimentação", header: "Detalhe da restrição", width: 26, wrap: true, value: answer("dietaryNotes") },
  // Dados bancários
  { group: "Dados bancários", header: "Banco", width: 26, value: answer("bankName") },
  { group: "Dados bancários", header: "Agência", width: 10, value: answer("bankAgency") },
  { group: "Dados bancários", header: "Conta", width: 14, value: answer("bankAccount") },
  { group: "Dados bancários", header: "Chave Pix", width: 26, value: answer("pixKey") },
  { group: "Dados bancários", header: "Banco particular", width: 24, value: (r) => r.personalBank?.bankName ?? "" },
  { group: "Dados bancários", header: "Agência particular", width: 12, value: (r) => r.personalBank?.bankAgency ?? "" },
  { group: "Dados bancários", header: "Conta particular", width: 16, value: (r) => r.personalBank?.bankAccount ?? "" },
  // Endereço
  { group: "Endereço", header: "CEP", width: 11, value: answer("cep") },
  { group: "Endereço", header: "Rua", width: 32, value: answer("street") },
  { group: "Endereço", header: "Número", width: 9, value: answer("number") },
  { group: "Endereço", header: "Complemento", width: 16, value: answer("complement") },
  { group: "Endereço", header: "Bairro", width: 20, value: answer("district") },
  { group: "Endereço", header: "Cidade", width: 22, value: answer("city") },
  { group: "Endereço", header: "UF", width: 6, value: answer("state") },
];

/** Grupos consecutivos da linha de cima (para mesclar as células). */
export function exportColumnGroups(columns: ExportColumn[] = EXPORT_COLUMNS): { group: string; from: number; to: number }[] {
  const groups: { group: string; from: number; to: number }[] = [];
  columns.forEach((column, index) => {
    const last = groups[groups.length - 1];
    if (last && last.group === column.group) last.to = index;
    else groups.push({ group: column.group, from: index, to: index });
  });
  return groups;
}

export function exportRows(records: ExportRecord[], columns: ExportColumn[] = EXPORT_COLUMNS): string[][] {
  return records.map((record) => columns.map((column) => column.value(record)));
}

export function exportFilename(now: Date = new Date()): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  return `fichas-cadastrais-${date}.xlsx`;
}
