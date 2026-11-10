/** Pagamentos e aprovações do evento no banco (mesmo cliente e mesmo acesso das outras telas de Eventos). */
import { supabase } from "@/utils/supabase/client";
import type { ApprovalStatus, EventApproval, EventPayment } from "@/lib/eventos-orcamento";

type PaymentRow = {
  id: string;
  event_id: string;
  vendor_name: string | null;
  description: string;
  amount: number | string;
  due_date: string | null;
  paid: boolean;
  paid_date: string | null;
  notes: string | null;
  sort_order: number;
};

type ApprovalRow = {
  id: string;
  event_id: string;
  title: string;
  context: string | null;
  approver_name: string;
  approver_user_id: string | null;
  status: string;
  decision_note: string | null;
  decided_on: string | null;
  decided_by_user_id: string | null;
  task_id: string | null;
  amount: number | string | null;
  link_url: string | null;
  link_label: string | null;
  sort_order: number;
  created_at: string;
};

function toPayment(row: PaymentRow): EventPayment {
  return {
    id: row.id,
    eventId: row.event_id,
    vendorName: row.vendor_name,
    description: row.description,
    amount: Number(row.amount),
    dueDate: row.due_date,
    paid: row.paid,
    paidDate: row.paid_date,
    notes: row.notes,
    sortOrder: row.sort_order,
  };
}

function toApproval(row: ApprovalRow): EventApproval {
  const status = (["pendente", "aprovado", "ajustar", "reprovado"] as ApprovalStatus[]).includes(row.status as ApprovalStatus)
    ? (row.status as ApprovalStatus)
    : "pendente";
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    context: row.context,
    approverName: row.approver_name,
    approverUserId: row.approver_user_id,
    status,
    decisionNote: row.decision_note,
    decidedOn: row.decided_on,
    decidedByUserId: row.decided_by_user_id,
    taskId: row.task_id,
    amount: row.amount != null ? Number(row.amount) : null,
    linkUrl: row.link_url,
    linkLabel: row.link_label,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function fetchEventPayments(eventId: string): Promise<EventPayment[]> {
  const { data, error } = await supabase.from("event_payments").select("*").eq("event_id", eventId).order("sort_order");
  if (error) {
    console.error("Erro ao buscar pagamentos do evento:", error);
    return [];
  }
  return (data ?? []).map((row) => toPayment(row as PaymentRow));
}

export type PaymentInput = Pick<EventPayment, "vendorName" | "description" | "amount" | "dueDate" | "paid" | "paidDate" | "notes">;

export async function saveEventPayment(eventId: string, input: PaymentInput, id?: string): Promise<EventPayment | null> {
  const payload = {
    vendor_name: input.vendorName,
    description: input.description,
    amount: input.amount,
    due_date: input.dueDate,
    paid: input.paid,
    paid_date: input.paid ? input.paidDate : null,
    notes: input.notes,
    updated_at: new Date().toISOString(),
  };
  const query = id
    ? supabase.from("event_payments").update(payload).eq("id", id)
    : supabase.from("event_payments").insert({ ...payload, event_id: eventId });
  const { data, error } = await query.select("*").single();
  if (error) {
    console.error("Erro ao salvar pagamento do evento:", error);
    return null;
  }
  return toPayment(data as PaymentRow);
}

export async function deleteEventPayment(id: string): Promise<boolean> {
  const { error } = await supabase.from("event_payments").delete().eq("id", id);
  if (error) console.error("Erro ao excluir pagamento do evento:", error);
  return !error;
}

export async function fetchEventApprovals(eventId: string): Promise<EventApproval[]> {
  const { data, error } = await supabase.from("event_approvals").select("*").eq("event_id", eventId).order("sort_order");
  if (error) {
    console.error("Erro ao buscar aprovações do evento:", error);
    return [];
  }
  return (data ?? []).map((row) => toApproval(row as ApprovalRow));
}

export type ApprovalInput = Pick<EventApproval, "title" | "context" | "approverName" | "approverUserId" | "taskId" | "amount" | "linkUrl" | "linkLabel">;

export async function saveEventApproval(eventId: string, input: ApprovalInput, id?: string): Promise<EventApproval | null> {
  const payload = {
    title: input.title,
    context: input.context,
    approver_name: input.approverName,
    approver_user_id: input.approverUserId,
    task_id: input.taskId,
    amount: input.amount,
    link_url: input.linkUrl,
    link_label: input.linkLabel,
    updated_at: new Date().toISOString(),
  };
  const query = id
    ? supabase.from("event_approvals").update(payload).eq("id", id)
    : supabase.from("event_approvals").insert({ ...payload, event_id: eventId });
  const { data, error } = await query.select("*").single();
  if (error) {
    console.error("Erro ao salvar aprovação do evento:", error);
    return null;
  }
  return toApproval(data as ApprovalRow);
}

/** Registra (ou reabre, com "pendente") a decisão de uma aprovação. */
export async function decideEventApproval(
  id: string,
  decision: { status: ApprovalStatus; note: string | null; decidedOn: string | null; decidedByUserId: string | null }
): Promise<EventApproval | null> {
  const pending = decision.status === "pendente";
  const { data, error } = await supabase
    .from("event_approvals")
    .update({
      status: decision.status,
      decision_note: pending ? null : decision.note,
      decided_on: pending ? null : decision.decidedOn,
      decided_by_user_id: pending ? null : decision.decidedByUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    console.error("Erro ao registrar decisão:", error);
    return null;
  }
  return toApproval(data as ApprovalRow);
}

export async function deleteEventApproval(id: string): Promise<boolean> {
  const { error } = await supabase.from("event_approvals").delete().eq("id", id);
  if (error) console.error("Erro ao excluir aprovação do evento:", error);
  return !error;
}
