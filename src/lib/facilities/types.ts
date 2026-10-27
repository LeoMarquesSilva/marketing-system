/** Facilities > Fornecedores e contratos: tipos compartilhados entre servidor e telas. */

export const FACILITIES_SUPPLIERS_PATH = "/facilities/fornecedores";
export const FACILITIES_CONTRACTS_PATH = "/facilities/contratos";

/** Bucket privado: upload e download só por URL assinada gerada no servidor. */
export const FACILITIES_BUCKET = "FACILITIES-CONTRATOS";
export const FACILITIES_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const FACILITIES_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

/** Tipo do arquivo pela extensão (o navegador às vezes manda vazio). */
export function facilitiesFileType(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return FACILITIES_FILE_TYPES[ext] ?? null;
}

/** Áreas atendidas / centro de custo (mesmos nomes do resto do sistema + Administrativo e Sócio). */
export const SUPPLIER_AREAS = [
  "Administrativo",
  "Cível",
  "Trabalhista",
  "Tributário",
  "Reestruturação",
  "Operações Legais",
  "Societário e Contratos",
  "Recuperação de Crédito",
  "ADD",
  "Marketing",
  "Comercial",
  "Sócio",
] as const;

export const CONTRACTING_PARTIES = ["Bismarchi | Pires", "Costa Loureiro"] as const;

export const PERIODICITIES = ["mensal", "bimestral", "trimestral", "semestral", "anual", "semanal", "eventual"] as const;
export type Periodicity = (typeof PERIODICITIES)[number];
export const PERIODICITY_LABEL: Record<Periodicity, string> = {
  mensal: "Mensal",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  semanal: "Semanal",
  eventual: "Eventual",
};

export const PAYMENT_METHODS = ["boleto", "pix", "transferencia", "debito_automatico", "cartao", "guia"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  boleto: "Boleto",
  pix: "Pix",
  transferencia: "Transferência",
  debito_automatico: "Débito automático",
  cartao: "Cartão",
  guia: "Guia",
};

export const FISCAL_DOCUMENTS = ["nota_fiscal", "recibo", "fatura"] as const;
export type FiscalDocument = (typeof FISCAL_DOCUMENTS)[number];
export const FISCAL_DOCUMENT_LABEL: Record<FiscalDocument, string> = {
  nota_fiscal: "Nota fiscal",
  recibo: "Recibo",
  fatura: "Fatura",
};

export const CONTRACT_STATUSES = ["em_negociacao", "vigente", "encerrado"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  em_negociacao: "Em negociação",
  vigente: "Vigente",
  encerrado: "Encerrado",
};

export const FORMALIZATIONS = ["contrato_assinado", "proposta_aceita", "aceite_por_email", "termo_de_adesao"] as const;
export type Formalization = (typeof FORMALIZATIONS)[number];
export const FORMALIZATION_LABEL: Record<Formalization, string> = {
  contrato_assinado: "Contrato assinado",
  proposta_aceita: "Proposta aceita (sem assinatura)",
  aceite_por_email: "Aceite por e-mail",
  termo_de_adesao: "Termo de adesão on-line",
};

export const ADJUSTMENT_INDEXES = ["ipca", "igpm", "inpc", "ivar", "fixo", "outro"] as const;
export type AdjustmentIndex = (typeof ADJUSTMENT_INDEXES)[number];
export const ADJUSTMENT_INDEX_LABEL: Record<AdjustmentIndex, string> = {
  ipca: "IPCA",
  igpm: "IGP-M",
  inpc: "INPC",
  ivar: "IVAR",
  fixo: "Percentual fixo",
  outro: "Outro",
};

export const VALUE_PERIODS = ["mensal", "anual", "total"] as const;
export type ValuePeriod = (typeof VALUE_PERIODS)[number];
export const VALUE_PERIOD_LABEL: Record<ValuePeriod, string> = {
  mensal: "por mês",
  anual: "por ano",
  total: "no total",
};

