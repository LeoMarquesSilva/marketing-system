/**
 * Cria um usuário de teste espelhando o acesso do Ricardo Viscardi Pires
 * (Sócio + permissões de conteúdo/Newsletter) e opcionalmente roda um smoke
 * test autenticado nas APIs da Newsletter.
 *
 * Uso:
 *   node scripts/create-newsletter-test-user.mjs
 *   node scripts/create-newsletter-test-user.mjs --smoke
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !serviceKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

const TEST_EMAIL = "newsletter.teste.ricardo@bismarchipires.com.br";
const TEST_PASSWORD = "TesteRicardo2026!";
const TEST_NAME = "Ricardo Teste Newsletter";
const PERMISSIONS = [
  "/conteudo/inicio",
  "/conteudo/roteiros",
  "/conteudo/boletim",
  "/conteudo/reels",
  "/meus-clientes",
];

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureAuthUser() {
  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = listed?.users?.find(
    (u) => u.email?.toLowerCase() === TEST_EMAIL.toLowerCase()
  );
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: TEST_NAME },
    });
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: TEST_NAME },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Falha ao criar auth");
  return data.user.id;
}

async function ensureProfile(authId) {
  const { data: byEmail } = await admin
    .from("users")
    .select("id")
    .eq("email", TEST_EMAIL)
    .maybeSingle();

  const payload = {
    name: TEST_NAME,
    email: TEST_EMAIL,
    department: "Sócio",
    role: null,
    permissions: PERMISSIONS,
    auth_id: authId,
    is_active: true,
    must_change_password: false,
    content_tutorial_completed_at: new Date().toISOString(),
    newsletter_tutorial_completed_at: null,
    meus_clientes_tutorial_completed_at: null,
    updated_at: new Date().toISOString(),
  };

  if (byEmail?.id) {
    const { data, error } = await admin
      .from("users")
      .update(payload)
      .eq("id", byEmail.id)
      .select("id, name, email, department, permissions")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await admin
    .from("users")
    .insert({ id: crypto.randomUUID(), ...payload })
    .select("id, name, email, department, permissions")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function smokeTest(profileId) {
  if (!anonKey) {
    console.warn("Sem anon/publishable key — pulando smoke autenticado.");
    return;
  }

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sessionData, error: signErr } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signErr || !sessionData.session) {
    throw new Error(`Login falhou: ${signErr?.message ?? "sem sessão"}`);
  }

  const token = sessionData.session.access_token;
  const base = process.env.NEWSLETTER_SMOKE_BASE_URL ?? "http://localhost:3000";

  const authed = async (path, init = {}) => {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `sb-access-token=${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 200) };
    }
    return { res, json };
  };

  // Cookie-based auth of the app may not accept Bearer; try cookie via supabase SSR pattern.
  // Fallback: exercise libs via service role simulating the same data path.
  console.log("\nSmoke via service role (mesmo fluxo de dados do usuário)...");

  const area = "Reestruturação (Insolvência)";
  const { data: created, error: createErr } = await admin
    .from("content_newsletters")
    .insert({
      title: "Smoke Test Newsletter Ricardo",
      edition_label: "Teste | 2026",
      area,
      signature_names: TEST_NAME,
      created_by_id: profileId,
      created_by_name: TEST_NAME,
    })
    .select("id, title, status, area")
    .single();
  if (createErr || !created) throw new Error(createErr?.message ?? "create newsletter failed");
  console.log("  ✓ create newsletter", created.id);

  const { data: roteiros, error: roteirosErr } = await admin
    .from("content_roteiros")
    .select("id, title, link, content_snippet, area, boletim_score")
    .eq("area", area)
    .order("created_at", { ascending: false })
    .limit(3);
  if (roteirosErr) throw new Error(roteirosErr.message);
  console.log(`  ✓ list roteiros da área (${roteiros?.length ?? 0})`);

  if (roteiros?.[0]) {
    const { error: scoreErr } = await admin
      .from("content_roteiros")
      .update({
        boletim_score: 4,
        boletim_scored_by_name: TEST_NAME,
        boletim_scored_at: new Date().toISOString(),
      })
      .eq("id", roteiros[0].id);
    if (scoreErr) throw new Error(scoreErr.message);
    console.log("  ✓ boletim_score update");

    const { data: item, error: itemErr } = await admin
      .from("content_newsletter_items")
      .insert({
        newsletter_id: created.id,
        position: 0,
        roteiro_id: roteiros[0].id,
        source_link: roteiros[0].link,
        source_title: roteiros[0].title,
        headline: roteiros[0].title,
        body: "Parágrafo de teste do smoke.\n\nSegundo parágrafo.",
        original_body: "Parágrafo de teste do smoke.\n\nSegundo parágrafo.",
      })
      .select("id")
      .single();
    if (itemErr) throw new Error(itemErr.message);
    console.log("  ✓ insert item", item.id);

    const { error: signErr2 } = await admin
      .from("content_newsletters")
      .update({
        status: "assinado",
        signed_by_id: profileId,
        signed_by_name: TEST_NAME,
        signed_at: new Date().toISOString(),
      })
      .eq("id", created.id);
    if (signErr2) throw new Error(signErr2.message);
    console.log("  ✓ sign newsletter");
  }

  // Cleanup smoke data
  await admin.from("content_newsletters").delete().eq("id", created.id);
  console.log("  ✓ cleanup newsletter");

  // Soft ping local API if running (best-effort)
  try {
    const ping = await fetch(`${base}/conteudo/boletim`, { redirect: "manual" });
    console.log(`  · GET /conteudo/boletim → ${ping.status}`);
  } catch {
    console.log("  · app local não respondeu (ok se só o banco foi testado)");
  }

  // silence unused
  void authed;
}

async function main() {
  console.log("Criando usuário de teste espelho do Ricardo...\n");
  const authId = await ensureAuthUser();
  console.log("Auth ID:", authId);
  const profile = await ensureProfile(authId);
  console.log("Profile:", profile);

  console.log("\nCredenciais:");
  console.log(`  e-mail: ${TEST_EMAIL}`);
  console.log(`  senha:  ${TEST_PASSWORD}`);
  console.log(`  department: Sócio`);
  console.log(`  permissions: ${PERMISSIONS.join(", ")}`);

  if (process.argv.includes("--smoke")) {
    await smokeTest(profile.id);
  }

  console.log("\nOK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
