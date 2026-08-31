import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { normalizePermissionsInput } from "@/lib/access-control";
import { resolveFeriasAccess, type FeriasAccessMode } from "@/lib/ferias/access";
import { resolveCanonicalAreaLabel } from "@/lib/ferias/filters";
import {
  listAreaManagerAreasForUser,
  listKnownAreas,
  replaceAreaManagersForUser,
} from "@/lib/email-area-managers-server";
import type { UserAuthActivity } from "@/lib/users-auth-activity";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const DEFAULT_PASSWORD = "123456";

function admin() {
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(supabaseUrl, serviceKey);
}

async function ensureAdmin(): Promise<{ error?: Response; authUserId?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .maybeSingle();
  if ((profile?.role as string | null)?.toLowerCase?.() !== "admin") {
    return { error: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
  }
  return { authUserId: user.id };
}

function mapAuthActivity(authUser: {
  created_at?: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
}): UserAuthActivity {
  return {
    account_created_at: authUser.created_at ?? null,
    last_sign_in_at: authUser.last_sign_in_at ?? null,
    email_confirmed_at: authUser.email_confirmed_at ?? null,
  };
}

async function getAuthActivityForUser(userId: string): Promise<UserAuthActivity | null> {
  const db = admin();
  const { data: u, error } = await db
    .from("users")
    .select("auth_id")
    .eq("id", userId)
    .single();
  if (error || !u?.auth_id) return null;

  const { data: authUser, error: authError } = await db.auth.admin.getUserById(u.auth_id);
  if (authError || !authUser.user) return null;
  return mapAuthActivity(authUser.user);
}

async function getFeriasAccessForUser(userId: string) {
  const db = admin();
  const [userResult, employeeResult, departmentsResult] = await Promise.all([
    db
      .from("users")
      .select("ferias_access_mode, ferias_area_scope, ferias_view_enabled")
      .eq("id", userId)
      .single(),
    db
      .from("hr_employees")
      .select("position, department")
      .eq("user_id", userId)
      .maybeSingle(),
    db.from("hr_employees").select("department").not("department", "is", null),
  ]);

  if (userResult.error) throw new Error(userResult.error.message);
  if (employeeResult.error) throw new Error(employeeResult.error.message);
  if (departmentsResult.error) throw new Error(departmentsResult.error.message);

  const automatic = resolveFeriasAccess({
    role: null,
    permissions: [],
    accessMode: "auto",
    areaScope: null,
    position: employeeResult.data?.position as string | null | undefined,
    department: employeeResult.data?.department as string | null | undefined,
  });
  const availableAreas = [
    ...new Set(
      (departmentsResult.data ?? [])
        .map((row) => resolveCanonicalAreaLabel(row.department as string | null))
        .filter((area): area is string => Boolean(area))
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return {
    mode: (userResult.data.ferias_access_mode ?? "auto") as FeriasAccessMode,
    areas: (userResult.data.ferias_area_scope as string[] | null) ?? [],
    enabled: Boolean(userResult.data.ferias_view_enabled),
    automaticEligible: automatic.level === "viewer",
    automaticAreas: automatic.areas ?? [],
    position: (employeeResult.data?.position as string | null | undefined) ?? null,
    department: (employeeResult.data?.department as string | null | undefined) ?? null,
    availableAreas,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }

    const [authActivity, feriasAccess, managerAreas, availableManagerAreas] = await Promise.all([
      getAuthActivityForUser(userId),
      getFeriasAccessForUser(userId),
      listAreaManagerAreasForUser(userId),
      listKnownAreas(),
    ]);
    return NextResponse.json({
      auth_activity: authActivity,
      ferias_access: feriasAccess,
      area_managers: { areas: managerAreas, availableAreas: availableManagerAreas },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao buscar atividade.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const { action, userId } = body as { action?: string; userId?: string };
    if (!action && "name" in body && "department" in body) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const department = typeof body.department === "string" ? body.department.trim() : "";
      if (!name || !department) {
        return NextResponse.json(
          { error: "Nome e área são obrigatórios." },
          { status: 400 }
        );
      }

      const email = typeof body.email === "string" ? body.email.trim() || null : null;
      const avatarUrl =
        typeof body.avatar_url === "string" ? body.avatar_url.trim() || null : null;
      const db = admin();
      const { data, error } = await db
        .from("users")
        .insert({
          id: crypto.randomUUID(),
          name,
          email,
          department,
          avatar_url: avatarUrl,
          is_active: true,
        })
        .select("id, name, email, department, avatar_url, is_active")
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ user: data }, { status: 201 });
    }

    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }

    const db = admin();
    const { data: u, error: uErr } = await db
      .from("users")
      .select("id, name, email, auth_id")
      .eq("id", userId)
      .single();
    if (uErr || !u) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    if (action === "activate") {
      const email = ((body.email as string | undefined) ?? u.email ?? "").trim();
      if (!email) {
        return NextResponse.json(
          { error: "E-mail é obrigatório para ativar o acesso." },
          { status: 400 }
        );
      }

      if (u.auth_id) {
        // Já tem login: redefine para a senha padrão e força troca.
        const { error: updErr } = await db.auth.admin.updateUserById(u.auth_id, {
          password: DEFAULT_PASSWORD,
        });
        if (updErr) throw new Error(updErr.message);
        await db
          .from("users")
          .update({
            email,
            is_active: true,
            must_change_password: true,
            content_tutorial_completed_at: null,
          })
          .eq("id", userId);
        const auth_activity = await getAuthActivityForUser(userId);
        return NextResponse.json({ success: true, reset: true, auth_id: u.auth_id, auth_activity });
      }

      // Cria o login no Supabase Auth.
      const { data: created, error: createErr } = await db.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      });
      if (createErr || !created.user) {
        throw new Error(createErr?.message ?? "Falha ao criar o login.");
      }
      const { error: linkErr } = await db
        .from("users")
        .update({
          auth_id: created.user.id,
          email,
          is_active: true,
          must_change_password: true,
          content_tutorial_completed_at: null,
        })
        .eq("id", userId);
      if (linkErr) throw new Error(linkErr.message);
      const auth_activity = mapAuthActivity(created.user);
      return NextResponse.json({
        success: true,
        created: true,
        auth_id: created.user.id,
        auth_activity,
      });
    }

    if (action === "set_access") {
      // Array vazio → null (regra legada). Chaves fora do catálogo são ignoradas.
      const permissions = normalizePermissionsInput(body.permissions);

      // A permissão "/admin" (checkbox "Configurações") é o que os admins usam pra
      // tornar alguém admin — mas várias features (ex.: "Ver todos" em Meus Clientes)
      // checam `role === "admin"` de verdade, não o catálogo de permissões. Mantemos
      // os dois sincronizados aqui pra não repetir o problema do Felipe/Samuel/Wagner.
      // Só mexe em `role` na transição pra/de admin — nunca sobrescreve outros valores
      // de role (ex.: "designer", usado em Planner) que não têm relação com isso.
      const grantsAdmin = permissions?.includes("/admin") ?? false;
      const { data: current } = await db.from("users").select("role").eq("id", userId).single();
      const currentRole = (current?.role as string | null) ?? null;
      const update: Record<string, unknown> = { permissions };
      if (grantsAdmin && currentRole?.toLowerCase() !== "admin") {
        update.role = "admin";
      } else if (!grantsAdmin && currentRole?.toLowerCase() === "admin") {
        update.role = null;
      }

      const { error } = await db.from("users").update(update).eq("id", userId);
      if (error) throw new Error(error.message);
      return NextResponse.json({
        success: true,
        role: update.role ?? currentRole,
        permissions,
      });
    }

    if (action === "set_ferias_access") {
      const mode = body.mode as FeriasAccessMode | undefined;
      if (!mode || !["auto", "disabled", "custom"].includes(mode)) {
        return NextResponse.json({ error: "Modo de acesso às férias inválido." }, { status: 400 });
      }

      const rawAreas: string[] = Array.isArray(body.areas)
        ? (body.areas as unknown[]).filter(
            (area: unknown): area is string => typeof area === "string"
          )
        : [];
      const areas = rawAreas.includes("*")
        ? ["*"]
        : [
            ...new Set(
              rawAreas
                .map((area) => resolveCanonicalAreaLabel(area))
                .filter((area): area is string => Boolean(area))
            ),
          ];
      if (mode === "custom" && areas.length === 0) {
        return NextResponse.json(
          { error: "Selecione ao menos uma área para o acesso personalizado." },
          { status: 400 }
        );
      }

      const { data: saved, error } = await db
        .from("users")
        .update({
          ferias_access_mode: mode,
          ferias_area_scope: mode === "custom" ? areas : null,
        })
        .eq("id", userId)
        .select("ferias_access_mode, ferias_area_scope, ferias_view_enabled")
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({
        success: true,
        ferias_access_mode: saved.ferias_access_mode,
        ferias_area_scope: saved.ferias_area_scope,
        ferias_view_enabled: saved.ferias_view_enabled,
      });
    }

    if (action === "set_area_managers") {
      const rawAreas: string[] = Array.isArray(body.areas)
        ? (body.areas as unknown[]).filter((area: unknown): area is string => typeof area === "string")
        : [];
      const { data: actor } = auth.authUserId
        ? await db.from("users").select("id").eq("auth_id", auth.authUserId).maybeSingle()
        : { data: null };
      const areas = await replaceAreaManagersForUser({
        userId,
        areas: rawAreas,
        createdByUserId: (actor?.id as string | undefined) ?? null,
      });
      return NextResponse.json({ success: true, areas });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro na operação.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
