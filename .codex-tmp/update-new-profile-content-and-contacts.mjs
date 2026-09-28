import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase configuration is missing.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const actorId = "2f08c695-770e-47ce-b4e4-ce27fa414df8";

const contentBySlug = {
  "giovanna-pereira-de-souza": {
    profile: {
      linkedin_url: "https://www.linkedin.com/in/giovannasouzap",
      oab: "OAB 548256",
      show_email: true,
      show_linkedin: true,
      updated_by: actorId,
    },
    localization: {
      tagline:
        "Advogada graduada pela Universidade Presbiteriana Mackenzie – Campinas (2021–2025).",
      bio:
        "Em 2023, ingressou na Universidade Estadual de Campinas (UNICAMP), no Instituto de Computação, como estagiária, atuando no suporte jurídico e administrativo, onde permaneceu até 2025. Em abril de 2026, passou a integrar a Equipe Bismarchi | Pires como Advogada na área de Legal Operations.",
    },
  },
  "maria-heloiza-gois-ponce": {
    profile: {
      linkedin_url: "https://www.linkedin.com/in/maria-heloiza-ponce-44b457211/",
      show_email: true,
      show_linkedin: true,
      updated_by: actorId,
    },
    localization: {
      tagline:
        "Advogada formada pela Universidade Paulista (2018–2022), pós-graduanda em Gestão de Escritórios e Departamentos Jurídicos pela Legale.",
      bio:
        "Possui experiência no Tribunal de Justiça de São Paulo (TJ/SP), com atuação no Juizado Especial Cível de Campinas, além de passagens pela empresa Alpha Trânsito Campinas e por escritórios de advocacia, com foco nas áreas trabalhista e operacional. Atuou como trainee, advogada e controller operacional, desenvolvendo habilidades jurídicas e de gestão de processos internos. Atua como Supervisora de Operações Legais no Bismarchi | Pires Sociedade de Advogados.",
    },
  },
  "samuel-willian-silva": {
    profile: {
      linkedin_url: "https://www.linkedin.com/in/samuelwillian/",
      show_email: true,
      show_linkedin: true,
      updated_by: actorId,
    },
    localization: {
      tagline:
        "Advogado pós-graduado em Gestão de Projetos pela FGV (2022–2024), Bacharel em Direito pela UNIFEOB – Fundação de Ensino Otávio Bastos (2014–2018) e Bacharel em Sistemas de Informação pela Universidade Católica Dom Bosco (2009–2013). Possui curso avançado de inglês pelo The English Studio – Dublin/Irlanda (março–abril de 2017).",
      bio:
        "Atuante na área de Operações Legais / Legal Ops, com experiência em coordenação de equipes e automação de processos. Desde março de 2021, integra a Equipe Bismarchi | Pires, onde começou como Advogado Trabalhista e, posteriormente, foi convidado a coordenar a Controladoria Jurídica do escritório, atuando agora como Coordenador de Operações Jurídicas – Legal Ops. Sua expertise inclui o desenvolvimento de métricas via Power BI, criação de dashboards, gestão dos sistemas jurídicos, além de estar à frente do polo de inovações tecnológicas no escritório.",
    },
  },
  "vinicius-canto-hecksher": {
    profile: {
      show_email: true,
      updated_by: actorId,
    },
  },
};

const slugs = Object.keys(contentBySlug);
const { data: profiles, error: profilesError } = await supabase
  .from("professional_profiles")
  .select("id, slug")
  .in("slug", slugs);

if (profilesError) throw profilesError;
if (profiles.length !== slugs.length) {
  throw new Error(`Expected ${slugs.length} profiles, found ${profiles.length}.`);
}

for (const profile of profiles) {
  const content = contentBySlug[profile.slug];

  const { error: profileError } = await supabase
    .from("professional_profiles")
    .update(content.profile)
    .eq("id", profile.id);
  if (profileError) throw profileError;

  if (content.localization) {
    const { error: localizationError } = await supabase
      .from("professional_profile_localizations")
      .update(content.localization)
      .eq("profile_id", profile.id)
      .eq("locale", "pt-BR");
    if (localizationError) throw localizationError;
  }
}

console.log(
  JSON.stringify(
    {
      updatedProfiles: slugs.length,
      updatedPresentations: Object.values(contentBySlug).filter(
        (content) => content.localization,
      ).length,
    },
    null,
    2,
  ),
);
