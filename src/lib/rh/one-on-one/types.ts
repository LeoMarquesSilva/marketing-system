/**
 * Reuniões 1:1 — tipos compartilhados entre servidor e telas.
 * Proposta aprovada em 19/11/2026: docs/feedz/proposta-1-1.md.
 */

import type { PdiPerson } from "@/lib/rh/pdi/types";

export type OneOnOneStatus = "agendada" | "realizada" | "cancelada";
/** Status para a tela: "atrasada" = agendada cujo horário já passou sem ser finalizada. */
export type OneOnOneDisplayStatus = OneOnOneStatus | "atrasada";
/** Frequência da dupla: em dia (última 1:1 dentro do prazo), atrasada ou sem nenhuma reunião. */
export type OneOnOneCadence = "em_dia" | "atrasada" | "sem_reuniao";
export type OneOnOneFrequency = "semanal" | "quinzenal" | "mensal";
export type OneOnOneTopicSource = "livre" | "sugerido" | "pdi" | "pendencia" | "feedz";
export type OneOnOneViewerRole = "lider" | "liderado" | "rh";
export type PrivateNotesReaders = "nenhum" | "admin" | "rh";

export const ONLINE_ROOM_KEY = "SOMENTE_ONLINE";

export interface OneOnOneRoom {
  key: string;
  label: string;
  email: string;
}

export interface OneOnOneSettings {
  private_notes_readers: PrivateNotesReaders;
  email_agenda_enabled: boolean;
  email_reminder_enabled: boolean;
  overdue_days: number;
  member_can_schedule: boolean;
  member_can_reschedule: boolean;
  member_can_rate: boolean;
  rooms: OneOnOneRoom[];
}

export interface OneOnOneCategory {
  id: string;
  name: string;
  suggested_topics: string[];
  is_active: boolean;
}

export interface OneOnOneTopic {
  id: string;
  title: string;
  source: OneOnOneTopicSource;
  author: PdiPerson | null;
  discussed: boolean;
}

export interface OneOnOneAction {
  id: string;
  meeting_id: string | null;
  title: string;
  owner: PdiPerson | null;
  due_date: string | null;
  done_at: string | null;
  overdue: boolean;
  created_at: string;
}

export interface OneOnOneNote {
  author: PdiPerson;
  body: string;
  updated_at: string;
  mine: boolean;
}

export interface OneOnOneMeeting {
  id: string;
  starts_at: string;
  ends_at: string;
  status: OneOnOneStatus;
  display_status: OneOnOneDisplayStatus;
  category: { id: string; name: string } | null;
  room: { key: string; label: string } | null;
  teams_join_url: string | null;
  in_outlook: boolean;
  topics: OneOnOneTopic[];
  /** Ações registradas nesta reunião. */
  actions: OneOnOneAction[];
  /** A minha anotação (sempre) e as dos outros quando a configuração deixa ler. */
  notes: OneOnOneNote[];
  my_note: string;
  rating: number | null;
  rating_comment: string | null;
  finished_at: string | null;
  from_feedz: boolean;
  permissions: {
    canEditAgenda: boolean;
    canFinish: boolean;
    canReschedule: boolean;
    canCancel: boolean;
    canRate: boolean;
    canSeeRating: boolean;
    canWriteNote: boolean;
  };
}

export interface OneOnOnePairSummary {
  leader: PdiPerson;
  member: PdiPerson;
  viewer_role: OneOnOneViewerRole;
  last_meeting_at: string | null;
  days_since_last: number | null;
  next_meeting: { id: string; starts_at: string; category: string | null; room: string | null } | null;
  cadence: OneOnOneCadence;
  open_actions: number;
  meetings_done: number;
  late_meetings: number;
  pdi: { id: string; progress: number; overdue_actions: number } | null;
}

export interface OneOnOneSuggestion {
  title: string;
  source: Extract<OneOnOneTopicSource, "pdi" | "pendencia" | "sugerido">;
  pdi_action_id?: string;
  hint?: string;
}

export interface OneOnOnePairDetail {
  summary: OneOnOnePairSummary;
  meetings: OneOnOneMeeting[];
  actions: OneOnOneAction[];
  series: Array<{ id: string; frequency: OneOnOneFrequency; start_time: string; ends_on: string; category: string | null }>;
  suggestions: OneOnOneSuggestion[];
  categories: OneOnOneCategory[];
  rooms: OneOnOneRoom[];
  permissions: { canSchedule: boolean; canCreateAction: boolean };
  outlook_ready: boolean;
  /** Cadastro de colaborador de quem está vendo (para saber se é o líder). */
  viewer_employee_id: string | null;
}

export interface OneOnOneOverview {
  me: PdiPerson | null;
  /** Duplas em que sou o líder. */
  asLeader: OneOnOnePairSummary[];
  /** Duplas em que sou o liderado. */
  asMember: OneOnOnePairSummary[];
  upcoming: Array<{ id: string; starts_at: string; ends_at: string; with: PdiPerson; category: string | null; room: string | null; leader_id: string; member_id: string }>;
  overdue_days: number;
  isHr: boolean;
}

export interface OneOnOneHrOverview {
  pairs: OneOnOnePairSummary[];
  history: Array<{
    id: string;
    leader: PdiPerson;
    member: PdiPerson;
    starts_at: string;
    status: OneOnOneDisplayStatus;
    category: string | null;
    rating: number | null;
    from_feedz: boolean;
  }>;
  settings: OneOnOneSettings;
  categories: OneOnOneCategory[];
}

export interface ScheduleInput {
  leader_employee_id: string;
  member_employee_id: string;
  category_id: string | null;
  /** Data e hora locais (America/Sao_Paulo): "2026-11-20T14:00". */
  start_local: string;
  duration_minutes: number;
  room_key: string | null;
  topics: Array<{ title: string; source: OneOnOneTopicSource; pdi_action_id?: string | null }>;
  recurrence: { frequency: OneOnOneFrequency; until: string } | null;
  create_in_outlook: boolean;
}

export interface AvailabilityInput {
  leader_employee_id: string;
  member_employee_id: string;
  room_key: string | null;
  /** Dia local "2026-11-20". */
  date: string;
  duration_minutes?: number;
}

export interface AvailabilityResult {
  date: string;
  /** Horários de início livres para todos (locais, "HH:MM"), em passos de 30 minutos, das 8h às 19h. */
  slots: Array<{ time: string; free: boolean; busy: string[] }>;
  /** Agendas lidas: pessoa (com foto) ou sala; view = availabilityView do Outlook, 1 caractere por 30 min a partir das 8h. */
  people: Array<{ label: string; ok: boolean; kind: "pessoa" | "sala"; person: PdiPerson | null; view: string }>;
  error: string | null;
}
