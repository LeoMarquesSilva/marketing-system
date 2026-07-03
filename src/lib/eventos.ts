/**
 * Módulo de Organização de Eventos — tipos, CRUD e integração com Planner
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase/client";

export type EventStatus = "nao_iniciada" | "em_andamento" | "concluida" | "cancelada";
export type EventTaskStatus = "pendente" | "em_andamento" | "concluida";
export type EventTaskPhase = "pre_evento" | "dia_evento" | "pos_evento";
export type BudgetPaymentStatus = "pendente" | "parcial" | "pago";
export type EventStageStatus =
  | "ideia_cadastrada"
  | "em_validacao"
  | "aprovado"
  | "orcando"
  | "em_producao"
  | "em_comunicacao"
  | "pronto_para_execucao"
  | "realizado"
  | "pos_evento"
  | "arquivado";
export type RiskLevel = "baixo" | "medio" | "alto";
export type EventPriority = "baixa" | "normal" | "alta" | "urgente";
export type EventCommunicationChannel =
  | "feedz"
  | "whatsapp"
  | "email"
  | "linkedin"
  | "instagram"
  | "convite_impresso"
  | "outro";
export type EventCommunicationStatus = "planejada" | "em_producao" | "publicada" | "cancelada";
export type GuestType = "colaborador" | "cliente" | "prospect" | "parceiro" | "convidado_externo";
export type InviteStatus = "nao_enviado" | "enviado" | "erro_envio";
export type ConfirmationStatus = "sem_resposta" | "confirmado" | "recusado";
export type ProposalStatus = "pendente" | "aprovada" | "descartada";

export interface OrgEvent {
  id: string;
  year: number;
  name: string;
  monthLabel: string | null;
  commemorativeDate: string | null;
  eventDate: string | null;
  giftsNotes: string | null;
  organizationTeam: string | null;
  status: EventStatus;
  objectives: string | null;
  budgetPlanned: number | null;
  notes: string | null;
  eventType: string | null;
  eventSize: string | null;
  targetAudience: string | null;
  priority: EventPriority;
  requestingArea: string | null;
  ownerUserId: string | null;
  location: string | null;
  participantsExpected: number | null;
  participantsActual: number | null;
  stageStatus: EventStageStatus;
  riskLevel: RiskLevel;
  createdAt: string;
  updatedAt: string;
}

export interface EventTask {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  assigneeName?: string | null;
  assigneeAvatar?: string | null;
  dueDate: string | null;
  status: EventTaskStatus;
  phase: EventTaskPhase | null;
  sortOrder: number;
  marketingRequestId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventBudgetItem {
  id: string;
  eventId: string;
  category: string;
  description: string | null;
  vendorName: string | null;
  amountPlanned: number;
  amountQuoted: number | null;
  amountActual: number | null;
  paymentStatus: BudgetPaymentStatus;
  dueDate: string | null;
  paymentDueDate: string | null;
  paymentPaidDate: string | null;
  invoiceLink: string | null;
  receiptLink: string | null;
  approvedByUserId: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface EventSupplier {
  id: string;
  name: string;
  category: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  rating: number | null;
  notes: string | null;
  active: boolean;
  websiteLink: string | null;
  instagramLink: string | null;
  portfolioLink: string | null;
  whatsappLink: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventSupplierWithStats extends EventSupplier {
  eventsCount: number;
  approvedQuotesCount: number;
  totalApprovedValue: number;
  lastUsedAt: string | null;
}

export interface EventSupplierQuote {
  id: string;
  eventId: string;
  supplierId: string | null;
  supplierName?: string | null;
  category: string;
  quotedValue: number | null;
  finalValue: number | null;
  includedItems: string | null;
  proposalStatus: ProposalStatus;
  attachedFileLink: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventInvite {
  id: string;
  eventId: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  guestType: GuestType;
  inviteStatus: InviteStatus;
  confirmationStatus: ConfirmationStatus;
  attended: boolean | null;
  dietaryRestrictions: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventCommunication {
  id: string;
  eventId: string;
  channel: EventCommunicationChannel;
  title: string;
  content: string | null;
  responsibleUserId: string | null;
  responsibleUserName?: string | null;
  plannedDate: string | null;
  publishedDate: string | null;
  status: EventCommunicationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EventAttachment {
  id: string;
  eventId: string;
  relatedEntity: string | null;
  relatedId: string | null;
  fileType: string;
  title: string;
  url: string;
  storagePath: string | null;
  provider: string;
  uploadedByUserId: string | null;
  createdAt: string;
}

export interface EventPostmortem {
  id: string;
  eventId: string;
  whatWorked: string | null;
  whatFailed: string | null;
  improvements: string | null;
  overallRating: number | null;
  nps: number | null;
  participantsExpected: number | null;
  participantsActual: number | null;
  costPerParticipant: number | null;
  reuseSupplierNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventHistoryItem {
  id: string;
  eventId: string;
  actionType: string;
  actionLabel: string;
  payload: Record<string, unknown> | null;
  actorUserId: string | null;
  actorUserName?: string | null;
  createdAt: string;
}

export interface EventTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EventTemplateTask {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  offsetDays: number;
  phase: EventTaskPhase | null;
  sortOrder: number;
  createdAt: string;
}

export interface EventAlertSummary {
  noApprovedSupplier: boolean;
  noBudget: boolean;
  budgetExceeded: boolean;
  overdueTasks: boolean;
  pendingPayments: boolean;
  missingPostEvent: boolean;
}

export interface EventWithStats extends OrgEvent {
  tasksTotal: number;
  tasksCompleted: number;
  tasksOverdue: number;
  budgetPlannedTotal: number;
  budgetActualTotal: number;
  alerts: EventAlertSummary;
}

export interface EventsOverview {
  totalEvents: number;
  inProgress: number;
  completed: number;
  budgetPlannedTotal: number;
  budgetActualTotal: number;
  overdueTasks: number;
  noApprovedSupplier: number;
  noBudget: number;
  budgetExceeded: number;
  pendingPayments: number;
  missingPostEvent: number;
}

export interface EventToPlannerFormData {
  title: string;
  request_type: string;
  solicitante_id: string | null;
  solicitante: string | null;
  requesting_area: string;
  description: string;
  link?: string | null;
  referencias?: string | null;
  assignee_id: string | null;
  priority: string;
  deadline: string | null;
  deadline_time: string | null;
}

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const EVENT_STATUS_STYLE: Record<EventStatus, string> = {
  nao_iniciada: "bg-slate-100 text-slate-700 border-slate-200",
  em_andamento: "bg-amber-100 text-amber-800 border-amber-200",
  concluida: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelada: "bg-red-100 text-red-800 border-red-200",
};

export const EVENT_STAGE_LABEL: Record<EventStageStatus, string> = {
  ideia_cadastrada: "Ideia cadastrada",
  em_validacao: "Em validação",
  aprovado: "Aprovado",
  orcando: "Orçando",
  em_producao: "Em produção",
  em_comunicacao: "Em comunicação",
  pronto_para_execucao: "Pronto para execução",
  realizado: "Realizado",
  pos_evento: "Pós-evento",
  arquivado: "Arquivado",
};

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};

export const EVENT_TASK_STATUS_LABEL: Record<EventTaskStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

export const BUDGET_CATEGORIES = [
  "brindes",
  "catering",
  "decoracao",
  "fornecedor",
  "locacao",
  "outros",
] as const;

export const EVENT_TYPE_OPTIONS = [
  "Interno",
  "Externo",
  "Institucional",
  "Comemorativo",
  "Confraternização",
  "Treinamento / Capacitação",
  "Outro",
] as const;

export const EVENT_SIZE_OPTIONS = [
  "Pequeno (até 20 pessoas)",
  "Médio (21 a 80 pessoas)",
  "Grande (81 a 200 pessoas)",
  "Muito grande (200+ pessoas)",
] as const;

export const FILE_TYPE_OPTIONS = [
  "arquivo_geral",
  "contrato",
  "briefing",
  "orcamento_fornecedor",
  "proposta",
  "foto",
  "video",
  "apresentacao",
  "outro",
] as const;

export const FILE_TYPE_LABEL: Record<(typeof FILE_TYPE_OPTIONS)[number], string> = {
  arquivo_geral: "Arquivo geral",
  contrato: "Contrato",
  briefing: "Briefing",
  orcamento_fornecedor: "Orçamento de fornecedor",
  proposta: "Proposta",
  foto: "Foto",
  video: "Vídeo",
  apresentacao: "Apresentação",
  outro: "Outro",
};

export const SUPPLIER_CATEGORIES = [
  "brindes",
  "catering",
  "buffet",
  "decoracao",
  "fotografia",
  "som_iluminacao",
  "transporte",
  "seguranca",
  "locacao",
  "outros",
] as const;

export const SUPPLIER_CATEGORY_LABEL: Record<(typeof SUPPLIER_CATEGORIES)[number], string> = {
  brindes: "Brindes",
  catering: "Catering",
  buffet: "Buffet",
  decoracao: "Decoração",
  fotografia: "Fotografia",
  som_iluminacao: "Som e iluminação",
  transporte: "Transporte",
  seguranca: "Segurança",
  locacao: "Locação",
  outros: "Outros",
};

export const BUDGET_PAYMENT_LABEL: Record<BudgetPaymentStatus, string> = {
  pendente: "Pendente",
  parcial: "Parcial",
  pago: "Pago",
};

export const COMMUNICATION_CHANNEL_LABEL: Record<EventCommunicationChannel, string> = {
  feedz: "Feedz",
  whatsapp: "WhatsApp",
  email: "E-mail",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  convite_impresso: "Convite impresso",
  outro: "Outro",
};

export const GUEST_TYPE_LABEL: Record<GuestType, string> = {
  colaborador: "Colaborador",
  cliente: "Cliente",
  prospect: "Prospect",
  parceiro: "Parceiro",
  convidado_externo: "Convidado externo",
};

type EventRow = {
  id: string;
  year: number;
  name: string;
  month_label: string | null;
  commemorative_date: string | null;
  event_date: string | null;
  gifts_notes: string | null;
  organization_team: string | null;
  status: string;
  objectives: string | null;
  budget_planned: number | null;
  notes: string | null;
  event_type: string | null;
  event_size: string | null;
  target_audience: string | null;
  priority: string | null;
  requesting_area: string | null;
  owner_user_id: string | null;
  location: string | null;
  participants_expected: number | null;
  participants_actual: number | null;
  stage_status: string | null;
  risk_level: string | null;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
  status: string;
  phase: string | null;
  sort_order: number;
  marketing_request_id: string | null;
  created_at: string;
  updated_at: string;
  users?: { name: string; avatar_url: string | null } | null;
};

type BudgetRow = {
  id: string;
  event_id: string;
  category: string;
  description: string | null;
  vendor_name: string | null;
  amount_planned: number;
  amount_quoted: number | null;
  amount_actual: number | null;
  payment_status: string;
  due_date: string | null;
  payment_due_date: string | null;
  payment_paid_date: string | null;
  invoice_link: string | null;
  receipt_link: string | null;
  approved_by_user_id: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
};

type SupplierRow = {
  id: string;
  name: string;
  category: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  rating: number | null;
  notes: string | null;
  active: boolean;
  website_link: string | null;
  instagram_link: string | null;
  portfolio_link: string | null;
  whatsapp_link: string | null;
  created_at: string;
  updated_at: string;
};

type SupplierQuoteRow = {
  id: string;
  event_id: string;
  supplier_id: string | null;
  category: string;
  quoted_value: number | null;
  final_value: number | null;
  included_items: string | null;
  proposal_status: string;
  attached_file_link: string | null;
  decision_reason: string | null;
  created_at: string;
  updated_at: string;
  event_suppliers?: { name: string } | { name: string }[] | null;
};

type InviteRow = {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  guest_type: string;
  invite_status: string;
  confirmation_status: string;
  attended: boolean | null;
  dietary_restrictions: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CommunicationRow = {
  id: string;
  event_id: string;
  channel: string;
  title: string;
  content: string | null;
  responsible_user_id: string | null;
  planned_date: string | null;
  published_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  users?: { name: string } | { name: string }[] | null;
};

type AttachmentRow = {
  id: string;
  event_id: string;
  related_entity: string | null;
  related_id: string | null;
  file_type: string;
  title: string;
  url: string;
  storage_path: string | null;
  provider: string;
  uploaded_by_user_id: string | null;
  created_at: string;
};

type PostmortemRow = {
  id: string;
  event_id: string;
  what_worked: string | null;
  what_failed: string | null;
  improvements: string | null;
  overall_rating: number | null;
  nps: number | null;
  participants_expected: number | null;
  participants_actual: number | null;
  cost_per_participant: number | null;
  reuse_supplier_notes: string | null;
  created_at: string;
  updated_at: string;
};

type EventHistoryRow = {
  id: string;
  event_id: string;
  action_type: string;
  action_label: string;
  payload: Record<string, unknown> | null;
  actor_user_id: string | null;
  created_at: string;
  users?: { name: string } | { name: string }[] | null;
};

type EventTemplateRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type EventTemplateTaskRow = {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  offset_days: number;
  phase: string | null;
  sort_order: number;
  created_at: string;
};

function rowToEvent(row: EventRow): OrgEvent {
  return {
    id: row.id,
    year: row.year,
    name: row.name,
    monthLabel: row.month_label,
    commemorativeDate: row.commemorative_date,
    eventDate: row.event_date,
    giftsNotes: row.gifts_notes,
    organizationTeam: row.organization_team,
    status: row.status as EventStatus,
    objectives: row.objectives,
    budgetPlanned: row.budget_planned != null ? Number(row.budget_planned) : null,
    notes: row.notes,
    eventType: row.event_type,
    eventSize: row.event_size,
    targetAudience: row.target_audience,
    priority: (row.priority as EventPriority) ?? "normal",
    requestingArea: row.requesting_area,
    ownerUserId: row.owner_user_id,
    location: row.location,
    participantsExpected: row.participants_expected,
    participantsActual: row.participants_actual,
    stageStatus: (row.stage_status as EventStageStatus) ?? "ideia_cadastrada",
    riskLevel: (row.risk_level as RiskLevel) ?? "baixo",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToTask(row: TaskRow & { users?: TaskRow["users"] | TaskRow["users"][] | null }): EventTask {
  const userRaw = row.users;
  const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    description: row.description,
    assigneeId: row.assignee_id,
    assigneeName: user?.name ?? null,
    assigneeAvatar: user?.avatar_url ?? null,
    dueDate: row.due_date,
    status: row.status as EventTaskStatus,
    phase: (row.phase as EventTaskPhase) ?? null,
    sortOrder: row.sort_order,
    marketingRequestId: row.marketing_request_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToBudget(row: BudgetRow): EventBudgetItem {
  return {
    id: row.id,
    eventId: row.event_id,
    category: row.category,
    description: row.description,
    vendorName: row.vendor_name,
    amountPlanned: Number(row.amount_planned),
    amountQuoted: row.amount_quoted != null ? Number(row.amount_quoted) : null,
    amountActual: row.amount_actual != null ? Number(row.amount_actual) : null,
    paymentStatus: row.payment_status as BudgetPaymentStatus,
    dueDate: row.due_date,
    paymentDueDate: row.payment_due_date,
    paymentPaidDate: row.payment_paid_date,
    invoiceLink: row.invoice_link,
    receiptLink: row.receipt_link,
    approvedByUserId: row.approved_by_user_id,
    notes: row.notes,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function rowToSupplier(row: SupplierRow): EventSupplier {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    rating: row.rating != null ? Number(row.rating) : null,
    notes: row.notes,
    active: row.active,
    websiteLink: row.website_link,
    instagramLink: row.instagram_link,
    portfolioLink: row.portfolio_link,
    whatsappLink: row.whatsapp_link,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToQuote(row: SupplierQuoteRow): EventSupplierQuote {
  const supplierRaw = row.event_suppliers;
  const supplier = Array.isArray(supplierRaw) ? supplierRaw[0] : supplierRaw;
  return {
    id: row.id,
    eventId: row.event_id,
    supplierId: row.supplier_id,
    supplierName: supplier?.name ?? null,
    category: row.category,
    quotedValue: row.quoted_value != null ? Number(row.quoted_value) : null,
    finalValue: row.final_value != null ? Number(row.final_value) : null,
    includedItems: row.included_items,
    proposalStatus: row.proposal_status as ProposalStatus,
    attachedFileLink: row.attached_file_link,
    decisionReason: row.decision_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToInvite(row: InviteRow): EventInvite {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    guestType: row.guest_type as GuestType,
    inviteStatus: row.invite_status as InviteStatus,
    confirmationStatus: row.confirmation_status as ConfirmationStatus,
    attended: row.attended,
    dietaryRestrictions: row.dietary_restrictions,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToCommunication(row: CommunicationRow): EventCommunication {
  const userRaw = row.users;
  const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  return {
    id: row.id,
    eventId: row.event_id,
    channel: row.channel as EventCommunicationChannel,
    title: row.title,
    content: row.content,
    responsibleUserId: row.responsible_user_id,
    responsibleUserName: user?.name ?? null,
    plannedDate: row.planned_date,
    publishedDate: row.published_date,
    status: row.status as EventCommunicationStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAttachment(row: AttachmentRow): EventAttachment {
  return {
    id: row.id,
    eventId: row.event_id,
    relatedEntity: row.related_entity,
    relatedId: row.related_id,
    fileType: row.file_type,
    title: row.title,
    url: row.url,
    storagePath: row.storage_path,
    provider: row.provider,
    uploadedByUserId: row.uploaded_by_user_id,
    createdAt: row.created_at,
  };
}

function rowToPostmortem(row: PostmortemRow): EventPostmortem {
  return {
    id: row.id,
    eventId: row.event_id,
    whatWorked: row.what_worked,
    whatFailed: row.what_failed,
    improvements: row.improvements,
    overallRating: row.overall_rating,
    nps: row.nps,
    participantsExpected: row.participants_expected,
    participantsActual: row.participants_actual,
    costPerParticipant: row.cost_per_participant != null ? Number(row.cost_per_participant) : null,
    reuseSupplierNotes: row.reuse_supplier_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToHistory(row: EventHistoryRow): EventHistoryItem {
  const userRaw = row.users;
  const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  return {
    id: row.id,
    eventId: row.event_id,
    actionType: row.action_type,
    actionLabel: row.action_label,
    payload: row.payload,
    actorUserId: row.actor_user_id,
    actorUserName: user?.name ?? null,
    createdAt: row.created_at,
  };
}

function rowToTemplate(row: EventTemplateRow): EventTemplate {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToTemplateTask(row: EventTemplateTaskRow): EventTemplateTask {
  return {
    id: row.id,
    templateId: row.template_id,
    title: row.title,
    description: row.description,
    offsetDays: row.offset_days,
    phase: (row.phase as EventTaskPhase) ?? null,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export function getEventDisplayDate(event: OrgEvent): string | null {
  return event.eventDate ?? event.commemorativeDate;
}

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

function normalizeMonthText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Deriva o mês do evento priorizando o rótulo informado manualmente
 * (pode divergir da data exata em campanhas com datas de virada de mês),
 * caindo para a data exibida quando não houver rótulo reconhecível.
 */
