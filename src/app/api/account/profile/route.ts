import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser } from "@/lib/api-auth";

const ALLOWED_FIELDS = new Set(["name", "email", "department", "avatar_url"]);
const PROFILE_SELECT = "id, name, email, department, avatar_url, is_active";

function cleanOptionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Valor de perfil inválido.");
  return value.trim() || null;
}

export async function PATCH(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const unknownFields = Object.keys(body).filter((field) => !ALLOWED_FIELDS.has(field));
    if (unknownFields.length > 0) {
      return NextResponse.json(
        { error: `Campos não permitidos: ${unknownFields.join(", ")}.` },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;
    const updates: Record<string, string | null> = {};
    if ("name" in input) {
      const name = cleanOptionalText(input.name);
      if (!name) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
      updates.name = name;
    }
    if ("email" in input) updates.email = cleanOptionalText(input.email);
    if ("department" in input) {
      const department = cleanOptionalText(input.department);
      if (!department) {
        return NextResponse.json({ error: "Área é obrigatória." }, { status: 400 });
      }
      updates.department = department;
    }
    if ("avatar_url" in input) updates.avatar_url = cleanOptionalText(input.avatar_url);
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nenhuma alteração informada." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) throw new Error("Service role não configurada.");

    const db = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await db
      .from("users")
      .update(updates)
      .eq("auth_id", authUser.id)
      .select(PROFILE_SELECT)
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ user: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar perfil.";
    const status =
      message === "Não autenticado." ? 401 : message === "Usuário inativo." ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
