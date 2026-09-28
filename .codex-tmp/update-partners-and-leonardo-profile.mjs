import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase configuration is missing.");

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const actorId = "2f08c695-770e-47ce-b4e4-ce27fa414df8";
const targets = {
  gustavo: {
    id: "2aa4d988-1d9c-4c85-a685-092c0d9e5199",
    slug: "gustavo-bismarchi-motta",
  },
  ricardo: {
    id: "79cd34d7-dd76-40d3-b1eb-b4415eefae7c",
    slug: "ricardo-viscardi-pires",
  },
  leonardo: {
    id: "11bf82a9-0c64-4564-9401-8327c17cbc4b",
    slug: "leonardo-marques-silva",
  },
};

const ids = Object.values(targets).map((target) => target.id);
const { data: profiles, error: profilesError } = await db
  .from("professional_profiles")
  .select("id, slug, status")
  .in("id", ids);
if (profilesError) throw profilesError;
if ((profiles ?? []).length !== ids.length) {
  throw new Error(`Expected ${ids.length} profiles, found ${(profiles ?? []).length}.`);
}
for (const target of Object.values(targets)) {
  const profile = profiles.find((item) => item.id === target.id);
  if (profile?.slug !== target.slug) {
    throw new Error(`Profile identity mismatch for ${target.slug}.`);
  }
}

for (const profileId of [targets.gustavo.id, targets.ricardo.id]) {
  const { error } = await db
    .from("professional_profile_localizations")
    .update({ role: "Sócio" })
    .eq("profile_id", profileId)
    .eq("locale", "pt-BR");
  if (error) throw error;
}

const leonardoContent = {
  role: "Analista de Desenvolvimento de Soluções",
  practice_area: "Tecnologia, Automação, Dados e Inovação",
  tagline:
    "Analista de Desenvolvimento de Soluções do Bismarchi | Pires, com atuação no desenvolvimento de sistemas, automações e soluções digitais voltadas à otimização de processos e à geração de inteligência para o negócio.",
  bio: [
    "Atua na identificação de oportunidades de melhoria e no desenvolvimento de soluções que conectam tecnologia às necessidades das áreas do escritório. Desenvolve sistemas internos, automações, integrações entre plataformas, dashboards e ferramentas para apoiar a gestão, aumentar a eficiência operacional e transformar dados em informações estratégicas.",
    "Sua atuação também contempla projetos de Marketing e Desenvolvimento de Negócios, contribuindo para a digitalização de processos, estruturação de indicadores, experiência do cliente e criação de novas ferramentas para as equipes.",
    "Profissional com formação em Tecnologia da Informação e atualmente graduando em Publicidade e Propaganda, reúne conhecimentos de tecnologia, comunicação e negócios. No Bismarchi | Pires, atua no desenvolvimento e implementação de soluções utilizando tecnologias como React, TypeScript, JavaScript, Supabase, N8N e Power BI, além da integração de plataformas como RD Station, SharePoint e Microsoft 365.",
    "Entre suas atividades estão a criação de sistemas internos, automação de fluxos de trabalho, integração e tratamento de dados, desenvolvimento de dashboards e indicadores, estruturação de processos digitais e apoio a projetos de inovação. Também participa do desenvolvimento de soluções voltadas às áreas jurídica, financeira, comercial e de Marketing, buscando reduzir atividades manuais, centralizar informações e proporcionar maior eficiência e inteligência à operação.",
  ].join("\n\n"),
};

const { error: leonardoLocalizationError } = await db
  .from("professional_profile_localizations")
  .update(leonardoContent)
  .eq("profile_id", targets.leonardo.id)
  .eq("locale", "pt-BR");
if (leonardoLocalizationError) throw leonardoLocalizationError;

const { data: educationSection, error: educationSectionError } = await db
  .from("professional_profile_sections")
  .select("id")
  .eq("profile_id", targets.leonardo.id)
  .eq("section_key", "education")
  .single();
if (educationSectionError) throw educationSectionError;

const { data: existingEntries, error: existingEntriesError } = await db
  .from("professional_profile_entries")
  .select("id")
  .eq("section_id", educationSection.id)
  .eq("entry_type", "education");
if (existingEntriesError) throw existingEntriesError;

const existingEntryIds = (existingEntries ?? []).map((entry) => entry.id);
const existingLocalizationsResult = existingEntryIds.length
  ? await db
      .from("professional_profile_entry_localizations")
      .select("entry_id, title")
      .in("entry_id", existingEntryIds)
      .eq("locale", "pt-BR")
  : { data: [], error: null };
if (existingLocalizationsResult.error) throw existingLocalizationsResult.error;

const educationTitles = [
  "Graduação em Publicidade e Propaganda — em andamento",
  "Formação em Tecnologia da Informação",
];
const existingTitles = new Set(
  (existingLocalizationsResult.data ?? []).map((localization) => localization.title),
);

let educationEntriesCreated = 0;
for (const [sortOrder, title] of educationTitles.entries()) {
  if (existingTitles.has(title)) continue;

  const { data: entry, error: entryError } = await db
    .from("professional_profile_entries")
    .insert({
      section_id: educationSection.id,
      entry_type: "education",
      sort_order: sortOrder,
      is_visible: true,
    })
    .select("id")
    .single();
  if (entryError) throw entryError;

  const { error: entryLocalizationError } = await db
    .from("professional_profile_entry_localizations")
    .insert({
      entry_id: entry.id,
      locale: "pt-BR",
      title,
      subtitle: null,
      description: null,
    });
  if (entryLocalizationError) throw entryLocalizationError;
  educationEntriesCreated += 1;
}

const { error: touchError } = await db
  .from("professional_profiles")
  .update({ updated_by: actorId })
  .in("id", ids);
if (touchError) throw touchError;

console.log(
  JSON.stringify(
    {
      partnerRolesUpdated: 2,
      leonardoProfileUpdated: true,
      educationEntriesCreated,
      preservedPublishedStatuses: profiles.every((profile) => profile.status === "published"),
    },
    null,
    2,
  ),
);