export function getEventMonthIndex(event: OrgEvent): number | null {
  if (event.monthLabel) {
    const normalized = normalizeMonthText(event.monthLabel);
    const idx = MONTH_NAMES.findIndex((m) => normalizeMonthText(m) === normalized);
    if (idx >= 0) return idx;
  }
  const displayDate = getEventDisplayDate(event);
  if (displayDate) {
    const month = Number(displayDate.slice(5, 7));
    if (month >= 1 && month <= 12) return month - 1;
  }
  return null;
}

export function isTaskOverdue(task: EventTask): boolean {
  if (task.status === "concluida" || !task.dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return task.dueDate < today;
}

export function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const isoDate = iso.length > 10 ? iso.slice(0, 10) : iso;
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return "—";
  return `${day}/${month}/${year}`;
}

const TASK_SELECT = `
  id, event_id, title, description, assignee_id, due_date, status, phase,
  sort_order, marketing_request_id, created_at, updated_at,
  users:assignee_id (name, avatar_url)
`;

export async function fetchEventsByYear(
  year: number,
  client?: SupabaseClient
): Promise<OrgEvent[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from("events")
    .select("*")
    .eq("year", year)
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao buscar eventos:", error);
    return [];
  }
  return (data ?? []).map((r) => rowToEvent(r as EventRow));
}

