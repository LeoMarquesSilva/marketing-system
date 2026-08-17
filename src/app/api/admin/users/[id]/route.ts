import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/api-auth";

const ALLOWED_FIELDS = new Set([
  "name",
  "email",
  "department",
  "avatar_url",
  "photo_onedrive_url",
  "photo_collected",
  "photo_collected_at",
  "is_active",
]);
const USER_SELECT =
  "id, name, email, department, avatar_url, photo_onedrive_url, photo_collected, photo_collected_at, is_active";

type RouteContext = { params: Promise<{ id: string }> };

async function requireAdminClient() {
  const authUser = await requireAuthenticatedUser();
  await requireAdminUser(authUser.id);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Service role não configurada.");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function cleanUpdates(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Payload inválido.");
  }
  const input = body as Record<string, unknown>;
  const unknownFields = Object.keys(input).filter((field) => !ALLOWED_FIELDS.has(field));
  if (unknownFields.length > 0) {
    throw new Error(`Campos não permitidos: ${unknownFields.join(", ")}.`);
  }

  const updates: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(input)) {
    if (field === "photo_collected" || field === "is_active") {
      if (typeof value !== "boolean") throw new Error(`Campo ${field} inválido.`);
      updates[field] = value;
      continue;
    }
    if (value !== null && typeof value !== "string") {
      throw new Error(`Campo ${field} inválido.`);
    }
    const cleaned = typeof value === "string" ? value.trim() : null;
    if ((field === "name" || field === "department") && !cleaned) {
      throw new Error(field === "name" ? "Nome é obrigatório." : "Área é obrigatória.");
    }
    updates[field] = cleaned || null;
  }
  if (Object.keys(updates).length === 0) throw new Error("Nenhuma alteração informada.");
  return updates;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro na operação.";
  const status =
    message === "Não autenticado."
      ? 401
      : message.includes("administradores") || message === "Usuário inativo."
        ? 403
        : message.includes("inválid") ||
            message.includes("obrigatóri") ||
            message.includes("não permitidos") ||
            message.includes("Nenhuma alteração")
          ? 400
          : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const db = await requireAdminClient();
    const { id } = await context.params;
    const updates = cleanUpdates(await request.json().catch(() => null));
    const { data, error } = await db
      .from("users")
      .update(updates)
      .eq("id", id)
      .select(USER_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ user: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const db = await requireAdminClient();
    const { id } = await context.params;
    const { error } = await db.from("users").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
