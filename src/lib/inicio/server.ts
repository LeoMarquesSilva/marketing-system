import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { getServerDb } from "@/lib/users-server";
import {
  VISTAGEM_JURIDICO_PATH,
  VISTAGEM_KEY,
  canSeeHome,
  papelVistagem,
} from "@/lib/access-control";
import { resolveEmployeeAvatarUrl } from "@/lib/ferias/filters";
import { FESTA_10_ANOS_EVENT_ID, FESTA_10_ANOS_PATH } from "@/lib/event-rsvp";
import { getRsvpPending } from "@/lib/event-rsvp-server";
import { GOOD_PRACTICES_MANUAL } from "@/lib/rh/boas-praticas/types";
import { loadPeopleDirectory } from "@/lib/rh/people-directory";
import { awardPhotoUrl } from "@/lib/rh/bp-awards/format";
import { getInviteStatus } from "@/lib/rh/bp-awards/server";
import { getSelfRegistration } from "@/lib/rh/registration/self-service";
import { getMyWelcomeLinks } from "@/lib/rh/welcome/server";
import { pendingSurveysForViewer } from "@/lib/pesquisas/server";
import { countPendingReelDeliveries } from "@/lib/reel-deliveries/server";
import { contarAbasDaVistagem } from "@/lib/vistagem/contagens-server";
import { exigirPerfilVistagem } from "@/lib/vistagem/http";
import { canManageBirthdayArts } from "./birthday-arts";
import { artKey, signedArtUrls } from "./birthday-arts-server";
import { celebrationKey } from "./celebrations";
import { celebrationCounts, daysSinceCelebration } from "./celebrations-server";
import { daysUntilAnniversary, todayInBrasilia } from "./dates";
import { sanitizeFavorites } from "./favorites";
import type { HomeBirthday, HomeCelebration, HomeData, HomeNewcomer, HomePending, HomeWorkAnniversary } from "./types";

const LOG = "inicio";
const REELS_APPROVAL_HREF = "/conteudo/aprovacao-reels";
/** Janela dos próximos aniversários. */
const BIRTHDAY_WINDOW_DAYS = 30;
/** Quem entrou nos últimos N dias aparece em "Chegaram há pouco". */
const NEWCOMER_WINDOW_DAYS = 45;
const MAX_LINKS = 8;

export class HomeHttpError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "HomeHttpError";
  }
}

/** Uma parte da tela que falha não derruba as outras: registra e segue com o vazio. */
async function safe<T>(label: string, task: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await task();
  } catch (error) {
    console.error(`[${LOG}] ${label}:`, error instanceof Error ? error.message : error);
    return fallback;
  }
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type ViewerRow = {
  id: string;
  name: string | null;
  department: string | null;
  role: string | null;
  permissions: string[] | null;
  avatar_url: string | null;
  photo_onedrive_url: string | null;
  vistagem_papel: string | null;
  is_active: boolean | null;
  home_favorites: string[] | null;
};