export async function fetchEventById(
  id: string,
  client?: SupabaseClient
): Promise<OrgEvent | null> {
  const db = client ?? supabase;
  const { data, error } = await db.from("events").select("*").eq("id", id).single();
  if (error || !data) return null;
  return rowToEvent(data as EventRow);
}

export async function fetchEventsWithStats(
  year: number,
  client?: SupabaseClient
): Promise<EventWithStats[]> {
  const db = client ?? supabase;
  const events = await fetchEventsByYear(year, db);
  if (events.length === 0) return [];

  const ids = events.map((e) => e.id);
  const today = new Date().toISOString().slice(0, 10);

  const [tasksRes, budgetRes, quoteRes, postRes] = await Promise.all([
    db.from("event_tasks").select("event_id, status, due_date").in("event_id", ids),
    db
      .from("event_budget_items")
      .select("event_id, amount_planned, amount_actual, payment_status, payment_due_date")
      .in("event_id", ids),
    db.from("event_supplier_quotes").select("event_id, proposal_status").in("event_id", ids),
    db.from("event_postmortems").select("event_id").in("event_id", ids),
  ]);

  const tasksByEvent: Record<string, { total: number; completed: number; overdue: number }> = {};
  const budgetByEvent: Record<string, { planned: number; actual: number }> = {};
  const alertsByEvent: Record<string, EventAlertSummary> = {};

  for (const id of ids) {
    tasksByEvent[id] = { total: 0, completed: 0, overdue: 0 };
    budgetByEvent[id] = { planned: 0, actual: 0 };
    alertsByEvent[id] = {
      noApprovedSupplier: false,
      noBudget: false,
      budgetExceeded: false,
      overdueTasks: false,
      pendingPayments: false,
      missingPostEvent: false,
    };
  }

  for (const t of tasksRes.data ?? []) {
    const eid = t.event_id as string;
    if (!tasksByEvent[eid]) continue;
    tasksByEvent[eid].total++;
    if (t.status === "concluida") tasksByEvent[eid].completed++;
    else if (t.due_date && (t.due_date as string) < today) {
      tasksByEvent[eid].overdue++;
      alertsByEvent[eid].overdueTasks = true;
    }
  }

  for (const b of budgetRes.data ?? []) {
    const eid = b.event_id as string;
    if (!budgetByEvent[eid]) continue;
    budgetByEvent[eid].planned += Number(b.amount_planned ?? 0);
    budgetByEvent[eid].actual += Number(b.amount_actual ?? 0);
    if (b.payment_status === "pendente" && b.payment_due_date && (b.payment_due_date as string) <= today) {
      alertsByEvent[eid].pendingPayments = true;
    }
  }

  for (const q of quoteRes.data ?? []) {
    const eid = q.event_id as string;
    if (!alertsByEvent[eid]) continue;
    if (q.proposal_status === "aprovada") {
      alertsByEvent[eid].noApprovedSupplier = false;
    }
  }

  for (const id of ids) {
    const hasApproved = (quoteRes.data ?? []).some(
      (q) => q.event_id === id && q.proposal_status === "aprovada"
    );
    if (!hasApproved) alertsByEvent[id].noApprovedSupplier = true;
    if (budgetByEvent[id].planned <= 0) alertsByEvent[id].noBudget = true;
    if (budgetByEvent[id].actual > budgetByEvent[id].planned && budgetByEvent[id].planned > 0) {
      alertsByEvent[id].budgetExceeded = true;
    }
  }

  const postSet = new Set((postRes.data ?? []).map((p) => p.event_id as string));
  for (const event of events) {
    if (event.stageStatus === "realizado" && !postSet.has(event.id)) {
      alertsByEvent[event.id].missingPostEvent = true;
    }
  }

  return events.map((e) => ({
    ...e,
    tasksTotal: tasksByEvent[e.id]?.total ?? 0,
    tasksCompleted: tasksByEvent[e.id]?.completed ?? 0,
    tasksOverdue: tasksByEvent[e.id]?.overdue ?? 0,
    budgetPlannedTotal: budgetByEvent[e.id]?.planned ?? 0,
    budgetActualTotal: budgetByEvent[e.id]?.actual ?? 0,
    alerts: alertsByEvent[e.id],
  }));
}

