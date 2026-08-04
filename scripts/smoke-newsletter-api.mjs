/**
 * Smoke autenticado das APIs da Newsletter com o usuário espelho do Ricardo.
 *
 * Pré-requisito: `npm run dev` + usuário criado por create-newsletter-test-user.mjs
 *
 * Uso: node scripts/smoke-newsletter-api.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const base = process.env.NEWSLETTER_SMOKE_BASE_URL ?? "http://localhost:3000";

const TEST_EMAIL = "newsletter.teste.ricardo@bismarchipires.com.br";
const TEST_PASSWORD = "TesteRicardo2026!";

if (!url || !anonKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const MAX_CHUNK_SIZE = 3180;

function toBase64Url(str) {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/** Replica o encoding de cookie do @supabase/ssr (base64- + chunks). */
function buildCookieHeader(session) {
  const ref = new URL(url).hostname.split(".")[0];
  const key = `sb-${ref}-auth-token`;
  const sessionJson = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type ?? "bearer",
    user: session.user,
  });
  const encoded = `base64-${toBase64Url(sessionJson)}`;
  const encodedForSize = encodeURIComponent(encoded);

  if (encodedForSize.length <= MAX_CHUNK_SIZE) {
    return `${key}=${encoded}`;
  }

  const chunks = [];
  let remaining = encodedForSize;
  while (remaining.length > 0) {
    let head = remaining.slice(0, MAX_CHUNK_SIZE);
    const lastEscape = head.lastIndexOf("%");
    if (lastEscape > MAX_CHUNK_SIZE - 3) head = head.slice(0, lastEscape);
    while (head.length > 0) {
      try {
        chunks.push(decodeURIComponent(head));
        break;
      } catch {
        if (head.at(-3) === "%" && head.length > 3) {
          head = head.slice(0, head.length - 3);
        } else {
          throw new Error("falha ao chunkar cookie de sessão");
        }
      }
    }
    remaining = remaining.slice(head.length);
  }

  return chunks.map((value, i) => `${key}.${i}=${value}`).join("; ");
}

async function main() {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`Login falhou: ${error?.message ?? "sem sessão"}`);
  }
  console.log("✓ login", TEST_EMAIL);

  const cookie = buildCookieHeader(data.session);
  const results = [];

  const call = async (label, path, init = {}) => {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Cookie: cookie,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      redirect: "manual",
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 160) };
    }
    const ok = res.status >= 200 && res.status < 300;
    results.push({ label, status: res.status, ok, error: json?.error });
    console.log(`${ok ? "✓" : "✗"} ${label} → ${res.status}${json?.error ? ` (${json.error})` : ""}`);
    return { res, json, ok };
  };

  const list = await call("GET /api/content-newsletters", "/api/content-newsletters");
  if (!list.ok) throw new Error("list newsletters failed");

  const created = await call("POST /api/content-newsletters", "/api/content-newsletters", {
    method: "POST",
    body: JSON.stringify({
      title: "Smoke API Newsletter Ricardo",
      edition_label: "API | 2026",
      area: "Reestruturação (Insolvência)",
    }),
  });
  if (!created.ok || !created.json?.id) throw new Error("create failed");
  const id = created.json.id;

  await call(`GET /api/content-newsletters/${id}`, `/api/content-newsletters/${id}`);

  await call(`PATCH campos ${id}`, `/api/content-newsletters/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      intro_title: "Nesta edição",
      intro_body: "Texto de abertura do smoke.",
      signature_names: "Ricardo Teste Newsletter",
    }),
  });

  const roteiros = await call(
    "GET /api/content-roteiros?area=...",
    `/api/content-roteiros?area=${encodeURIComponent("Reestruturação (Insolvência)")}`
  );

  const first = Array.isArray(roteiros.json) ? roteiros.json[0] : null;
  if (first?.id) {
    await call("PATCH boletim_score", "/api/content-roteiros", {
      method: "PATCH",
      body: JSON.stringify({ id: first.id, action: "boletim_score", score: 5 }),
    });

    await call(
      "GET article-preview",
      `/api/content-roteiros/article-preview?id=${encodeURIComponent(first.id)}`
    );

    await call(`POST items ${id}`, `/api/content-newsletters/${id}/items`, {
      method: "POST",
      body: JSON.stringify({ roteiro_ids: [first.id] }),
    });
  } else {
    console.log("· sem roteiros na área — pulando score/items");
  }

  await call(`GET word ${id}`, `/api/content-newsletters/${id}/word`);

  // Assinar (precisa de item; se não houver, espera 400)
  const signed = await call(`PATCH sign ${id}`, `/api/content-newsletters/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "sign" }),
  });
  if (signed.ok) {
    await call(`PATCH reopen ${id}`, `/api/content-newsletters/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "reopen" }),
    });
  }

  await call(`DELETE ${id}`, `/api/content-newsletters/${id}`, { method: "DELETE" });

  await call("POST tutorial completed", "/api/account/newsletter-tutorial-completed", {
    method: "POST",
  });

  // Reset tutorial so Ricardo-like test user still sees the guide next login
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await admin
      .from("users")
      .update({ newsletter_tutorial_completed_at: null })
      .eq("email", TEST_EMAIL);
    console.log("✓ tutorial resetado para o usuário de teste");
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nResumo: ${results.length - failed.length}/${results.length} ok`);
  if (failed.length) {
    console.error("Falhas:", failed);
    process.exit(1);
  }
  console.log("OK — APIs da Newsletter autenticadas sem erro");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
