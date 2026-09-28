/**
 * One-off: parse team.php and fill matched professional profiles (bio, tagline, education, linkedin).
 * Do not commit personal dumps.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i);
    let value = trimmed.slice(i + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(path.resolve(".env"));

const ACTOR_ID = "2f08c695-770e-47ce-b4e4-ce27fa414df8";
const TEAM_PATH =
  process.env.TEAM_PHP ||
  "C:\\Users\\Leonardo Marques\\AppData\\Local\\Temp\\fz3temp-2\\team.php";
const APPLY = process.argv.includes("--apply");

function stripTags(html) {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(name) {
  return normalizeName(name).split(" ").filter((t) => t.length > 1);
}

/** Score how well site name matches profile name. */
function nameScore(siteName, profileName) {
  const a = tokenize(siteName);
  const b = tokenize(profileName);
  if (!a.length || !b.length) return 0;
  if (normalizeName(siteName) === normalizeName(profileName)) return 100;
  const setB = new Set(b);
  const overlap = a.filter((t) => setB.has(t)).length;
  // Require first token (given name) match for safety
  if (a[0] !== b[0] && !b.includes(a[0])) return 0;
  const ratio = overlap / Math.max(a.length, b.length);
  // Prefer high overlap of distinctive tokens
  if (overlap >= 2 && ratio >= 0.5) return Math.round(ratio * 100);
  if (overlap >= 3) return Math.round(ratio * 100);
  return 0;
}

function extractEducationItems(paragraphs) {
  const items = [];
  const eduPattern =
    /(?:Graduad[oa]|Bacharel(?:ado)?|P[oó]s-?[Gg]raduad[oa]|MBA|Mestrand[oa]|Doutora?nd[oa]|Forma[cç][aã]o em|Certifica[cç][aã]o(?: em)?|Especialista em|Extens[aã]o Universit[aá]ria em)[\s\S]*?(?=(?:\.|;)\s*(?:Graduad|Bacharel|P[oó]s-|MBA|Mestrand|Doutor|Forma[cç]|Certifica|Especialista|Extens[aã]o|Advogad|Atua|Possui|Profissional|Eleito|Membro|Coautora|Professor)|$)/gi;

  for (const para of paragraphs) {
    const matches = para.match(eduPattern) ?? [];
    for (let raw of matches) {
      let item = raw.replace(/\s+/g, " ").trim().replace(/[.;,\s]+$/, "");
      if (item.length < 20) continue;
      if (!items.includes(item)) items.push(item);
    }
  }

  // Fallback: first formation-heavy paragraph, completo
  if (!items.length) {
    for (const para of paragraphs) {
      const lower = para.toLowerCase();
      if (/gradua|bacharel|p[oó]s-?gradua|mba|certifica|forma[cç][aã]o em/.test(lower)) {
        items.push(para);
        break;
      }
    }
  }

  return items.slice(0, 8);
}