export async function fetchEventsOverview(
  year: number,
  client?: SupabaseClient
): Promise<EventsOverview> {
  const withStats = await fetchEventsWithStats(year, client);
  return {
    totalEvents: withStats.length,
    inProgress: withStats.filter((e) => e.status === "em_andamento").length,
    completed: withStats.filter((e) => e.status === "concluida").length,
    budgetPlannedTotal: withStats.reduce((s, e) => s + e.budgetPlannedTotal, 0),
    budgetActualTotal: withStats.reduce((s, e) => s + e.budgetActualTotal, 0),
    overdueTasks: withStats.reduce((s, e) => s + e.tasksOverdue, 0),
    noApprovedSupplier: withStats.filter((e) => e.alerts.noApprovedSupplier).length,
    noBudget: withStats.filter((e) => e.alerts.noBudget).length,
    budgetExceeded: withStats.filter((e) => e.alerts.budgetExceeded).length,
    pendingPayments: withStats.filter((e) => e.alerts.pendingPayments).length,
    missingPostEvent: withStats.filter((e) => e.alerts.missingPostEvent).length,
  };
}

export async function fetchAvailableYears(client?: SupabaseClient): Promise<number[]> {
  const db = client ?? supabase;
  const { data, error } = await db.from("events").select("year");
  if (error) return [new Date().getFullYear()];
  const years = [...new Set((data ?? []).map((r) => r.year as number))].sort((a, b) => b - a);
  return years.length > 0 ? years : [new Date().getFullYear()];
}

