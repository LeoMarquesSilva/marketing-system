import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fetchInstagramMonthlyGoal } from "@/lib/instagram-settings";
import { getSioeClient } from "@/lib/sioe-sync-server";
import { resolveContentScheduleAreaLabel } from "./domain";
import {
  buildPautas,
  countDeliveredInMonth,
  daysBetween,
  followupStatus,
  MARKETING_PAUTA_TASK,
  monthBounds,
  pautasForBoard,
  PAUTAS_GOAL_PER_MONTH,
  type FollowupChannel,
  type FollowupEntry,
  type FollowupStatus,
  type PautaStage,
  type SioeTaskRow,
} from "./followups";
import {
  ContentScheduleHttpError,
  currentSaoPauloDate,
  currentSaoPauloMonth,
  requireContentScheduleActor,
} from "./server";

export type FollowupBoardItem = {
  ci: number;
  viosUrl: string;
  area: string;
  format: "post" | "reel" | null;
  dueDate: string | null;
  daysLate: number;
  stage: PautaStage;
  completedAt: string | null;
  status: FollowupStatus;
  person: { id: string | null; name: string; avatarUrl: string | null } | null;
  /** De onde veio o nome: cobrança registrada, vaga do cronograma ou conclusão no SIOE. */
  personSource: "cobranca" | "cronograma" | "sioe" | null;
  secondPerson: { id: string; name: string; avatarUrl: string | null } | null;
  slotId: string | null;
  contentTitle: string | null;
  published: boolean;
  followups: FollowupEntry[];
};

export type FollowupBoardResponse = {
  month: string;
  today: string;
  goals: {
    pautas: { delivered: number; target: number; awaiting: number; overdue: number };
    posts: { published: number; target: number };
  };
  items: FollowupBoardItem[];
};

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const createFollowupSchema = z.object({
  ci: z.number().int().positive(),
  channel: z.enum(["teams", "email", "whatsapp", "pessoalmente", "outro"]),
  note: z.string().trim().max(2000).nullable().optional(),
  returnDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  sentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  collaboratorId: z.string().uuid().nullable().optional(),
  collaboratorName: z.string().trim().min(1).max(200),
  area: z.string().trim().min(1).max(120),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  slotId: z.string().uuid().nullable().optional(),
});
export type CreateFollowupInput = z.infer<typeof createFollowupSchema>;

function adminDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ContentScheduleHttpError("Serviço do cronograma indisponível.", 503, "SERVICE_UNAVAILABLE");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function requireManager() {
  const actor = await requireContentScheduleActor();
  if (!actor.access.manageAll) throw new ContentScheduleHttpError("Ação exclusiva do Marketing.", 403, "FORBIDDEN");
  return actor;
}

// Nomes de área do VIOS/SIOE que diferem dos usados no cronograma.
const SIOE_AREA_ALIASES: Record<string, string> = {
  controladoria: "Operações Legais",
  insolvência: "Reestruturação",
  contratos: "Societário e Contratos",
};

