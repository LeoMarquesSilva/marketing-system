import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Supabase admin environment is unavailable.");

const actorId = "2f08c695-770e-47ce-b4e4-ce27fa414df8";
const restructuring = {
  tagline:
    "Atuação no suporte a processos de reestruturação empresarial e ao contencioso cível relacionado, com apoio na elaboração de petições, relatórios e acompanhamento processual.",
  bio:
    "Integra a equipe de Reestruturação do Bismarchi | Pires, prestando suporte em processos de reestruturação empresarial e no contencioso cível relacionado à área. Atua no apoio à elaboração de petições e relatórios, acompanhamento de processos e realização de diligências internas, contribuindo para a organização das demandas e o cumprimento de prazos da equipe jurídica. Sua atuação é desenvolvida em um ambiente de aprendizado contínuo, com atenção à qualidade técnica, à comunicação e ao trabalho em equipe.",
};
const legalOperations = {
  tagline:
    "Atuação no apoio às rotinas de Operações Legais, com foco no acompanhamento processual, controle de demandas e eficiência das entregas.",
  bio:
    "Integra a área de Operações Legais do Bismarchi | Pires, apoiando atividades administrativas e operacionais ligadas ao acompanhamento processual e ao controle de demandas. Atua no agendamento de publicações, abertura de pastas e processos, revisão de protocolos, gestão de e-mails e elaboração e atualização de relatórios. Desenvolve suas atividades com organização, atenção aos detalhes e colaboração com a equipe, em um ambiente de aprendizado contínuo e desenvolvimento profissional.",
};

const targets = [
  { id: "a1c3f404-7997-4b46-88e4-a158cc6a6ea4", name: "Julia Antonini Morel", area: "Reestruturação", copy: restructuring },
  { id: "a61ee8f1-10e2-4104-9ee3-31797f33f79e", name: "Laura Puente Ferreira Gomes", area: "Reestruturação", copy: restructuring },
  { id: "60a1c5f6-4d75-4ed7-8828-397f2268bd72", name: "Maria Julia Pereira", area: "Operações Legais", copy: legalOperations },
  { id: "1ee68c5f-46dd-4911-bb2b-0ac7c3df854f", name: "Marina Silva Pinelli", area: "Operações Legais", copy: legalOperations },
  { id: "d15bab0f-75bf-4568-b0ef-4491e83d7e5a", name: "Natália Borges Breve", area: "Operações Legais", copy: legalOperations },
];

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const updated = [];
for (const target of targets) {
  const { data: current, error: readError } = await db
    .from("professional_profile_localizations")
    .select("display_name, role, practice_area")
    .eq("profile_id", target.id)
    .eq("locale", "pt-BR")
    .maybeSingle();
  if (readError || !current) throw new Error(`Perfil não encontrado: ${target.name}`);
  if (current.display_name !== target.name || current.practice_area !== target.area) {
    throw new Error(`Vínculo divergente: ${target.name}`);
  }
  if (!String(current.role ?? "").toLowerCase().includes("estagi")) {
    throw new Error(`Cargo divergente: ${target.name}`);
  }

  const { error: updateError } = await db
    .from("professional_profile_localizations")
    .update({ tagline: target.copy.tagline, bio: target.copy.bio })
    .eq("profile_id", target.id)
    .eq("locale", "pt-BR");
  if (updateError) throw updateError;

  const { error: auditError } = await db
    .from("professional_profiles")
    .update({ updated_by: actorId })
    .eq("id", target.id);
  if (auditError) throw auditError;
  updated.push(target.name);
}

console.log(JSON.stringify({ updated: updated.length, names: updated }));