export async function insertEvent(
  input: Omit<OrgEvent, "id" | "createdAt" | "updatedAt">
): Promise<OrgEvent | null> {
  const { data, error } = await supabase
    .from("events")
    .insert({
      year: input.year,
      name: input.name,
      month_label: input.monthLabel,
      commemorative_date: input.commemorativeDate,
      event_date: input.eventDate,
      gifts_notes: input.giftsNotes,
      organization_team: input.organizationTeam,
      status: input.status,
      objectives: input.objectives,
      budget_planned: input.budgetPlanned,
      notes: input.notes,
      event_type: input.eventType,
      event_size: input.eventSize,
      target_audience: input.targetAudience,
      priority: input.priority,
      requesting_area: input.requestingArea,
      owner_user_id: input.ownerUserId,
      location: input.location,
      participants_expected: input.participantsExpected,
      participants_actual: input.participantsActual,
      stage_status: input.stageStatus,
      risk_level: input.riskLevel,
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao inserir evento:", error);
    return null;
  }
  return rowToEvent(data as EventRow);
}

export async function updateEvent(
  id: string,
  partial: Partial<Omit<OrgEvent, "id" | "createdAt" | "updatedAt">>
): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (partial.year != null) payload.year = partial.year;
  if (partial.name != null) payload.name = partial.name;
  if (partial.monthLabel !== undefined) payload.month_label = partial.monthLabel;
  if (partial.commemorativeDate !== undefined) payload.commemorative_date = partial.commemorativeDate;
  if (partial.eventDate !== undefined) payload.event_date = partial.eventDate;
  if (partial.giftsNotes !== undefined) payload.gifts_notes = partial.giftsNotes;
  if (partial.organizationTeam !== undefined) payload.organization_team = partial.organizationTeam;
  if (partial.status != null) payload.status = partial.status;
  if (partial.objectives !== undefined) payload.objectives = partial.objectives;
  if (partial.budgetPlanned !== undefined) payload.budget_planned = partial.budgetPlanned;
  if (partial.notes !== undefined) payload.notes = partial.notes;
  if (partial.eventType !== undefined) payload.event_type = partial.eventType;
  if (partial.eventSize !== undefined) payload.event_size = partial.eventSize;
  if (partial.targetAudience !== undefined) payload.target_audience = partial.targetAudience;
  if (partial.priority !== undefined) payload.priority = partial.priority;
  if (partial.requestingArea !== undefined) payload.requesting_area = partial.requestingArea;
  if (partial.ownerUserId !== undefined) payload.owner_user_id = partial.ownerUserId;
  if (partial.location !== undefined) payload.location = partial.location;
  if (partial.participantsExpected !== undefined) payload.participants_expected = partial.participantsExpected;
  if (partial.participantsActual !== undefined) payload.participants_actual = partial.participantsActual;
  if (partial.stageStatus !== undefined) payload.stage_status = partial.stageStatus;
  if (partial.riskLevel !== undefined) payload.risk_level = partial.riskLevel;

  const { error } = await supabase.from("events").update(payload).eq("id", id);
  if (error) {
    console.error("Erro ao atualizar evento:", error);
    return false;
  }
  return true;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) {
    console.error("Erro ao deletar evento:", error);
    return false;
  }
  return true;
}

export async function fetchEventTasks(
  eventId: string,
  client?: SupabaseClient
): Promise<EventTask[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from("event_tasks")
    .select(TASK_SELECT)
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar tarefas:", error);
    return [];
  }
  return (data ?? []).map((r) => rowToTask(r as TaskRow & { users?: TaskRow["users"] | TaskRow["users"][] | null }));
}

export async function insertEventTask(
  input: Omit<EventTask, "id" | "createdAt" | "updatedAt" | "assigneeName" | "assigneeAvatar">
): Promise<EventTask | null> {
  const { data, error } = await supabase
    .from("event_tasks")
    .insert({
      event_id: input.eventId,
      title: input.title,
      description: input.description,
      assignee_id: input.assigneeId,
      due_date: input.dueDate,
      status: input.status,
      phase: input.phase,
      sort_order: input.sortOrder,
    })
    .select(TASK_SELECT)
    .single();

  if (error) {
    console.error("Erro ao inserir tarefa:", error);
    return null;
  }
  return rowToTask(data as TaskRow & { users?: TaskRow["users"] | TaskRow["users"][] | null });
}

export async function updateEventTask(
  id: string,
  partial: Partial<
    Pick<
      EventTask,
      "title" | "description" | "assigneeId" | "dueDate" | "status" | "phase" | "sortOrder" | "marketingRequestId"
    >
  >
): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (partial.title != null) payload.title = partial.title;
  if (partial.description !== undefined) payload.description = partial.description;
  if (partial.assigneeId !== undefined) payload.assignee_id = partial.assigneeId;
  if (partial.dueDate !== undefined) payload.due_date = partial.dueDate;
  if (partial.status != null) payload.status = partial.status;
  if (partial.phase !== undefined) payload.phase = partial.phase;
  if (partial.sortOrder != null) payload.sort_order = partial.sortOrder;
  if (partial.marketingRequestId !== undefined) payload.marketing_request_id = partial.marketingRequestId;

  const { error } = await supabase.from("event_tasks").update(payload).eq("id", id);
  if (error) {
    console.error("Erro ao atualizar tarefa:", error);
    return false;
  }
  return true;
}

export async function deleteEventTask(id: string): Promise<boolean> {
  const { error } = await supabase.from("event_tasks").delete().eq("id", id);
  if (error) {
    console.error("Erro ao deletar tarefa:", error);
    return false;
  }
  return true;
}

export async function fetchEventBudgetItems(
  eventId: string,
  client?: SupabaseClient
): Promise<EventBudgetItem[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from("event_budget_items")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar orçamento:", error);
    return [];
  }
  return (data ?? []).map((r) => rowToBudget(r as BudgetRow));
}

export async function insertEventBudgetItem(
  input: Omit<EventBudgetItem, "id" | "createdAt">
): Promise<EventBudgetItem | null> {
  const { data, error } = await supabase
    .from("event_budget_items")
    .insert({
      event_id: input.eventId,
      category: input.category,
      description: input.description,
      vendor_name: input.vendorName,
      amount_planned: input.amountPlanned,
      amount_quoted: input.amountQuoted,
      amount_actual: input.amountActual,
      payment_status: input.paymentStatus,
      due_date: input.dueDate,
      payment_due_date: input.paymentDueDate,
      payment_paid_date: input.paymentPaidDate,
      invoice_link: input.invoiceLink,
      receipt_link: input.receiptLink,
      approved_by_user_id: input.approvedByUserId,
      notes: input.notes,
      sort_order: input.sortOrder,
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao inserir linha de orçamento:", error);
    return null;
  }
  return rowToBudget(data as BudgetRow);
}

export async function updateEventBudgetItem(
  id: string,
  partial: Partial<
    Omit<EventBudgetItem, "id" | "eventId" | "createdAt">
  >
): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (partial.category != null) payload.category = partial.category;
  if (partial.description !== undefined) payload.description = partial.description;
  if (partial.vendorName !== undefined) payload.vendor_name = partial.vendorName;
  if (partial.amountPlanned != null) payload.amount_planned = partial.amountPlanned;
  if (partial.amountQuoted !== undefined) payload.amount_quoted = partial.amountQuoted;
  if (partial.amountActual !== undefined) payload.amount_actual = partial.amountActual;
  if (partial.paymentStatus != null) payload.payment_status = partial.paymentStatus;
  if (partial.dueDate !== undefined) payload.due_date = partial.dueDate;
  if (partial.paymentDueDate !== undefined) payload.payment_due_date = partial.paymentDueDate;
  if (partial.paymentPaidDate !== undefined) payload.payment_paid_date = partial.paymentPaidDate;
  if (partial.invoiceLink !== undefined) payload.invoice_link = partial.invoiceLink;
  if (partial.receiptLink !== undefined) payload.receipt_link = partial.receiptLink;
  if (partial.approvedByUserId !== undefined) payload.approved_by_user_id = partial.approvedByUserId;
  if (partial.notes !== undefined) payload.notes = partial.notes;
  if (partial.sortOrder != null) payload.sort_order = partial.sortOrder;

  const { error } = await supabase.from("event_budget_items").update(payload).eq("id", id);
  if (error) {
    console.error("Erro ao atualizar orçamento:", error);
    return false;
  }
  return true;
}

