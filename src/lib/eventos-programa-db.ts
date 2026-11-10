/** Cronograma, cardápio e degustações do evento no banco (mesmo cliente e acesso das outras telas de Eventos). */
import { supabase } from "@/utils/supabase/client";
import {
  parseParticipants,
  type EventMenuItem,
  type EventSchedule,
  type EventScheduleItem,
  type EventTasting,
  type MenuStatus,
  type MenuType,
  type ScheduleKind,
  type TastingStatus,
} from "@/lib/eventos-programa";

type Row = Record<string, unknown>;

const KINDS: ScheduleKind[] = ["dj", "fala", "premiacao", "show", "outro"];

function toSchedule(row: Row): EventSchedule {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    name: String(row.name),
    summary: (row.summary as string | null) ?? null,
    isOfficial: Boolean(row.is_official),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function toScheduleItem(row: Row): EventScheduleItem {
  return {
    id: String(row.id),
    scheduleId: String(row.schedule_id),
    eventId: String(row.event_id),
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    title: String(row.title),
    kind: KINDS.includes(row.kind as ScheduleKind) ? (row.kind as ScheduleKind) : "outro",
    note: (row.note as string | null) ?? null,
    removed: Boolean(row.removed),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function toMenuItem(row: Row): EventMenuItem {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    menuType: row.menu_type === "bebida" ? "bebida" : "comida",
    section: String(row.section),
    name: String(row.name),
    note: (row.note as string | null) ?? null,
    highlight: Boolean(row.highlight),
    status: row.status === "em_analise" ? "em_analise" : "aprovado",
    vendorName: (row.vendor_name as string | null) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function toTasting(row: Row): EventTasting {
  const status = row.status as TastingStatus;
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    menuType: row.menu_type === "bebida" ? "bebida" : "comida",
    vendorName: String(row.vendor_name),
    tastingDate: (row.tasting_date as string | null) ?? null,
    tastingTime: (row.tasting_time as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    linkUrl: (row.link_url as string | null) ?? null,
    status: status === "realizada" || status === "cancelada" ? status : "agendada",
    resultNote: (row.result_note as string | null) ?? null,
    participants: parseParticipants(row.participants),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function fail(what: string, error: unknown): null {
  console.error(`Erro ao ${what}:`, error);
  return null;
}

/* ───────────────────────────── Cronograma ───────────────────────────── */

export async function fetchEventSchedules(eventId: string): Promise<{ schedules: EventSchedule[]; items: EventScheduleItem[] }> {
  const [schedules, items] = await Promise.all([
    supabase.from("event_schedules").select("*").eq("event_id", eventId).order("sort_order"),
    supabase.from("event_schedule_items").select("*").eq("event_id", eventId).order("sort_order"),
  ]);
  if (schedules.error) console.error("Erro ao buscar cronogramas do evento:", schedules.error);
  if (items.error) console.error("Erro ao buscar blocos do cronograma:", items.error);
  return {
    schedules: (schedules.data ?? []).map((row) => toSchedule(row as Row)),
    items: (items.data ?? []).map((row) => toScheduleItem(row as Row)),
  };
}

export type ScheduleInput = Pick<EventSchedule, "name" | "summary">;

export async function saveEventSchedule(eventId: string, input: ScheduleInput, id?: string): Promise<EventSchedule | null> {
  const payload = { name: input.name, summary: input.summary, updated_at: new Date().toISOString() };
  const query = id
    ? supabase.from("event_schedules").update(payload).eq("id", id)
    : supabase.from("event_schedules").insert({ ...payload, event_id: eventId });
  const { data, error } = await query.select("*").single();
  return error ? fail("salvar cronograma", error) : toSchedule(data as Row);
}

/** Marca uma versão como a oficial (ou nenhuma, com null). Só uma por evento. */
export async function setOfficialSchedule(eventId: string, scheduleId: string | null): Promise<boolean> {
  const cleared = await supabase.from("event_schedules").update({ is_official: false }).eq("event_id", eventId).eq("is_official", true);
  if (cleared.error) return fail("limpar cronograma oficial", cleared.error) ?? false;
  if (!scheduleId) return true;
  const { error } = await supabase.from("event_schedules").update({ is_official: true, updated_at: new Date().toISOString() }).eq("id", scheduleId);
  if (error) console.error("Erro ao marcar cronograma oficial:", error);
  return !error;
}

export async function deleteEventSchedule(id: string): Promise<boolean> {
  const { error } = await supabase.from("event_schedules").delete().eq("id", id);
  if (error) console.error("Erro ao excluir cronograma:", error);
  return !error;
}

export type ScheduleItemInput = Pick<EventScheduleItem, "startTime" | "endTime" | "title" | "kind" | "note" | "removed">;

export async function saveEventScheduleItem(
  eventId: string,
  scheduleId: string,
  input: ScheduleItemInput,
  id?: string
): Promise<EventScheduleItem | null> {
  const payload = {
    start_time: input.startTime,
    end_time: input.endTime,
    title: input.title,
    kind: input.kind,
    note: input.note,
    removed: input.removed,
    updated_at: new Date().toISOString(),
  };
  const query = id
    ? supabase.from("event_schedule_items").update(payload).eq("id", id)
    : supabase.from("event_schedule_items").insert({ ...payload, event_id: eventId, schedule_id: scheduleId });
  const { data, error } = await query.select("*").single();
  return error ? fail("salvar bloco do cronograma", error) : toScheduleItem(data as Row);
}

export async function deleteEventScheduleItem(id: string): Promise<boolean> {
  const { error } = await supabase.from("event_schedule_items").delete().eq("id", id);
  if (error) console.error("Erro ao excluir bloco do cronograma:", error);
  return !error;
}

/* ─────────────────────── Cardápio e degustações ─────────────────────── */

export async function fetchEventMenu(eventId: string): Promise<{ items: EventMenuItem[]; tastings: EventTasting[] }> {
  const [items, tastings] = await Promise.all([
    supabase.from("event_menu_items").select("*").eq("event_id", eventId).order("sort_order"),
    supabase.from("event_tastings").select("*").eq("event_id", eventId).order("tasting_date"),
  ]);
  if (items.error) console.error("Erro ao buscar cardápio do evento:", items.error);
  if (tastings.error) console.error("Erro ao buscar degustações do evento:", tastings.error);
  return {
    items: (items.data ?? []).map((row) => toMenuItem(row as Row)),
    tastings: (tastings.data ?? []).map((row) => toTasting(row as Row)),
  };
}

export interface MenuItemInput {
  menuType: MenuType;
  section: string;
  name: string;
  note: string | null;
  highlight: boolean;
  status: MenuStatus;
  vendorName: string | null;
  sortOrder?: number;
}

export async function saveEventMenuItem(eventId: string, input: MenuItemInput, id?: string): Promise<EventMenuItem | null> {
  const payload = {
    menu_type: input.menuType,
    section: input.section,
    name: input.name,
    note: input.note,
    highlight: input.highlight,
    status: input.status,
    vendor_name: input.vendorName,
    ...(input.sortOrder != null ? { sort_order: input.sortOrder } : {}),
    updated_at: new Date().toISOString(),
  };
  const query = id
    ? supabase.from("event_menu_items").update(payload).eq("id", id)
    : supabase.from("event_menu_items").insert({ ...payload, event_id: eventId });
  const { data, error } = await query.select("*").single();
  return error ? fail("salvar item do cardápio", error) : toMenuItem(data as Row);
}

export async function deleteEventMenuItem(id: string): Promise<boolean> {
  const { error } = await supabase.from("event_menu_items").delete().eq("id", id);
  if (error) console.error("Erro ao excluir item do cardápio:", error);
  return !error;
}

export type TastingInput = Pick<
  EventTasting,
  "menuType" | "vendorName" | "tastingDate" | "tastingTime" | "location" | "linkUrl" | "status" | "resultNote" | "participants"
>;

export async function saveEventTasting(eventId: string, input: TastingInput, id?: string): Promise<EventTasting | null> {
  const payload = {
    menu_type: input.menuType,
    vendor_name: input.vendorName,
    tasting_date: input.tastingDate,
    tasting_time: input.tastingTime,
    location: input.location,
    link_url: input.linkUrl,
    status: input.status,
    result_note: input.resultNote,
    participants: input.participants,
    updated_at: new Date().toISOString(),
  };
  const query = id
    ? supabase.from("event_tastings").update(payload).eq("id", id)
    : supabase.from("event_tastings").insert({ ...payload, event_id: eventId });
  const { data, error } = await query.select("*").single();
  return error ? fail("salvar degustação", error) : toTasting(data as Row);
}

export async function deleteEventTasting(id: string): Promise<boolean> {
  const { error } = await supabase.from("event_tastings").delete().eq("id", id);
  if (error) console.error("Erro ao excluir degustação:", error);
  return !error;
}
