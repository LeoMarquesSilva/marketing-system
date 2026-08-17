export type TreatmentGender = "f" | "m";
export type QualificationStatus = "pendente" | "completo";

export interface HrQualification {
  id: string;
  user_id: string;
  full_name: string | null;
  birth_date: string | null;
  nationality: string | null;
  marital_status: string | null;
  profession: string | null;
  treatment_gender: TreatmentGender | null;
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
  status: QualificationStatus;
  completed_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualificationListItem {
  user_id: string;
  user_name: string;
  user_email: string | null;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
  qualification_required_at: string | null;
  qualification_completed_at: string | null;
  qualification: HrQualification | null;
}

export const QUALIFICATION_SELECT =
  "id, user_id, full_name, birth_date, nationality, marital_status, profession, treatment_gender, cpf, rg, rg_issuer, oab_number, oab_uf, cep, street, number, complement, district, city, state, personal_phone, personal_email, status, completed_at, updated_by, created_at, updated_at";

export const MARITAL_STATUS_OPTIONS = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
  { value: "uniao_estavel", label: "União estável" },
] as const;

/** Valores fechados para evitar grafias diferentes no texto jurídico. */
export const NATIONALITY_OPTIONS = [
  { value: "brasileira", label: "Brasil", feminine: "brasileira", masculine: "brasileiro" },
  { value: "portuguesa", label: "Portugal", feminine: "portuguesa", masculine: "português" },
  { value: "argentina", label: "Argentina", feminine: "argentina", masculine: "argentino" },
  { value: "italiana", label: "Itália", feminine: "italiana", masculine: "italiano" },
  { value: "espanhola", label: "Espanha", feminine: "espanhola", masculine: "espanhol" },
  { value: "americana", label: "Estados Unidos", feminine: "americana", masculine: "americano" },
  { value: "francesa", label: "França", feminine: "francesa", masculine: "francês" },
  { value: "alemã", label: "Alemanha", feminine: "alemã", masculine: "alemão" },
  { value: "chilena", label: "Chile", feminine: "chilena", masculine: "chileno" },
  { value: "colombiana", label: "Colômbia", feminine: "colombiana", masculine: "colombiano" },
  { value: "peruana", label: "Peru", feminine: "peruana", masculine: "peruano" },
  { value: "uruguaia", label: "Uruguai", feminine: "uruguaia", masculine: "uruguaio" },
  { value: "paraguaia", label: "Paraguai", feminine: "paraguaia", masculine: "paraguaio" },
  { value: "venezuelana", label: "Venezuela", feminine: "venezuelana", masculine: "venezuelano" },
] as const;

export const BRAZIL_UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
