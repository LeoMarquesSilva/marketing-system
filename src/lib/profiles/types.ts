/**
 * Contratos do domínio de perfis profissionais (Perfis NFC).
 *
 * `users` continua sendo a identidade canônica: este domínio é 1:1 com ela e
 * nunca duplica papel, permissão ou situação de atividade do colaborador.
 *
 * O tipo público (`PublicProfessionalProfile`) só existe com campos já
 * liberados pelo administrador — contato privado nunca chega nele.
 */

export type ProfileLocale = "pt-BR" | "en";

export type ProfessionalProfileStatus = "draft" | "published" | "archived";

export type ProfileSectionKey =
  | "practice"
  | "education"
  | "knowledge"
  | "highlights"
  | "timeline";

export type ProfileCardStatus = "pending" | "active" | "replaced" | "inactive";

export type ProfileEventType =
  | "profile_view"
  | "nfc_scan"
  | "qr_scan"
  | "contact_download"
  | "share"
  | "whatsapp_click"
  | "email_click"
  | "linkedin_click"
  | "website_click";

export type ProfileEventSource = "direct" | "nfc" | "qr" | "share";

export type ProfileContentSourceType = "instagram" | "linkedin" | "reel_studio";

export const PROFILE_LOCALES: readonly ProfileLocale[] = ["pt-BR", "en"] as const;

export const PROFILE_SECTION_KEYS: readonly ProfileSectionKey[] = [
  "practice",
  "education",
  "knowledge",
  "highlights",
  "timeline",
] as const;

export const PROFILE_EVENT_TYPES: readonly ProfileEventType[] = [
  "profile_view",
  "nfc_scan",
  "qr_scan",
  "contact_download",
  "share",
  "whatsapp_click",
  "email_click",
  "linkedin_click",
  "website_click",
] as const;

export const PROFILE_EVENT_SOURCES: readonly ProfileEventSource[] = [
  "direct",
  "nfc",
  "qr",
  "share",
] as const;

/** Rótulos das seções na administração (a página pública usa o texto do idioma). */
export const PROFILE_SECTION_LABELS: Record<ProfileSectionKey, string> = {
  practice: "Áreas de atuação",
  education: "Formação acadêmica",
  knowledge: "Especialidades e conhecimentos",
  highlights: "Reconhecimentos e destaques",
  timeline: "Trajetória no Bismarchi | Pires",
};

// ---------------------------------------------------------------------------
// Localização
// ---------------------------------------------------------------------------

export interface ProfessionalProfileLocalization {
  locale: ProfileLocale;
  isApproved: boolean;
  displayName: string | null;
  role: string | null;
  practiceArea: string | null;
  tagline: string | null;
  bio: string | null;
}

// ---------------------------------------------------------------------------
// Campanha global
// ---------------------------------------------------------------------------

export interface ProfileCampaign {
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  titlePt: string;
  titleEn: string;
  messagePt: string;
  messageEn: string;
  callToActionPt: string | null;
  callToActionEn: string | null;
}

// ---------------------------------------------------------------------------
// Projeção pública
// ---------------------------------------------------------------------------

export interface PublicProfileEntry {
  id: string;
  entryType: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  occurredOn: string | null;
}

export interface PublicProfileSection {
  key: ProfileSectionKey;
  entries: PublicProfileEntry[];
}

export interface ProfileContentItem {
  sourceType: ProfileContentSourceType;
  sourceId: string;
  /** Chave estável usada por overrides: `${sourceType}:${sourceId}`. */
  key: string;
  title: string;
  imageUrl: string | null;
  url: string | null;
  publishedAt: string | null;
}

export interface PublicProfessionalProfile {
  id: string;
  slug: string;
  locale: ProfileLocale;
  identity: {
    name: string;
    role: string;
    practiceArea: string;
    oab: string | null;
    photoUrl: string | null;
    tagline: string;
    bio: string;
    joinedOn: string | null;
    tenureLabel: string | null;
  };
  contacts: {
    email: string | null;
    whatsapp: string | null;
    linkedinUrl: string | null;
    websiteUrl: string | null;
  };
  sections: PublicProfileSection[];
  recentContent: ProfileContentItem[];
  campaignMessage: string | null;
  campaignTitle: string | null;
}

// ---------------------------------------------------------------------------
// Administração
// ---------------------------------------------------------------------------

export interface ProfessionalProfileListItem {
  id: string;
  userId: string;
  slug: string;
  status: ProfessionalProfileStatus;
  photoUrl: string | null;
  displayName: string | null;
  role: string | null;
  practiceArea: string | null;
  /** 0..100 — quanto do perfil está preenchido para publicação. */
  completeness: number;
  hasApprovedEnglish: boolean;
  cardCount: number;
  activeCardCount: number;
  viewCount: number;
  scanCount: number;
  updatedAt: string;
}