async function loadPending(viewer: ViewerRow): Promise<HomePending[]> {
  const vistagem = papelVistagem(viewer);
  const [awards, surveys, party, registration, reels, publications] = await Promise.all([
    safe("bp awards", getInviteStatus, null),
    safe("pesquisas", pendingSurveysForViewer, []),
    safe("festa", () => getRsvpPending(FESTA_10_ANOS_EVENT_ID), null),
    safe("ficha", getSelfRegistration, null),
    safe("reels", countPendingReelDeliveries, 0),
    vistagem
      ? safe("vistagem", async () => contarAbasDaVistagem(await exigirPerfilVistagem()), null)
      : Promise.resolve(null),
  ]);

  const pending: HomePending[] = [];

  if (registration?.state === "ready" && registration.form?.status === "pendente" && registration.form.reopenNote) {
    pending.push({
      id: "ficha",
      kind: "ficha",
      title: "Revisar a sua ficha cadastral",
      detail: "Pessoas e Cultura devolveu a ficha com um pedido de ajuste.",
      href: "/minha-ficha",
      deadline: null,
      count: null,
    });
  }
  if (party?.pending) {
    pending.push({
      id: "festa",
      kind: "festa",
      title: "Confirmar presença na festa de 10 anos",
      detail: null,
      href: FESTA_10_ANOS_PATH,
      deadline: party.closesAt,
      count: null,
    });
  }
  if (awards?.pending) {
    pending.push({
      id: "bp-awards",
      kind: "bp-awards",
      title: "Votar no BP Awards",
      detail: awards.total > 0 ? `${awards.filled} de ${awards.total} indicações preenchidas` : null,
      href: "/bp-awards",
      deadline: awards.closesAt,
      count: null,
    });
  }
  for (const survey of surveys) {
    pending.push({
      id: `pesquisa-${survey.slug}`,
      kind: "pesquisa",
      title: `Responder: ${survey.title}`,
      detail: `${survey.question_count} ${survey.question_count === 1 ? "pergunta" : "perguntas"}${survey.anonymous ? " · resposta anônima" : ""}`,
      href: `/pesquisa/${survey.slug}`,
      deadline: survey.closes_at,
      count: null,
    });
  }
  if (reels > 0) {
    pending.push({
      id: "reels",
      kind: "reels",
      title: reels === 1 ? "1 reel esperando você" : `${reels} reels esperando você`,
      detail: null,
      href: REELS_APPROVAL_HREF,
      deadline: null,
      count: reels,
    });
  }
  if (publications && vistagem === "juridico" && publications.vistagem > 0) {
    pending.push({
      id: "vistagem",
      kind: "vistagem",
      title: publications.vistagem === 1 ? "1 publicação para vistar" : `${publications.vistagem} publicações para vistar`,
      detail: null,
      href: VISTAGEM_JURIDICO_PATH,
      deadline: null,
      count: publications.vistagem,
    });
  }
  if (publications && vistagem === "controladoria") {
    const total = publications.triagem + publications.duplicidades + publications.conferencia + publications.check;
    if (total > 0) {
      pending.push({
        id: "vistagem",
        kind: "vistagem",
        title: total === 1 ? "1 publicação nas filas da Vistagem" : `${total} publicações nas filas da Vistagem`,
        detail: null,
        href: VISTAGEM_KEY,
        deadline: null,
        count: total,
        breakdown: [
          { label: "Triagem", value: publications.triagem },
          { label: "Duplicidades", value: publications.duplicidades },
          { label: "Conferência", value: publications.conferencia },
          { label: "Check", value: publications.check },
        ],
      });
    }
  }
  return pending;
}

type EmployeeDates = { id: string; birth_date: string | null; admission_date: string | null };

async function loadTeam(db: SupabaseClient, today: string, viewerId: string) {
  const [directory, datesResult] = await Promise.all([
    loadPeopleDirectory(db, LOG),
    db.from("hr_employees").select("id, birth_date, admission_date").eq("is_active", true),
  ]);
  if (datesResult.error) throw new Error(datesResult.error.message);

  const active = new Map(directory.filter((person) => person.is_active).map((person) => [person.id, person]));
  const newcomerFrom = addDays(today, -NEWCOMER_WINDOW_DAYS);
  const birthdays: HomeBirthday[] = [];
  const newcomers: HomeNewcomer[] = [];
  const workAnniversaries: HomeWorkAnniversary[] = [];
  const recentCelebrations: HomeCelebration[] = [];
  const social = { likes: 0, liked: false, comments: 0 };
  /** Ano em que a comemoração cai (a arte é por ano). */
  const yearIn = (inDays: number) => Number(addDays(today, inDays).slice(0, 4));

  for (const row of (datesResult.data ?? []) as EmployeeDates[]) {
    const person = active.get(row.id);
    if (!person) continue;
    const base = {
      id: person.id,
      name: person.short_name,
      department: person.department,
      position: person.position,
      // As fotos institucionais têm 4000 px: a tela pede a versão reduzida.
      avatarUrl: awardPhotoUrl(person.avatar_url, 96),
    };
    if (row.birth_date) {
      const inDays = daysUntilAnniversary(row.birth_date, today);
      if (inDays !== null && inDays <= BIRTHDAY_WINDOW_DAYS) {
        birthdays.push({
          ...base,
          ...social,
          kind: "aniversario",
          year: yearIn(inDays),
          day: Number(row.birth_date.slice(8, 10)),
          month: Number(row.birth_date.slice(5, 7)),
          inDays,
          years: null,
          artUrl: null,
        });
      }
      const since = daysSinceCelebration(row.birth_date, today);
      if (since && since.daysAgo >= 1) {
        recentCelebrations.push({
          ...base,
          ...social,
          kind: "aniversario",
          year: since.year,
          day: Number(row.birth_date.slice(8, 10)),
          month: Number(row.birth_date.slice(5, 7)),
          inDays: -since.daysAgo,
          years: null,
          artUrl: null,
        });
      }
    }
    if (row.admission_date && row.admission_date < today) {
      const inDays = daysUntilAnniversary(row.admission_date, today);
      const years = inDays === null ? 0 : yearIn(inDays) - Number(row.admission_date.slice(0, 4));
      if (inDays !== null && inDays <= BIRTHDAY_WINDOW_DAYS && years >= 1) {
        workAnniversaries.push({
          ...base,
          ...social,
          kind: "empresa",
          year: yearIn(inDays),
          day: Number(row.admission_date.slice(8, 10)),
          month: Number(row.admission_date.slice(5, 7)),
          inDays,
          years,
          artUrl: null,
        });
      }
      const since = daysSinceCelebration(row.admission_date, today);
      const yearsSince = since ? since.year - Number(row.admission_date.slice(0, 4)) : 0;
      if (since && since.daysAgo >= 1 && yearsSince >= 1) {
        recentCelebrations.push({
          ...base,
          ...social,
          kind: "empresa",
          year: since.year,
          day: Number(row.admission_date.slice(8, 10)),
          month: Number(row.admission_date.slice(5, 7)),
          inDays: -since.daysAgo,
          years: yearsSince,
          artUrl: null,
        });
      }
    }
    if (row.admission_date && row.admission_date >= newcomerFrom && row.admission_date <= today) {
      newcomers.push({ ...base, since: row.admission_date });
    }
  }

  birthdays.sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name, "pt-BR"));
  newcomers.sort((a, b) => b.since.localeCompare(a.since) || a.name.localeCompare(b.name, "pt-BR"));
  workAnniversaries.sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name, "pt-BR"));

  // Mais recentes primeiro.
  recentCelebrations.sort((a, b) => b.inDays - a.inDays || a.name.localeCompare(b.name, "pt-BR"));

  const all: HomeCelebration[] = [...birthdays, ...workAnniversaries, ...recentCelebrations];
  const targets = all.map((item) => ({ employeeId: item.id, kind: item.kind, year: item.year }));
  const [arts, counts] = await Promise.all([signedArtUrls(db, targets), celebrationCounts(db, targets, viewerId)]);
  for (const item of all) {
    item.artUrl = arts.get(artKey(item.id, item.kind, item.year)) ?? null;
    const count = counts.get(celebrationKey({ employeeId: item.id, kind: item.kind, year: item.year }));
    if (count) Object.assign(item, count);
  }
  return { birthdays, newcomers, workAnniversaries, recentCelebrations, teamSize: active.size };
}

