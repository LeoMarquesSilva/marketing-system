import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hashSetupToken, isSetupTokenFormat, setupTokenStatus, type SetupTokenStatus } from "@/lib/account-setup-token";
import { validateNewPassword } from "@/lib/password-rules";

/**
 * Primeiro acesso de colaborador novo (/primeiro-acesso): o link do e-mail de
 * boas-vindas leva a pessoa a criar a própria senha. Abrir a página só consulta
 * o token; ele é gasto ao salvar a senha.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export class FirstAccessError extends Error {
  constructor(
    message: string,
    public status: number,
    public reason?: SetupTokenStatus
  ) {
    super(message);
  }
}

function adminClient(): SupabaseClient {
  if (!serviceKey) throw new FirstAccessError("Service role não configurada.", 500);
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

type TokenRow = { id: string; user_id: string; expires_at: string; used_at: string | null };

async function loadToken(admin: SupabaseClient, token: string): Promise<TokenRow | null> {
  if (!isSetupTokenFormat(token)) return null;
  const { data } = await admin
    .from("account_setup_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", hashSetupToken(token))
    .maybeSingle();
  return (data as TokenRow | null) ?? null;
}

export async function inspectFirstAccess(
  token: string
): Promise<{ status: SetupTokenStatus; firstName: string | null; email: string | null }> {
  const admin = adminClient();
  const row = await loadToken(admin, token);
  const status = setupTokenStatus(row);
  if (status !== "valid" || !row) return { status, firstName: null, email: null };
  const { data: user } = await admin.from("users").select("name, email").eq("id", row.user_id).maybeSingle();
  const name = ((user?.name as string | null) ?? "").trim();
  return { status, firstName: name.split(/\s+/)[0] || null, email: (user?.email as string | null) ?? null };
}

/** Grava a senha e devolve o e-mail de login (a tela entra com ele em seguida). */
export async function completeFirstAccess(token: string, password: string): Promise<{ email: string }> {
  const invalid = validateNewPassword(password);
  if (invalid) throw new FirstAccessError(invalid, 400);

  const admin = adminClient();
  const row = await loadToken(admin, token);
  const status = setupTokenStatus(row);
  if (status !== "valid" || !row) throw new FirstAccessError("Link expirado ou já usado.", 410, status);

  // Marca como usado antes de trocar a senha: dois envios ao mesmo tempo não passam juntos.
  const usedAt = new Date().toISOString();
  const { data: claimed } = await admin
    .from("account_setup_tokens")
    .update({ used_at: usedAt })
    .eq("id", row.id)
    .is("used_at", null)
    .select("id");
  if (!claimed?.length) throw new FirstAccessError("Link expirado ou já usado.", 410, "used");

  const release = () => admin.from("account_setup_tokens").update({ used_at: null }).eq("id", row.id);

  const { data: user } = await admin
    .from("users")
    .select("id, email, auth_id")
    .eq("id", row.user_id)
    .maybeSingle();
  const email = ((user?.email as string | null) ?? "").trim().toLowerCase();
  if (!user || !email) {
    await release();
    throw new FirstAccessError("Usuário não encontrado. Fale com Pessoas e Cultura.", 404);
  }

  let authId = (user.auth_id as string | null) ?? null;
  if (authId) {
    const { error } = await admin.auth.admin.updateUserById(authId, { password, email_confirm: true });
    if (error) {
      await release();
      throw new FirstAccessError(translateAuthError(error.message), 400);
    }
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !created.user) {
      await release();
      throw new FirstAccessError(translateAuthError(error?.message ?? "Não foi possível criar o login."), 400);
    }
    authId = created.user.id;
  }

  await admin
    .from("users")
    .update({ auth_id: authId, is_active: true, must_change_password: false })
    .eq("id", row.user_id);
  return { email };
}

function translateAuthError(message: string): string {
  if (/at least|weak|too short|password/i.test(message)) return "Senha fraca. Use uma senha mais longa, com letras e números.";
  return message;
}