export const DOCUMENT_KINDS = [
  "contrato",
  "aditivo",
  "proposta",
  "distrato",
  "cartao_cnpj",
  "certidao",
  "alvara",
  "seguro",
  "outro",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  contrato: "Contrato",
  aditivo: "Aditivo",
  proposta: "Proposta",
  distrato: "Distrato",
  cartao_cnpj: "Cartão CNPJ",
  certidao: "Certidão",
  alvara: "Alvará",
  seguro: "Apólice de seguro",
  outro: "Outro",
};
/** Documentos que costumam ter validade e viram alerta. */
export const EXPIRING_DOCUMENT_KINDS: DocumentKind[] = ["certidao", "alvara", "seguro"];

export const MONTH_LABELS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export interface FacilitiesPerson {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface SupplierService {
  id: string;
  supplier_id: string;
  description: string;
  area: string | null;
  shared_cost: boolean;
  payer: string | null;
  periodicity: Periodicity;
  due_day: number | null;
  amount: number | null;
  payment_method: PaymentMethod | null;
  payment_details: string | null;
  fiscal_document: FiscalDocument | null;
  notes: string | null;
  active: boolean;
}

export interface SupplierDocument {
  id: string;
  supplier_id: string;
  contract_id: string | null;
  kind: DocumentKind;
  title: string | null;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  /** Arquivo no bucket do sistema (abre por URL assinada). */
  has_file: boolean;
  external_url: string | null;
  valid_until: string | null;
  created_at: string;
}

export interface SupplierContract {
  id: string;
  supplier_id: string;
  title: string;
  object: string | null;
  status: ContractStatus;
  formalization: Formalization;
  contracting_party: string | null;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean;
  renewal_months: number | null;
  notice_days: number | null;
  adjustment_index: AdjustmentIndex | null;
  adjustment_month: number | null;
  value: number | null;
  value_period: ValuePeriod;
  responsible_user_id: string | null;
  sharepoint_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FacilitiesSupplier {
  id: string;
  name: string;
  legal_name: string | null;
  document: string | null;
  person_type: "pj" | "pf" | null;
  category: string;
  areas: string[];
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website_link: string | null;
  whatsapp_link: string | null;
  city: string | null;
  rating: number | null;
  notes: string | null;
  active: boolean;
  responsible_user_id: string | null;
  source: "sistema" | "planilha";
  created_at: string;
  updated_at: string;
  services: SupplierService[];
  contracts: SupplierContract[];
  documents: SupplierDocument[];
  /** Quantos eventos usaram este fornecedor (Gestão de eventos). */
  events_count: number;
}

export interface SupplierInput {
  name: string;
  legal_name: string;
  document: string;
  category: string;
  areas: string[];
  contact_name: string;
  phone: string;
  email: string;
  website_link: string;
  whatsapp_link: string;
  city: string;
  rating: number | null;
  notes: string;
  active: boolean;
  responsible_user_id: string | null;
}

export interface ServiceInput {
  description: string;
  area: string;
  shared_cost: boolean;
  payer: string;
  periodicity: Periodicity;
  due_day: number | null;
  amount: number | null;
  payment_method: PaymentMethod | "";
  payment_details: string;
  fiscal_document: FiscalDocument | "";
  notes: string;
  active: boolean;
}

export interface ContractInput {
  title: string;
  object: string;
  status: ContractStatus;
  formalization: Formalization;
  contracting_party: string;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  renewal_months: number | null;
  notice_days: number | null;
  adjustment_index: AdjustmentIndex | "";
  adjustment_month: number | null;
  value: number | null;
  value_period: ValuePeriod;
  responsible_user_id: string | null;
  sharepoint_url: string;
  notes: string;
}

/** O que a IA conseguiu ler do PDF do contrato (campos vazios = não encontrado). */
export interface ContractExtraction {
  title: string | null;
  object: string | null;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean | null;
  renewal_months: number | null;
  notice_days: number | null;
  adjustment_index: AdjustmentIndex | null;
  adjustment_month: number | null;
  value: number | null;
  value_period: ValuePeriod | null;
  contracting_party: string | null;
  supplier_document: string | null;
  summary: string | null;
}