/** Tudo o que a tela inicial mostra para quem está logado. */
export async function getHomeData(): Promise<HomeData> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new HomeHttpError("Não autenticado.", 401);

  const db = (await getServerDb()) as SupabaseClient;
  const { data: viewerData } = await db
    .from("users")
    .select("id, name, department, role, permissions, avatar_url, photo_onedrive_url, vistagem_papel, is_active, home_favorites")
    .eq("auth_id", user.id)
    .maybeSingle();
  const viewer = viewerData as ViewerRow | null;
  if (!viewer || viewer.is_active === false) throw new HomeHttpError("Usuário não encontrado.", 404);
  // Em lançamento só admin; consultores liberados só no PE27 nunca veem dados da equipe.
  if (!canSeeHome(viewer)) throw new HomeHttpError("Sem acesso à tela inicial.", 403);

  const today = todayInBrasilia();

  const { data: employeeData } = await db
    .from("hr_employees")
    .select("id, full_name, department, position, admission_date, birth_date")
    .eq("user_id", viewer.id)
    .eq("is_active", true)
    .maybeSingle();
  const employee = employeeData as {
    id: string;
    full_name: string;
    department: string | null;
    position: string | null;
    admission_date: string | null;
    birth_date: string | null;
  } | null;

  const [pending, team, links, leaveResult, recessResult, partyResult] = await Promise.all([
    loadPending(viewer),
    safe<{
      birthdays: HomeBirthday[];
      newcomers: HomeNewcomer[];
      workAnniversaries: HomeWorkAnniversary[];
      recentCelebrations: HomeCelebration[];
      teamSize: number | null;
    }>(
      "equipe",
      () => loadTeam(db, today, viewer.id),
      { birthdays: [], newcomers: [], workAnniversaries: [], recentCelebrations: [], teamSize: null }
    ),
    safe("links", async () => (await getMyWelcomeLinks()).groups.flatMap((group) => group.links), []),
    employee
      ? db
          .from("vacation_leaves")
          .select("start_date, end_date, days, kind")
          .eq("employee_id", employee.id)
          // O recesso coletivo já aparece na linha "Recesso do escritório".
          .neq("kind", "recesso")
          .gte("end_date", today)
          .order("start_date")
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db.from("company_recess").select("start_date, end_date, days").gte("end_date", today).order("start_date").limit(1).maybeSingle(),
    db.from("events").select("name, event_date, location").eq("id", FESTA_10_ANOS_EVENT_ID).maybeSingle(),
  ]);

  const leave = leaveResult.data as { start_date: string; end_date: string; days: number; kind: string } | null;
  const recess = recessResult.data as { start_date: string; end_date: string; days: number } | null;
  const party = partyResult.data as { name: string; event_date: string | null; location: string | null } | null;
  const name = (employee?.full_name ?? viewer.name ?? "").trim();

  return {
    today,
    me: {
      name,
      firstName: name.split(/\s+/)[0] ?? "",
      position: employee?.position ?? null,
      department: employee?.department ?? viewer.department,
      avatarUrl: awardPhotoUrl(resolveEmployeeAvatarUrl(viewer.avatar_url, viewer.photo_onedrive_url), 192),
      admissionDate: employee?.admission_date ?? null,
      birthdayToday: employee?.birth_date ? daysUntilAnniversary(employee.birth_date, today) === 0 : false,
    },
    pending,
    nextLeave: leave ? { start: leave.start_date, end: leave.end_date, days: leave.days, kind: leave.kind } : null,
    nextRecess: recess ? { start: recess.start_date, end: recess.end_date, days: recess.days } : null,
    party:
      party?.event_date && party.event_date.slice(0, 10) >= today
        ? { name: party.name, date: party.event_date.slice(0, 10), location: party.location }
        : null,
    teamSize: team.teamSize,
    birthdays: team.birthdays,
    newcomers: team.newcomers,
    workAnniversaries: team.workAnniversaries,
    recentCelebrations: team.recentCelebrations,
    canManageBirthdayArts: canManageBirthdayArts(viewer),
    links: links.slice(0, MAX_LINKS),
    favorites: sanitizeFavorites(viewer.home_favorites),
  };
}