function sioeAreaLabel(area: string | null): string {
  if (!area) return "Não informado";
  const alias = SIOE_AREA_ALIASES[area.trim().toLocaleLowerCase("pt-BR")];
  return alias ?? resolveContentScheduleAreaLabel(area) ?? area;
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function loadSioeTasks(from: string, to: string): Promise<SioeTaskRow[]> {
  let sioe: SupabaseClient;
  try {
    sioe = getSioeClient();
  } catch {
    throw new ContentScheduleHttpError("O SIOE não está configurado neste ambiente.", 503, "SIOE_UNAVAILABLE");
  }
  const rows: SioeTaskRow[] = [];
  for (let page = 0; page < 10; page += 1) {
    const { data, error } = await sioe.from("sp_tarefas_historico")
      .select("ci,ci_processo,cliente,tarefa,tarefa_pai,status,data_conclusao,data_para_conclusao,responsavel,usuario_conclusao,area_conclusao")
      .or(`tarefa.eq.${MARKETING_PAUTA_TASK},tarefa_pai.eq.${MARKETING_PAUTA_TASK}`)
      .gte("data_para_conclusao", from)
      .lte("data_para_conclusao", to)
      .order("ci")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new ContentScheduleHttpError("Não foi possível ler as pautas no SIOE.", 502, "SIOE_READ_FAILED");
    rows.push(...((data ?? []) as SioeTaskRow[]));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

export async function getContentScheduleFollowups(rawMonth?: string): Promise<FollowupBoardResponse> {
  await requireManager();
  const parsedMonth = monthSchema.safeParse(rawMonth ?? currentSaoPauloMonth());
  if (!parsedMonth.success) throw new ContentScheduleHttpError("Mês inválido.", 400, "INVALID_MONTH");
  const month = parsedMonth.data;
  const today = currentSaoPauloDate();
  const { start, end } = monthBounds(month);

  // Revisão e protocolo vencem alguns dias depois da principal; a janela cobre os dois lados.
  const tasks = await loadSioeTasks(shiftDate(start, -150), shiftDate(end, 15));
  const allPautas = buildPautas(tasks);
  const board = pautasForBoard(allPautas, month, today);

  const db = adminDb();
  const relatedCis = [...new Set(board.flatMap((pauta) => pauta.relatedCis.map(String)))];
  const { data: viosRows, error: viosError } = relatedCis.length
    ? await db.from("vios_tasks").select("id,vios_id,assignee_id").in("vios_id", relatedCis)
    : { data: [], error: null };
  if (viosError) throw new ContentScheduleHttpError("Não foi possível carregar as tarefas do VIOS.");
  const viosByCi = new Map((viosRows ?? []).map((task) => [String(task.vios_id), task]));
  const viosIds = (viosRows ?? []).map((task) => task.id as string);

  const [slotsResult, followupsResult, postsResult, postsTarget] = await Promise.all([
    viosIds.length
      ? db.from("content_schedule_slots")
          .select("id,area,format,collaborator_id,co_collaborator_id,vios_task_id,content_roteiro_id,instagram_post_id,cancelled")
          .in("vios_task_id", viosIds)
      : Promise.resolve({ data: [], error: null }),
    board.length
      ? db.from("content_schedule_followups")
          .select("id,vios_ci,channel,note,return_due,sent_at,sent_by_name,collaborator_id,collaborator_name")
          .in("vios_ci", board.map((pauta) => pauta.ci))
          .order("sent_at")
      : Promise.resolve({ data: [], error: null }),
    db.from("instagram_posts").select("id", { count: "exact", head: true })
      .gte("published_at", `${start}T00:00:00-03:00`).lte("published_at", `${end}T23:59:59-03:00`),
    fetchInstagramMonthlyGoal(),
  ]);
  if (slotsResult.error || followupsResult.error) throw new ContentScheduleHttpError("Não foi possível carregar o acompanhamento.");

  const slots = (slotsResult.data ?? []).filter((slot) => !slot.cancelled);
  const slotByViosId = new Map(slots.map((slot) => [slot.vios_task_id as string, slot]));
  const roteiroIds = slots.map((slot) => slot.content_roteiro_id).filter(Boolean) as string[];
  const personIds = [...new Set([
    ...slots.flatMap((slot) => [slot.collaborator_id, slot.co_collaborator_id]),
    ...(viosRows ?? []).map((task) => task.assignee_id),
    ...(followupsResult.data ?? []).map((entry) => entry.collaborator_id),
  ].filter(Boolean))] as string[];
  const [roteirosResult, usersResult] = await Promise.all([
    roteiroIds.length ? db.from("content_roteiros").select("id,title").in("id", roteiroIds) : Promise.resolve({ data: [], error: null }),
    personIds.length ? db.from("users").select("id,name,avatar_url").in("id", personIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const roteiros = new Map((roteirosResult.data ?? []).map((item) => [item.id as string, item.title as string | null]));
  const users = new Map((usersResult.data ?? []).map((user) => [user.id as string, user]));

  const chasedByCi = new Map<number, { id: string | null; name: string }>();
  const followupsByCi = new Map<number, FollowupEntry[]>();
  for (const entry of followupsResult.data ?? []) {
    const ci = Number(entry.vios_ci);
    chasedByCi.set(ci, { id: entry.collaborator_id ?? null, name: entry.collaborator_name });
    followupsByCi.set(ci, [...(followupsByCi.get(ci) ?? []), {
      id: entry.id, channel: entry.channel as FollowupChannel, note: entry.note, returnDue: entry.return_due,
      sentAt: entry.sent_at, sentByName: entry.sent_by_name,
    }]);
  }

  const items: FollowupBoardItem[] = board.map((pauta) => {
    const linked = pauta.relatedCis.map((ci) => viosByCi.get(String(ci))).filter(Boolean);
    const slot = linked.map((task) => slotByViosId.get(task!.id as string)).find(Boolean) ?? null;
    const assigneeId = slot?.collaborator_id ?? linked.find((task) => task!.assignee_id)?.assignee_id ?? null;
    const user = assigneeId ? users.get(assigneeId) : null;
    // O SIOE só informa o nome depois da conclusão, e o vínculo da vaga com a tarefa é automático.
    // Por isso o nome confirmado por quem cobrou vem primeiro.
    const chased = chasedByCi.get(pauta.ci);
    const chasedUser = chased?.id ? users.get(chased.id) : null;
    const person = chased
      ? { id: chased.id, name: chased.name, avatarUrl: (chasedUser?.avatar_url as string | null) ?? null }
      : user
        ? { id: user.id as string, name: user.name as string, avatarUrl: (user.avatar_url as string | null) ?? null }
        : pauta.completedBy ? { id: null, name: pauta.completedBy, avatarUrl: null } : null;
    const personSource = chased ? "cobranca" as const : user ? "cronograma" as const : pauta.completedBy ? "sioe" as const : null;
    const second = slot?.co_collaborator_id ? users.get(slot.co_collaborator_id) : null;
    const followups = followupsByCi.get(pauta.ci) ?? [];
    const late = pauta.stage === "aguardando_envio" && pauta.dueDate && pauta.dueDate < today;
    return {
      ci: pauta.ci,
      viosUrl: `https://bp.vios.com.br/?pag=sys/processos/pxe.php&pxe_id=${pauta.ci}`,
      area: slot?.area
        ? resolveContentScheduleAreaLabel(slot.area) ?? slot.area
        : sioeAreaLabel(pauta.sioeArea),
      format: (slot?.format as "post" | "reel" | undefined) ?? null,
      dueDate: pauta.dueDate,
      daysLate: late ? daysBetween(pauta.dueDate!, today) : 0,
      stage: pauta.stage,
      completedAt: pauta.completedAt,
      status: followupStatus(pauta, followups, today),
      person,
      personSource,
      secondPerson: second ? { id: second.id as string, name: second.name as string, avatarUrl: (second.avatar_url as string | null) ?? null } : null,
      slotId: slot?.id ?? null,
      contentTitle: slot?.content_roteiro_id ? roteiros.get(slot.content_roteiro_id) ?? null : null,
      published: Boolean(slot?.instagram_post_id),
      followups,
    };
  });

  const monthPautas = allPautas.filter((pauta) => pauta.stage !== "cancelada" && pauta.dueDate && pauta.dueDate >= start && pauta.dueDate <= end);
  return {
    month,
    today,
    goals: {
      pautas: {
        delivered: countDeliveredInMonth(allPautas, month),
        target: PAUTAS_GOAL_PER_MONTH,
        awaiting: monthPautas.filter((pauta) => pauta.stage === "aguardando_envio").length,
        overdue: items.filter((item) => item.daysLate > 0).length,
      },
      posts: { published: postsResult.count ?? 0, target: postsTarget },
    },
    items,
  };
}

export async function createContentScheduleFollowup(input: CreateFollowupInput): Promise<{ id: string }> {
  const actor = await requireManager();
  const db = adminDb();
  const { data: profile } = await db.from("users").select("name").eq("id", actor.profileId).maybeSingle();
  const today = currentSaoPauloDate();
  const sentOn = input.sentOn && input.sentOn <= today ? input.sentOn : today;
  const { data, error } = await db.from("content_schedule_followups").insert({
    vios_ci: input.ci,
    slot_id: input.slotId ?? null,
    collaborator_id: input.collaboratorId ?? null,
    collaborator_name: input.collaboratorName,
    area: input.area,
    due_date: input.dueDate ?? null,
    channel: input.channel,
    note: input.note?.trim() || null,
    return_due: input.returnDue ?? null,
    sent_at: sentOn === today ? new Date().toISOString() : `${sentOn}T12:00:00-03:00`,
    sent_by_id: actor.profileId,
    sent_by_name: profile?.name ?? null,
  }).select("id").single();
  if (error || !data) throw new ContentScheduleHttpError("Não foi possível registrar a cobrança.");
  return { id: data.id as string };
}

export async function deleteContentScheduleFollowup(id: string): Promise<void> {
  await requireManager();
  if (!z.string().uuid().safeParse(id).success) throw new ContentScheduleHttpError("Registro inválido.", 400, "INVALID_ID");
  const { error } = await adminDb().from("content_schedule_followups").delete().eq("id", id);
  if (error) throw new ContentScheduleHttpError("Não foi possível excluir o registro.");
}
