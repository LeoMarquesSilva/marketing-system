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
import {
  personInAreas,
  resolveTeamAreaOptions,
  resolveTeamPostsAccess,
  scopeTeamPosts,
  type TeamAreaOption,
  type TeamPerson,
} from "@/lib/team-posts/domain";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

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

export async function loadTeamPostsPageData(): Promise<TeamPostsPageData> {
  try {
    const db = adminDb();
    const access = await resolveActorAccess(db);
    if (!access?.allowed) return { status: "denied" };

    const [allPosts, people, accountStats] = await Promise.all([
      fetchInstagramPosts(),
      loadActivePeople(db),
      fetchLatestAccountStats().catch(() => null),
    ]);

    const areaOptions = resolveTeamAreaOptions(access, allPosts.flatMap(getPostAreas));
    const areaKeys = new Set(areaOptions.map((option) => option.key));
    const members = people.filter((person) => personInAreas(person, areaKeys));
    const posts = scopeTeamPosts(
      allPosts,
      access.areas === null ? null : areaKeys,
      new Set(members.map((member) => member.id))
    );

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
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Não foi possível carregar as postagens.",
    };
  }
}
