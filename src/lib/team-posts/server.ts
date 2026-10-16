import "server-only";

import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSsrClient } from "@/utils/supabase/server";
import { resolveCanonicalAreaLabel } from "@/lib/ferias/filters";
import { computeEngagementActionsFromPost } from "@/lib/instagram-engagement";
import { getPostAreas } from "@/lib/instagram-link-rules";
import {
  fetchInstagramPosts,
  fetchLatestAccountStats,
  type InstagramAccountStats,
  type InstagramPost,
} from "@/lib/instagram-posts";
import { sanitizeInstagramPostsForClient } from "@/lib/instagram-thumbnail-client";
import { CONTENT_BANK_REQUEST_TYPES, REEL_REQUEST_TYPE } from "@/lib/planner-posts";
import { REEL_DELIVERIES_BUCKET } from "@/lib/reel-deliveries/domain";
import {
  personInAreas,
  readyPostTitle,
  resolveTeamAreaOptions,
  resolveTeamPostsAccess,
  scopeReadyItems,
  scopeTeamPosts,
  sortReadyItems,
  type TeamAreaOption,
  type TeamPerson,
  type TeamReadyItem,
} from "@/lib/team-posts/domain";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const COVER_URL_SECONDS = 2 * 60 * 60;

/** Só o necessário para comparar a equipe com a média do escritório. */
export interface TeamPostsOfficePoint {
  published_at: string | null;
  reach: number;
  engagementActions: number;
}

export type TeamPostsPageData =
  | { status: "denied" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      /** Marketing e sócios patrimoniais: todas as áreas. */
      allAreas: boolean;
      areaOptions: TeamAreaOption[];
      members: TeamPerson[];
      posts: InstagramPost[];
      office: TeamPostsOfficePoint[];
      accountStats: InstagramAccountStats | null;
      /** Banco de conteúdo do Planner: finalizados aguardando data. */
      ready: TeamReadyItem[];
    };