function parseTeamPhp(html) {
  // Drop HTML comments so commented-out people (e.g. Rebeka) are ignored
  const cleaned = html.replace(/<!--[\s\S]*?-->/g, "");
  const people = [];
  const re = /<div class="curriculo-adv[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
  let match;
  while ((match = re.exec(cleaned))) {
    const block = match[0];
    const nameMatch = block.match(/<h3 class="font-small">([\s\S]*?)<\/h3>/i);
    if (!nameMatch) continue;
    const name = stripTags(nameMatch[1]);
    const subtitle = block.match(/<div class="subtitle">([\s\S]*?)(?:<\/div>\s*){1,2}/i);
    const paragraphs = [...(subtitle?.[1] ?? "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((p) => stripTags(p[1]))
      .filter(Boolean);
    const linkedin =
      block.match(/href="\s*(https?:\/\/(?:www\.)?linkedin\.com\/[^"]+)"/i)?.[1]?.trim() ?? null;

    if (!name || paragraphs.length === 0) continue;

    const education = extractEducationItems(paragraphs);
    // Mini-CV: full text from the site (keeps formation context in bio when mixed)
    const bio = paragraphs.join("\n\n").trim();
    // Tagline: primeira frase prática completa (sem cortar com …)
    const practice = paragraphs.find((p) =>
      /atua|advogad|especialista|experiencia|experiência|conduz|focad/i.test(p)
    );
    const taglineSource = practice || paragraphs.find((p) => p.length > 40) || paragraphs[0] || "";
    const firstSentence = taglineSource.match(/^(.{40,}?[.!?])(?:\s|$)/);
    const tagline = (firstSentence?.[1] || taglineSource).trim();

    people.push({
      name,
      linkedin,
      bio,
      tagline,
      education,
      paragraphs,
    });
  }
  return people;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const html = fs.readFileSync(TEAM_PATH, "utf8");
  const people = parseTeamPhp(html);
  console.log(JSON.stringify({ site_people: people.length }, null, 0));

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profiles, error } = await db
    .from("professional_profiles")
    .select(
      "id, slug, linkedin_url, user_id, users!professional_profiles_user_id_fkey(name, email), professional_profile_localizations(locale, display_name, bio, tagline)"
    );
  if (error) throw error;

  const profileRows = (profiles ?? []).map((p) => {
    const locs = p.professional_profile_localizations ?? [];
    const pt = locs.find((l) => l.locale === "pt-BR") ?? locs[0];
    return {
      id: p.id,
      slug: p.slug,
      linkedinUrl: p.linkedin_url,
      userName: p.users?.name ?? null,
      displayName: pt?.display_name ?? null,
      bio: pt?.bio ?? null,
      tagline: pt?.tagline ?? null,
    };
  });

  const matches = [];
  const unmatchedSite = [];
  const usedProfiles = new Set();

  for (const person of people) {
    let best = null;
    for (const profile of profileRows) {
      if (usedProfiles.has(profile.id)) continue;
      const score = Math.max(
        nameScore(person.name, profile.displayName),
        nameScore(person.name, profile.userName)
      );
      if (score > (best?.score ?? 0)) best = { profile, score };
    }
    if (!best || best.score < 50) {
      unmatchedSite.push({ name: person.name, bestScore: best?.score ?? 0 });
      continue;
    }
    usedProfiles.add(best.profile.id);
    matches.push({ person, profile: best.profile, score: best.score });
  }

  console.log(
    JSON.stringify(
      {
        matched: matches.length,
        unmatched_site: unmatchedSite,
        unmatched_profiles: profileRows
          .filter((p) => !usedProfiles.has(p.id))
          .map((p) => p.displayName || p.userName),
        sample: matches.slice(0, 5).map((m) => ({
          site: m.person.name,
          profile: m.profile.displayName || m.profile.userName,
          score: m.score,
          educationCount: m.person.education.length,
          bioLen: m.person.bio.length,
        })),
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log("dry_run_only");
    return;
  }

  let updated = 0;
  let educationInserted = 0;

  for (const { person, profile } of matches) {
    const { error: locError } = await db
      .from("professional_profile_localizations")
      .update({
        bio: person.bio,
        tagline: person.tagline,
      })
      .eq("profile_id", profile.id)
      .eq("locale", "pt-BR");
    if (locError) throw locError;

    if (person.linkedin && !profile.linkedinUrl) {
      const { error: linkError } = await db
        .from("professional_profiles")
        .update({
          linkedin_url: person.linkedin,
          show_linkedin: true,
          updated_by: ACTOR_ID,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
      if (linkError) throw linkError;
    } else {
      await db
        .from("professional_profiles")
        .update({ updated_by: ACTOR_ID, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
    }

    // Education section
    const { data: section, error: sectionError } = await db
      .from("professional_profile_sections")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("section_key", "education")
      .maybeSingle();
    if (sectionError) throw sectionError;
    if (!section) continue;

    // Clear previous education entries for clean import from site
    const { data: oldEntries } = await db
      .from("professional_profile_entries")
      .select("id")
      .eq("section_id", section.id);
    const oldIds = (oldEntries ?? []).map((e) => e.id);
    if (oldIds.length) {
      await db.from("professional_profile_entry_localizations").delete().in("entry_id", oldIds);
      await db.from("professional_profile_entries").delete().in("id", oldIds);
    }

    let sortOrder = 0;
    for (const edu of person.education.length ? person.education : []) {
      const { data: entry, error: entryError } = await db
        .from("professional_profile_entries")
        .insert({
          section_id: section.id,
          entry_type: "education",
          sort_order: sortOrder,
          is_visible: true,
          metadata: {},
        })
        .select("id")
        .single();
      if (entryError) throw entryError;

      const { error: entryLocError } = await db
        .from("professional_profile_entry_localizations")
        .insert({
          entry_id: entry.id,
          locale: "pt-BR",
          title: edu,
          subtitle: null,
          description: null,
        });
      if (entryLocError) throw entryLocError;
      sortOrder += 1;
      educationInserted += 1;
    }

    // Ensure education section enabled
    await db
      .from("professional_profile_sections")
      .update({ enabled: true })
      .eq("id", section.id);

    updated += 1;
  }

  console.log(JSON.stringify({ updated, educationInserted }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
