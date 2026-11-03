import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PUBLIC_APP_ORIGIN } from "@/lib/public-origin";
import { enviarEmailMicrosoft, microsoftMailConfigurado } from "@/lib/microsoft-mail";
import { buildPasswordResetEmail, passwordResetLink } from "@/lib/password-reset-email";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Um e-mail por pessoa a cada minuto (cada link novo invalida o anterior). */
const RESEND_INTERVAL_MS = 60_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mesma resposta para e-mail sem conta, usuário inativo ou pedido repetido: não revela quem tem acesso. */
const ACCEPTED = { success: true };

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Em produção o link usa sempre o domínio público, nunca o Host da requisição. */
function linkOrigin(request: Request): string {
  if (process.env.NODE_ENV !== "production") return new URL(request.url).origin;
  return (process.env.MARKETING_PUBLIC_URL || PUBLIC_APP_ORIGIN).replace(/\/+$/, "");
}

/** "Esqueci minha senha": gera o link de recuperação no Supabase e envia pelo Microsoft 365. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  if (!serviceKey) {
    return NextResponse.json({ error: "Service role não configurada." }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: rows, error } = await admin
      .from("users")
      .select("name, auth_id, is_active")
      .ilike("email", escapeLike(email))
      .not("auth_id", "is", null)
      .limit(1);
    if (error) throw new Error(error.message);

    const appUser = rows?.[0];
    if (!appUser?.auth_id || appUser.is_active === false) return NextResponse.json(ACCEPTED);

    const { data: authData, error: authError } = await admin.auth.admin.getUserById(appUser.auth_id);
    if (authError) throw new Error(authError.message);
    const authUser = authData.user;
    if (!authUser?.email) return NextResponse.json(ACCEPTED);

    const lastSentAt = authUser.recovery_sent_at ? Date.parse(authUser.recovery_sent_at) : 0;
    if (Date.now() - lastSentAt < RESEND_INTERVAL_MS) return NextResponse.json(ACCEPTED);

    const { data: generated, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: authUser.email,
    });
    if (linkError || !generated.properties?.hashed_token) {
      throw new Error(linkError?.message ?? "Supabase não devolveu o token de recuperação.");
    }
    const link = passwordResetLink(linkOrigin(request), generated.properties.hashed_token);

    // Ambiente local sem as credenciais do 365: o link sai no log do servidor para testar o fluxo.
    if (process.env.NODE_ENV === "development" && !microsoftMailConfigurado()) {
      console.info(`[password-reset] Microsoft 365 não configurado; link para ${authUser.email}: ${link}`);
      return NextResponse.json(ACCEPTED);
    }

    const { subject, html } = buildPasswordResetEmail({ name: appUser.name, link });
    try {
      await enviarEmailMicrosoft({ para: authUser.email, assunto: subject, html });
    } catch (err) {
      console.error("[password-reset] falha ao enviar o e-mail:", err);
      return NextResponse.json(
        {
          error:
            "Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos ou fale com o administrador do sistema.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(ACCEPTED);
  } catch (err) {
    console.error("[password-reset]", err);
    return NextResponse.json({ error: "Erro ao processar o pedido. Tente de novo." }, { status: 500 });
  }
}