export interface ProfessionalProfileAdminEntry {
  id: string;
  entryType: string;
  linkUrl: string | null;
  imageUrl: string | null;
  occurredOn: string | null;
  metadata: Record<string, unknown>;
  sortOrder: number;
  isVisible: boolean;
  localizations: Array<{
    locale: ProfileLocale;
    title: string;
    subtitle: string | null;
    description: string | null;
  }>;
}

export interface ProfessionalProfileAdminSection {
  id: string;
  key: ProfileSectionKey;
  enabled: boolean;
  sortOrder: number;
  entries: ProfessionalProfileAdminEntry[];
}

export interface ProfessionalProfileCard {
  id: string;
  profileId: string;
  nfcTagId: string | null;
  code: string;
  label: string;
  status: ProfileCardStatus;
  replacedCardId: string | null;
  issuedAt: string | null;
  activatedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
}

/** Cartão enriquecido com dados da etiqueta NFC vinculada (painel admin). */
export interface ProfessionalProfileCardView extends ProfessionalProfileCard {
  nfcTagCode: string | null;
  nfcPublicToken: string | null;
}

export interface ProfessionalProfileAdminDetail {
  id: string;
  userId: string;
  userName: string | null;
  slug: string;
  status: ProfessionalProfileStatus;
  photoUrl: string | null;
  oab: string | null;
  joinedOn: string | null;
  professionalEmail: string | null;
  professionalPhone: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  showTenure: boolean;
  showEmail: boolean;
  showWhatsapp: boolean;
  showLinkedin: boolean;
  showWebsite: boolean;
  publishedAt: string | null;
  updatedAt: string;
  localizations: ProfessionalProfileLocalization[];
  sections: ProfessionalProfileAdminSection[];
  cards: ProfessionalProfileCardView[];
  hiddenContentKeys: string[];
}

export interface ProfessionalProfileListFilters {
  status?: ProfessionalProfileStatus | "all";
  search?: string;
  completeness?: "all" | "complete" | "incomplete";
  limit?: number;
  offset?: number;
}

export interface ProfessionalProfileListResult {
  items: ProfessionalProfileListItem[];
  total: number;
  summary: {
    total: number;
    draft: number;
    published: number;
    archived: number;
    incomplete: number;
    cardsPending: number;
    cardsActive: number;
    cardsReplaced: number;
    cardsInactive: number;
  };
}

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------

/**
 * Linha já normalizada da planilha de colaboradores.
 * Data de nascimento é deliberadamente ausente deste contrato.
 */
export interface ProfessionalProfileImportRow {
  email: string;
  name: string | null;
  role: string | null;
  area: string | null;
  phone: string | null;
  joinedOn: string | null;
  /** Só informativo no preview: a importação nunca altera atividade do usuário. */
  sourceIsActive: boolean;
}

export interface ImportUserCandidate {
  id: string;
  email: string | null;
  name: string | null;
}

export interface ImportExistingProfile {
  userId: string;
  slug: string;
  professionalEmail: string | null;
  professionalPhone: string | null;
  joinedOn: string | null;
  displayName: string | null;
  role: string | null;
  practiceArea: string | null;
}

export type ImportRowOutcome =
  | "create"
  | "update"
  | "unchanged"
  | "unmatched"
  | "inactiveSource"
  | "duplicate";

export interface ImportFieldDifference {
  field: string;
  label: string;
  current: string | null;
  incoming: string | null;
}

export interface ProfessionalProfileImportPreviewRow {
  email: string;
  name: string | null;
  role: string | null;
  area: string | null;
  outcome: ImportRowOutcome;
  userId: string | null;
  slug: string | null;
  sourceIsActive: boolean;
  differences: ImportFieldDifference[];
  /** Linhas inativas na planilha começam desmarcadas. */
  selectedByDefault: boolean;
}

export interface ProfessionalProfileImportPreview {
  rows: ProfessionalProfileImportPreviewRow[];
  counts: {
    total: number;
    create: number;
    update: number;
    unchanged: number;
    unmatched: number;
    inactiveSource: number;
    duplicate: number;
  };
  /**
   * Linhas cruas da planilha, usadas apenas no servidor para montar o payload
   * do apply (telefone e admissão). Nunca serializar na resposta HTTP: o
   * preview enviado ao navegador não deve carregar contato privado.
   */
  sourceRows: ProfessionalProfileImportRow[];
}

export interface ProfessionalProfileImportResult {
  created: number;
  updated: number;
  skipped: number;
  unmatched: number;
}

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

export interface ProfessionalProfileAnalytics {
  range: { from: string; to: string };
  totals: Record<ProfileEventType, number>;
  bySource: Record<ProfileEventSource, number>;
  daily: Array<{ date: string; views: number; scans: number }>;
  byCard: Array<{ cardId: string; code: string; label: string; scans: number }>;
}