function adminDb(): SupabaseClient {
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createAdminClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function resolveActorAccess(db: SupabaseClient) {
  const ssr = await createSsrClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await db.from("users")
    .select("id,role,department,permissions,is_active,ferias_access_mode,ferias_area_scope")
    .eq("auth_id", user.id).maybeSingle();
  if (error) throw new Error("Não foi possível validar seu acesso.");
  if (!profile) return null;

  const { data: employee, error: employeeError } = await db.from("hr_employees")
    .select("position,department")
    .eq("user_id", profile.id)
    .order("is_active", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (employeeError) throw new Error("Não foi possível validar sua área.");

  return resolveTeamPostsAccess({
    isActive: profile.is_active !== false,
    role: profile.role,
    permissions: profile.permissions,
    accessMode: profile.ferias_access_mode,
    areaScope: profile.ferias_area_scope,
    position: employee?.position,
    department: employee?.department ?? profile.department,
  });
}

/** Colaboradores ativos com a área do RH (ou do cadastro, sem ficha). */
async function loadActivePeople(db: SupabaseClient): Promise<TeamPerson[]> {
  const [usersResult, employeesResult, placementsResult] = await Promise.all([
    db.from("users").select("id,name,department,avatar_url,is_active")
      .or("is_active.eq.true,is_active.is.null").order("name"),
    db.from("hr_employees").select("id,user_id,department,is_active").not("user_id", "is", null),
    db.from("org_chart_members").select("employee_id,placement"),
  ]);
  if (usersResult.error || employeesResult.error || placementsResult.error) {
    throw new Error("Não foi possível carregar a equipe.");
  }

  // Quem o RH deixou de fora do organograma de propósito (ex.: robôs) e não
  // ocupa nenhuma outra posição não entra como integrante de equipe.
  const placements = new Map<string, Set<string>>();
  for (const row of placementsResult.data ?? []) {
    const set = placements.get(row.employee_id) ?? new Set<string>();
    set.add(row.placement);
    placements.set(row.employee_id, set);
  }
  const isHidden = (employeeId: string) => {
    const set = placements.get(employeeId);
    return Boolean(set && set.size === 1 && set.has("hidden"));
  };

  const employeeByUser = new Map<string, { id: string; department: string | null; is_active: boolean | null }>();
  for (const employee of employeesResult.data ?? []) {
    const current = employeeByUser.get(employee.user_id);
    if (!current || (current.is_active === false && employee.is_active !== false)) {
      employeeByUser.set(employee.user_id, employee);
    }
  }

  return (usersResult.data ?? []).flatMap((person) => {
    const employee = employeeByUser.get(person.id);
    if (employee?.is_active === false || (employee && isHidden(employee.id))) return [];
    const area = resolveCanonicalAreaLabel(employee?.department ?? person.department);
    if (!area) return [];
    return [{ id: person.id, name: person.name, avatar_url: person.avatar_url ?? null, area }];
  });
}

function safeHttpsUrl(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && /^https:\/\//i.test(trimmed) ? trimmed : null;
}

/**
 * Mesma regra do Banco de conteúdo do Planner (`isInContentBank` e reels
 * "ready"): post/reel com arte concluída e ainda sem data de publicação.
 */
async function loadReadyItems(db: SupabaseClient): Promise<TeamReadyItem[]> {
  const [requestsResult, reelsResult] = await Promise.all([
    db.from("marketing_requests")
      .select("id,title,description,request_type,requesting_area,solicitante,solicitante_id,nome_advogado,art_link,stage_changed_at,delivered_at,requested_at")
      .eq("workflow_stage", "concluido")
      .in("request_type", [...CONTENT_BANK_REQUEST_TYPES])
      .or("completion_type.is.null,completion_type.eq.design_concluido"),
    db.from("reel_deliveries").select("id,area,title,cover_title,cover_path,ready_at,due_date").eq("status", "ready"),
  ]);
  if (requestsResult.error || reelsResult.error) {
    throw new Error("Não foi possível carregar os conteúdos prontos para publicar.");
  }

  const reels = reelsResult.data ?? [];
  const coverPaths = reels.flatMap((reel) => (reel.cover_path ? [reel.cover_path as string] : []));
  const [participantsResult, signedResult] = await Promise.all([
    reels.length
      ? db.from("reel_delivery_participants").select("delivery_id,user_id,user_name")
          .in("delivery_id", reels.map((reel) => reel.id)).order("created_at")
      : Promise.resolve({ data: [], error: null }),
    coverPaths.length
      ? db.storage.from(REEL_DELIVERIES_BUCKET).createSignedUrls(coverPaths, COVER_URL_SECONDS)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const participants = (participantsResult.data ?? []) as Array<{
    delivery_id: string;
    user_id: string;
    user_name: string | null;
  }>;
  const covers = new Map<string, string>();
  for (const item of signedResult.data ?? []) {
    if (item.path && item.signedUrl) covers.set(item.path, item.signedUrl);
  }

  const requests: TeamReadyItem[] = (requestsResult.data ?? []).map((request) => {
    const person = request.nome_advogado || request.solicitante;
    return {
      id: request.id,
      kind: request.request_type === REEL_REQUEST_TYPE ? "reel" : "post",
      title: readyPostTitle(request),
      area: resolveCanonicalAreaLabel(request.requesting_area) ?? "Sem área",
      people: person ? [person] : [],
      personIds: request.solicitante_id ? [request.solicitante_id] : [],
      readySince: request.stage_changed_at ?? request.delivered_at ?? request.requested_at,
      artUrl: safeHttpsUrl(request.art_link),
      thumbUrl: null,
    };
  });

  const reelItems: TeamReadyItem[] = reels.map((reel) => {
    const people = participants.filter((p) => p.delivery_id === reel.id);
    const names = people.map((p) => p.user_name ?? "").filter(Boolean);
    const firstNames = names.map((name) => name.split(" ")[0]);
    return {
      id: reel.id,
      kind: "reel",
      title:
        reel.cover_title?.trim() ||
        reel.title?.trim() ||
        (firstNames.length ? `Reel de ${firstNames.join(" e ")}` : "Reel sem título"),
      area: resolveCanonicalAreaLabel(reel.area) ?? "Sem área",
      people: names,
      personIds: people.map((p) => p.user_id),
      readySince: reel.ready_at ?? reel.due_date,
      artUrl: null,
      thumbUrl: reel.cover_path ? covers.get(reel.cover_path) ?? null : null,
    };
  });

  return [...requests, ...reelItems];
}

export async function loadTeamPostsPageData(): Promise<TeamPostsPageData> {
  try {
    const db = adminDb();
    const access = await resolveActorAccess(db);
    if (!access?.allowed) return { status: "denied" };

    const [allPosts, people, accountStats, allReady] = await Promise.all([
      fetchInstagramPosts(),
      loadActivePeople(db),
      fetchLatestAccountStats().catch(() => null),
      loadReadyItems(db),
    ]);

    const areaOptions = resolveTeamAreaOptions(access, [
      ...allPosts.flatMap(getPostAreas),
      ...allReady.map((item) => item.area),
    ]);
    const areaKeys = new Set(areaOptions.map((option) => option.key));
    const members = people.filter((person) => personInAreas(person, areaKeys));
    const scopeKeys = access.areas === null ? null : areaKeys;
    const memberIds = new Set(members.map((member) => member.id));
    const posts = scopeTeamPosts(allPosts, scopeKeys, memberIds);

    return {
      status: "ready",
      allAreas: access.areas === null,
      areaOptions,
      members,
      posts: sanitizeInstagramPostsForClient(posts),
      office: allPosts.map((post) => ({
        published_at: post.published_at,
        reach: post.reach,
        engagementActions: computeEngagementActionsFromPost(post),
      })),
      accountStats,
      ready: sortReadyItems(scopeReadyItems(allReady, scopeKeys, memberIds)),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Não foi possível carregar as postagens.",
    };
  }
}