export async function deleteEventBudgetItem(id: string): Promise<boolean> {
  const { error } = await supabase.from("event_budget_items").delete().eq("id", id);
  if (error) {
    console.error("Erro ao deletar linha de orçamento:", error);
    return false;
  }
  return true;
}

export async function fetchEventSuppliers(eventId: string, client?: SupabaseClient): Promise<EventSupplier[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from("event_supplier_event_usage")
    .select("event_suppliers:supplier_id (*)")
    .eq("event_id", eventId);
  if (error) {
    console.error("Erro ao buscar fornecedores do evento:", error);
    return [];
  }
  const rows = (data ?? [])
    .map((r) => (r.event_suppliers as SupplierRow | SupplierRow[] | null))
    .flat()
    .filter(Boolean) as SupplierRow[];
  return rows.map(rowToSupplier);
}

export async function fetchSuppliersCatalog(client?: SupabaseClient): Promise<EventSupplier[]> {
  const db = client ?? supabase;
  const { data, error } = await db.from("event_suppliers").select("*").order("name");
  if (error) return [];
  return (data ?? []).map((row) => rowToSupplier(row as SupplierRow));
}

export async function fetchSuppliersCatalogWithStats(
  client?: SupabaseClient
): Promise<EventSupplierWithStats[]> {
  const db = client ?? supabase;
  const [suppliersRes, usageRes, quotesRes] = await Promise.all([
    db.from("event_suppliers").select("*").order("name"),
    db.from("event_supplier_event_usage").select("supplier_id, created_at"),
    db
      .from("event_supplier_quotes")
      .select("supplier_id, final_value, proposal_status")
      .eq("proposal_status", "aprovada"),
  ]);
  if (suppliersRes.error) return [];

  const usageStats: Record<string, { count: number; lastUsedAt: string | null }> = {};
  for (const u of usageRes.data ?? []) {
    const sid = u.supplier_id as string;
    if (!sid) continue;
    const entry = usageStats[sid] ?? { count: 0, lastUsedAt: null };
    entry.count++;
    const createdAt = u.created_at as string;
    if (!entry.lastUsedAt || createdAt > entry.lastUsedAt) entry.lastUsedAt = createdAt;
    usageStats[sid] = entry;
  }

  const quoteStats: Record<string, { count: number; total: number }> = {};
  for (const q of quotesRes.data ?? []) {
    const sid = q.supplier_id as string;
    if (!sid) continue;
    const entry = quoteStats[sid] ?? { count: 0, total: 0 };
    entry.count++;
    entry.total += Number(q.final_value ?? 0);
    quoteStats[sid] = entry;
  }

  return (suppliersRes.data ?? []).map((row) => {
    const supplier = rowToSupplier(row as SupplierRow);
    const usage = usageStats[supplier.id];
    const quotes = quoteStats[supplier.id];
    return {
      ...supplier,
      eventsCount: usage?.count ?? 0,
      approvedQuotesCount: quotes?.count ?? 0,
      totalApprovedValue: quotes?.total ?? 0,
      lastUsedAt: usage?.lastUsedAt ?? null,
    };
  });
}

export async function deleteSupplier(id: string): Promise<boolean> {
  const { error } = await supabase.from("event_suppliers").delete().eq("id", id);
  return !error;
}

export async function upsertSupplier(
  supplier: Partial<EventSupplier> & { name: string }
): Promise<EventSupplier | null> {
  const payload = {
    name: supplier.name,
    category: supplier.category ?? "outros",
    contact_name: supplier.contactName ?? null,
    phone: supplier.phone ?? null,
    email: supplier.email ?? null,
    rating: supplier.rating ?? null,
    notes: supplier.notes ?? null,
    active: supplier.active ?? true,
    website_link: supplier.websiteLink ?? null,
    instagram_link: supplier.instagramLink ?? null,
    portfolio_link: supplier.portfolioLink ?? null,
    whatsapp_link: supplier.whatsappLink ?? null,
  };
  if (supplier.id) {
    const { data, error } = await supabase
      .from("event_suppliers")
      .update(payload)
      .eq("id", supplier.id)
      .select("*")
      .single();
    if (error) return null;
    return rowToSupplier(data as SupplierRow);
  }
  const { data, error } = await supabase.from("event_suppliers").insert(payload).select("*").single();
  if (error) return null;
  return rowToSupplier(data as SupplierRow);
}

export async function linkSupplierToEvent(
  eventId: string,
  supplierId: string,
  roleLabel?: string | null
): Promise<boolean> {
  const { error } = await supabase.from("event_supplier_event_usage").upsert(
    {
      event_id: eventId,
      supplier_id: supplierId,
      role_label: roleLabel ?? null,
    },
    { onConflict: "event_id,supplier_id" }
  );
  return !error;
}

export interface EventSupplierLink {
  usageId: string;
  supplier: EventSupplier;
}

export async function fetchEventSupplierLinks(
  eventId: string,
  client?: SupabaseClient
): Promise<EventSupplierLink[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from("event_supplier_event_usage")
    .select("id, event_suppliers:supplier_id (*)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Erro ao buscar prestadores vinculados ao evento:", error);
    return [];
  }
  return (data ?? [])
    .map((row) => {
      const supplierRaw = row.event_suppliers as SupplierRow | SupplierRow[] | null;
      const supplierRow = Array.isArray(supplierRaw) ? supplierRaw[0] : supplierRaw;
      if (!supplierRow) return null;
      return { usageId: row.id as string, supplier: rowToSupplier(supplierRow) };
    })
    .filter((x): x is EventSupplierLink => x !== null);
}

export async function unlinkSupplierFromEvent(usageId: string): Promise<boolean> {
  const { error } = await supabase.from("event_supplier_event_usage").delete().eq("id", usageId);
  return !error;
}