/** Grava os favoritos da tela inicial na conta de quem está logado e devolve a lista salva. */
export async function saveHomeFavorites(input: unknown): Promise<string[]> {
  const favorites = sanitizeFavorites(input);
  if (!favorites) throw new HomeHttpError("Lista de favoritos inválida.", 400);

  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new HomeHttpError("Não autenticado.", 401);

  const db = (await getServerDb()) as SupabaseClient;
  const { data: viewer } = await db.from("users").select("id, role, permissions, is_active").eq("auth_id", user.id).maybeSingle();
  if (!viewer || viewer.is_active === false) throw new HomeHttpError("Usuário não encontrado.", 404);
  if (!canSeeHome(viewer as { role: string | null; permissions: string[] | null })) {
    throw new HomeHttpError("Sem acesso à tela inicial.", 403);
  }

  const { data, error } = await db
    .from("users")
    .update({ home_favorites: favorites })
    .eq("id", viewer.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(`[${LOG}] favoritos:`, error.message);
    throw new HomeHttpError("Não foi possível salvar os favoritos.", 500);
  }
  if (!data) throw new HomeHttpError("Usuário não encontrado.", 404);
  return favorites;
}

/** Validade do link assinado do manual (o PDF abre na hora; não é para guardar o link). */
const MANUAL_URL_SECONDS = 10 * 60;

/**
 * Link assinado do Manual de Boas Práticas para qualquer pessoa da equipe logada
 * (na tela de Boas práticas o mesmo arquivo abre só para o RH, junto dos feedbacks).
 */
export async function homeGoodPracticesManualUrl(): Promise<string> {
  const ssr = await createSsrClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) throw new HomeHttpError("Não autenticado.", 401);

  const db = (await getServerDb()) as SupabaseClient;
  const { data: viewer } = await db.from("users").select("id, role, permissions, is_active").eq("auth_id", user.id).maybeSingle();
  if (!viewer || viewer.is_active === false) throw new HomeHttpError("Usuário não encontrado.", 404);
  if (!canSeeHome(viewer as { role: string | null; permissions: string[] | null })) {
    throw new HomeHttpError("Sem acesso ao manual.", 403);
  }

  const { data, error } = await db.storage
    .from(GOOD_PRACTICES_MANUAL.bucket)
    .createSignedUrl(GOOD_PRACTICES_MANUAL.path, MANUAL_URL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error(`[${LOG}] manual:`, error?.message);
    throw new HomeHttpError("O manual não está disponível agora.", 404);
  }
  return data.signedUrl;
}
