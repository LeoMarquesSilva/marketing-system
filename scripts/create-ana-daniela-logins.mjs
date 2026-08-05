/**
 * Cria login (auth + public.users) para Ana e Daniela e vincula em hr_employees.
 * Senha padrão do sistema: 123456 (must_change_password = true).
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const url =
  process.env.ORQESTRAI_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";
const key =
  process.env.ORQESTRAI_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

if (!url || !key) {
  console.error("Faltam ORQESTRAI_SUPABASE_URL / SERVICE_ROLE_KEY (ou NEXT_PUBLIC_*/SUPABASE_*).");
  process.exit(1);
}

const DEFAULT_PASSWORD = "123456";

const people = [
  {
    name: "Ana Nunes Galvão",
    email: "ana.galvao@bismarchipires.com.br",
    department: "Recuperação de Crédito",
    vios_ci: "301",
    hr_id: "771c9aa7-4110-44df-b2d2-3771b8a32dc2",
    joined_on: "2026-07-06",
    phone: "19 99819-2211",
    birth: "23/05/1998",
  },
  {
    name: "Daniela Lagoeiro dos Santos",
    email: "daniela.santos@bismarchipires.com.br",
    department: "Reestruturação",
    vios_ci: "302",
    hr_id: "32502e0d-e7b7-4490-a094-cdf3d105c934",
    joined_on: "2026-07-27",
    phone: "19 98393-8912",
    birth: "17/12/1995",
  },
];

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureUser(person) {
  const { data: existing } = await db
    .from("users")
    .select("id, email, auth_id, is_active")
    .ilike("email", person.email)
    .maybeSingle();

  let userId = existing?.id ?? null;
  let authId = existing?.auth_id ?? null;

  if (!userId) {
    userId = randomUUID();
    const { error } = await db.from("users").insert({
      id: userId,
      name: person.name,
      email: person.email,
      department: person.department,
      is_active: true,
      must_change_password: true,
      role: null,
      permissions: [],
    });
    if (error) throw new Error(`users insert (${person.email}): ${error.message}`);
    console.log(`✓ users criado: ${person.name}`);
  } else {
    await db
      .from("users")
      .update({
        name: person.name,
        department: person.department,
        is_active: true,
        email: person.email,
      })
      .eq("id", userId);
    console.log(`✓ users já existia: ${person.name}`);
  }

  if (!authId) {
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email: person.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { name: person.name },
    });
    if (createErr || !created.user) {
      // Se já existir no Auth, tenta localizar
      const listed = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = listed.data?.users?.find(
        (u) => u.email?.toLowerCase() === person.email.toLowerCase()
      );
      if (!found) throw new Error(`auth create (${person.email}): ${createErr?.message}`);
      authId = found.id;
      console.log(`✓ auth já existia: ${person.email}`);
    } else {
      authId = created.user.id;
      console.log(`✓ auth criado: ${person.email}`);
    }

    const { error: linkErr } = await db
      .from("users")
      .update({
        auth_id: authId,
        must_change_password: true,
        is_active: true,
      })
      .eq("id", userId);
    if (linkErr) throw new Error(`link auth_id: ${linkErr.message}`);
  } else {
    await db.auth.admin.updateUserById(authId, { password: DEFAULT_PASSWORD });
    await db
      .from("users")
      .update({ must_change_password: true, is_active: true })
      .eq("id", userId);
    console.log(`✓ senha resetada (auth já existia): ${person.email}`);
  }

  const { error: hrErr } = await db
    .from("hr_employees")
    .update({
      user_id: userId,
      full_name: person.name,
      email: person.email,
      department: person.department,
      position: "Advogado Junior",
      admission_date: person.joined_on,
      is_active: true,
      notes: `Telefone: ${person.phone} · Nascimento: ${person.birth}`,
    })
    .eq("id", person.hr_id);
  if (hrErr) throw new Error(`hr_employees: ${hrErr.message}`);
  console.log(`✓ hr_employees vinculado (CI ${person.vios_ci})`);

  const { data: profile } = await db
    .from("professional_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) {
    const { error: pErr } = await db.from("professional_profiles").insert({
      user_id: userId,
      slug: slugify(person.name),
      status: "draft",
      joined_on: person.joined_on,
      professional_email: person.email,
      professional_phone: person.phone,
      show_tenure: true,
      show_email: true,
      show_whatsapp: false,
      show_linkedin: false,
      show_website: false,
    });
    if (pErr) {
      console.warn(`⚠ perfil NFC não criado: ${pErr.message}`);
    } else {
      console.log(`✓ professional_profiles draft criado`);
    }
  } else {
    await db
      .from("professional_profiles")
      .update({
        joined_on: person.joined_on,
        professional_email: person.email,
        professional_phone: person.phone,
      })
      .eq("id", profile.id);
    console.log(`✓ professional_profiles atualizado`);
  }

  return { userId, authId, email: person.email };
}

const results = [];
for (const person of people) {
  try {
    results.push(await ensureUser(person));
  } catch (err) {
    console.error(`✗ ${person.name}:`, err.message || err);
    process.exitCode = 1;
  }
}

console.log("\nPronto. Logins:");
for (const r of results) {
  console.log(`- ${r.email} / ${DEFAULT_PASSWORD} (trocar no 1º acesso)`);
}