export async function fetchSupplierQuotes(
  eventId: string,
  client?: SupabaseClient
): Promise<EventSupplierQuote[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from("event_supplier_quotes")
    .select("*, event_suppliers:supplier_id (name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map((row) => rowToQuote(row as SupplierQuoteRow));
}

export async function insertSupplierQuote(
  input: Omit<EventSupplierQuote, "id" | "createdAt" | "updatedAt" | "supplierName">
): Promise<EventSupplierQuote | null> {
  const { data, error } = await supabase
    .from("event_supplier_quotes")
    .insert({
      event_id: input.eventId,
      supplier_id: input.supplierId,
      category: input.category,
      quoted_value: input.quotedValue,
      final_value: input.finalValue,
      included_items: input.includedItems,
      proposal_status: input.proposalStatus,
      attached_file_link: input.attachedFileLink,
      decision_reason: input.decisionReason,
    })
    .select("*, event_suppliers:supplier_id (name)")
    .single();
  if (error) return null;
  return rowToQuote(data as SupplierQuoteRow);
}

export async function updateSupplierQuote(
  id: string,
  partial: Partial<Omit<EventSupplierQuote, "id" | "eventId" | "createdAt" | "updatedAt" | "supplierName">>
): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (partial.supplierId !== undefined) payload.supplier_id = partial.supplierId;
  if (partial.category !== undefined) payload.category = partial.category;
  if (partial.quotedValue !== undefined) payload.quoted_value = partial.quotedValue;
  if (partial.finalValue !== undefined) payload.final_value = partial.finalValue;
  if (partial.includedItems !== undefined) payload.included_items = partial.includedItems;
  if (partial.proposalStatus !== undefined) payload.proposal_status = partial.proposalStatus;
  if (partial.attachedFileLink !== undefined) payload.attached_file_link = partial.attachedFileLink;
  if (partial.decisionReason !== undefined) payload.decision_reason = partial.decisionReason;
  const { error } = await supabase.from("event_supplier_quotes").update(payload).eq("id", id);
  return !error;
}

export async function deleteSupplierQuote(id: string): Promise<boolean> {
  const { error } = await supabase.from("event_supplier_quotes").delete().eq("id", id);
  return !error;
}

export async function fetchEventInvites(eventId: string, client?: SupabaseClient): Promise<EventInvite[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from("event_invites")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map((row) => rowToInvite(row as InviteRow));
}

export async function upsertEventInvite(
  input: Partial<EventInvite> & { eventId: string; name: string }
): Promise<EventInvite | null> {
  const payload = {
    event_id: input.eventId,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    company: input.company ?? null,
    guest_type: input.guestType ?? "convidado_externo",
    invite_status: input.inviteStatus ?? "nao_enviado",
    confirmation_status: input.confirmationStatus ?? "sem_resposta",
    attended: input.attended ?? null,
    dietary_restrictions: input.dietaryRestrictions ?? null,
    notes: input.notes ?? null,
  };
  if (input.id) {
    const { data, error } = await supabase.from("event_invites").update(payload).eq("id", input.id).select("*").single();
    if (error) return null;
    return rowToInvite(data as InviteRow);
  }
  const { data, error } = await supabase.from("event_invites").insert(payload).select("*").single();
  if (error) return null;
  return rowToInvite(data as InviteRow);
}

export async function deleteEventInvite(id: string): Promise<boolean> {
  const { error } = await supabase.from("event_invites").delete().eq("id", id);
  return !error;
}

export async function fetchEventCommunications(
  eventId: string,
  client?: SupabaseClient
): Promise<EventCommunication[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from("event_communications")
    .select("*, users:responsible_user_id (name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map((row) => rowToCommunication(row as CommunicationRow));
}

export async function upsertEventCommunication(
  input: Partial<EventCommunication> & { eventId: string; title: string; channel: EventCommunicationChannel }
): Promise<EventCommunication | null> {
  const payload = {
    event_id: input.eventId,
    channel: input.channel,
    title: input.title,
    content: input.content ?? null,
    responsible_user_id: input.responsibleUserId ?? null,
    planned_date: input.plannedDate ?? null,
    published_date: input.publishedDate ?? null,
    status: input.status ?? "planejada",
  };
  if (input.id) {
    const { data, error } = await supabase
      .from("event_communications")
      .update(payload)
      .eq("id", input.id)
      .select("*, users:responsible_user_id (name)")
      .single();
    if (error) return null;
    return rowToCommunication(data as CommunicationRow);
  }
  const { data, error } = await supabase
    .from("event_communications")
    .insert(payload)
    .select("*, users:responsible_user_id (name)")
    .single();
  if (error) return null;
  return rowToCommunication(data as CommunicationRow);
}

export async function deleteEventCommunication(id: string): Promise<boolean> {
  const { error } = await supabase.from("event_communications").delete().eq("id", id);
  return !error;
}

export async function fetchEventAttachments(
  eventId: string,
  client?: SupabaseClient
): Promise<EventAttachment[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from("event_attachments")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row) => rowToAttachment(row as AttachmentRow));
}

export async function upsertEventAttachment(
  input: Partial<EventAttachment> & { eventId: string; title: string; url: string }
): Promise<EventAttachment | null> {
  const payload = {
    event_id: input.eventId,
    related_entity: input.relatedEntity ?? null,
    related_id: input.relatedId ?? null,
    file_type: input.fileType ?? "arquivo_geral",
    title: input.title,
    url: input.url,
    storage_path: input.storagePath ?? null,
    provider: input.provider ?? "external_link",
    uploaded_by_user_id: input.uploadedByUserId ?? null,
  };
  if (input.id) {
    const { data, error } = await supabase.from("event_attachments").update(payload).eq("id", input.id).select("*").single();
    if (error) return null;
    return rowToAttachment(data as AttachmentRow);
  }
  const { data, error } = await supabase.from("event_attachments").insert(payload).select("*").single();
  if (error) return null;
  return rowToAttachment(data as AttachmentRow);
}

export async function deleteEventAttachment(id: string): Promise<boolean> {
  const { error } = await supabase.from("event_attachments").delete().eq("id", id);
  return !error;
}

export async function fetchEventPostmortem(
  eventId: string,
  client?: SupabaseClient
): Promise<EventPostmortem | null> {
  const db = client ?? supabase;
  const { data, error } = await db.from("event_postmortems").select("*").eq("event_id", eventId).maybeSingle();
  if (error || !data) return null;
  return rowToPostmortem(data as PostmortemRow);
}

export async function upsertEventPostmortem(
  input: Omit<EventPostmortem, "id" | "createdAt" | "updatedAt">
): Promise<EventPostmortem | null> {
  const payload = {
    event_id: input.eventId,
    what_worked: input.whatWorked,
    what_failed: input.whatFailed,
    improvements: input.improvements,
    overall_rating: input.overallRating,
    nps: input.nps,
    participants_expected: input.participantsExpected,
    participants_actual: input.participantsActual,
    cost_per_participant: input.costPerParticipant,
    reuse_supplier_notes: input.reuseSupplierNotes,
  };
  const existing = await fetchEventPostmortem(input.eventId);
  if (existing?.id) {
    const { data, error } = await supabase
      .from("event_postmortems")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return null;
    return rowToPostmortem(data as PostmortemRow);
  }
  const { data, error } = await supabase.from("event_postmortems").insert(payload).select("*").single();
  if (error) return null;
  return rowToPostmortem(data as PostmortemRow);
}

export async function fetchEventHistory(
  eventId: string,
  client?: SupabaseClient
): Promise<EventHistoryItem[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from("event_history")
    .select("*, users:actor_user_id (name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row) => rowToHistory(row as EventHistoryRow));
}

export async function addEventHistory(
  eventId: string,
  actionType: string,
  actionLabel: string,
  actorUserId?: string | null,
  payload?: Record<string, unknown> | null
): Promise<boolean> {
  const { error } = await supabase.from("event_history").insert({
    event_id: eventId,
    action_type: actionType,
    action_label: actionLabel,
    actor_user_id: actorUserId ?? null,
    payload: payload ?? null,
  });
  return !error;
}

export async function fetchEventTemplates(client?: SupabaseClient): Promise<EventTemplate[]> {
  const db = client ?? supabase;
  const { data, error } = await db.from("event_templates").select("*").eq("is_active", true).order("name");
  if (error) return [];
  return (data ?? []).map((row) => rowToTemplate(row as EventTemplateRow));
}

export async function fetchTemplateTasks(
  templateId: string,
  client?: SupabaseClient
): Promise<EventTemplateTask[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from("event_template_tasks")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return (data ?? []).map((row) => rowToTemplateTask(row as EventTemplateTaskRow));
}

function addDays(isoDate: string, days: number): string {
  const dt = new Date(`${isoDate}T12:00:00`);
  dt.setDate(dt.getDate() - days);
  return dt.toISOString().slice(0, 10);
}

export async function createEventTasksFromTemplate(
  eventId: string,
  templateId: string,
  eventDate: string
): Promise<{ created: number; error: string | null }> {
  const templateTasks = await fetchTemplateTasks(templateId);
  if (templateTasks.length === 0) return { created: 0, error: null };

  const payload = templateTasks.map((t, idx) => ({
    event_id: eventId,
    title: t.title,
    description: t.description,
    due_date: addDays(eventDate, t.offsetDays),
    status: "pendente",
    phase: t.phase,
    sort_order: idx,
  }));

  const { error } = await supabase.from("event_tasks").insert(payload);
  if (error) return { created: 0, error: error.message };
  return { created: payload.length, error: null };
}

export async function duplicateEventToNextYear(
  eventId: string
): Promise<{ error: string | null; newEventId?: string }> {
  const source = await fetchEventById(eventId);
  if (!source) return { error: "Evento não encontrado" };

  const duplicated = await insertEvent({
    ...source,
    year: source.year + 1,
    status: "nao_iniciada",
    stageStatus: "ideia_cadastrada",
    riskLevel: "baixo",
    participantsActual: null,
    budgetPlanned: source.budgetPlanned,
    notes: source.notes,
  });

  if (!duplicated) return { error: "Falha ao duplicar evento" };

  const [tasks, quotes] = await Promise.all([
    fetchEventTasks(source.id),
    fetchSupplierQuotes(source.id),
  ]);

  if (tasks.length > 0) {
    await supabase.from("event_tasks").insert(
      tasks.map((t, i) => ({
        event_id: duplicated.id,
        title: t.title,
        description: t.description,
        due_date: null,
        status: "pendente",
        phase: t.phase,
        sort_order: i,
      }))
    );
  }

  const approvedQuotes = quotes.filter((q) => q.proposalStatus === "aprovada");
  if (approvedQuotes.length > 0) {
    await supabase.from("event_supplier_quotes").insert(
      approvedQuotes.map((q) => ({
        event_id: duplicated.id,
        supplier_id: q.supplierId,
        category: q.category,
        quoted_value: q.quotedValue,
        final_value: null,
        included_items: q.includedItems,
        proposal_status: "pendente",
        attached_file_link: null,
        decision_reason: null,
      }))
    );
  }

  await addEventHistory(duplicated.id, "duplicacao", `Duplicado do evento ${source.name}`, null, {
    sourceEventId: source.id,
  });

  return { error: null, newEventId: duplicated.id };
}

export async function promoteEventTaskToPlanner(
  taskId: string,
  event: OrgEvent,
  formData: EventToPlannerFormData,
  createdBy: { id: string | null; name: string | null }
): Promise<{ error: string | null; requestId?: string }> {
  const { data: task, error: taskErr } = await supabase
    .from("event_tasks")
    .select("id, marketing_request_id")
    .eq("id", taskId)
    .single();

  if (taskErr || !task) return { error: "Tarefa não encontrada" };
  if (task.marketing_request_id) return { error: "Tarefa já foi enviada ao Planner" };

  const solicitanteUser = formData.solicitante_id
    ? (await supabase.from("users").select("name, department").eq("id", formData.solicitante_id).single()).data
    : null;
  const solicitanteName = solicitanteUser?.name ?? formData.solicitante ?? "Eventos";
  const requestingArea = solicitanteUser?.department ?? formData.requesting_area;

  const designer = formData.assignee_id
    ? (await supabase.from("users").select("name").eq("id", formData.assignee_id).single()).data
    : null;

  const { data: inserted, error: insertErr } = await supabase
    .from("marketing_requests")
    .insert({
      title: formData.title.trim() || `Evento: ${event.name} — ${taskId}`,
      description: formData.description.trim() || null,
      requesting_area: requestingArea,
      status: "pending",
      workflow_stage: "tarefas",
      request_type: formData.request_type || "Material Impresso",
      solicitante: solicitanteName,
      solicitante_id: formData.solicitante_id || null,
      requested_at: new Date().toISOString(),
      priority: formData.priority || "normal",
      deadline: formData.deadline || event.eventDate || null,
      deadline_time: formData.deadline_time || null,
      assignee: designer?.name ?? null,
      assignee_id: formData.assignee_id || null,
      link: formData.link || null,
      referencias: formData.referencias || null,
      created_by_id: createdBy.id,
      created_by: createdBy.name,
    })
    .select("id")
    .single();

  if (insertErr) return { error: insertErr.message };

  const { error: linkErr } = await supabase
    .from("event_tasks")
    .update({ marketing_request_id: inserted.id })
    .eq("id", taskId);

  if (linkErr) return { error: linkErr.message };
  return { error: null, requestId: inserted.id };
}
