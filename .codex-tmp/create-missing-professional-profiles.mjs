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
const rows = [
  {
    email: "mariaponce@bismarchipires.com.br",
    name: "Maria Heloiza Gois Ponce",
    slug: "maria-heloiza-gois-ponce",
    role: "Supervisor(a)",
    area: "Operações Legais",
    phone: "19 98828-7845",
    joinedOn: "2025-05-12",
    overwrite: false,
  },
  {
    email: "giovanna.souza@bismarchipires.com.br",
    name: "Giovanna Pereira de Souza",
    slug: "giovanna-pereira-de-souza",
    role: "Advogado(a) Júnior",
    area: "Operações Legais",
    phone: "19992754161",
    joinedOn: "2026-04-29",
    overwrite: false,
  },
  {
    email: "vinicius.hecksher@bismarchipires.com.br",
    name: "Vinícius Canto Hecksher",
    slug: "vinicius-canto-hecksher",
    role: "Estagiário(a)",
    area: "Reestruturação",
    phone: "(19) 997049119",
    joinedOn: "2026-04-23",
    overwrite: false,
  },
];

const { data: importResult, error: importError } = await supabase.rpc(
  "apply_professional_profile_import",
  { p_rows: rows, p_actor_id: actorId },
);

if (importError) throw importError;

const { data: viniciusUser, error: userError } = await supabase
  .from("users")
  .select("id")
  .eq("email", "vinicius.hecksher@bismarchipires.com.br")
  .single();

if (userError) throw userError;

const { data: viniciusProfile, error: profileError } = await supabase
  .from("professional_profiles")
  .select("id")
  .eq("user_id", viniciusUser.id)
  .single();

if (profileError) throw profileError;

const tagline =
  "Atuação no suporte a processos de reestruturação empresarial e ao contencioso cível relacionado, com apoio na elaboração de petições, relatórios e acompanhamento processual.";
const bio =
  "Integra a equipe de Reestruturação do Bismarchi | Pires, prestando suporte em processos de reestruturação empresarial e no contencioso cível relacionado à área. Atua no apoio à elaboração de petições e relatórios, acompanhamento de processos e realização de diligências internas, contribuindo para a organização das demandas e o cumprimento de prazos da equipe jurídica. Sua atuação é desenvolvida em um ambiente de aprendizado contínuo, com atenção à qualidade técnica, à comunicação e ao trabalho em equipe.";

const { error: localizationError } = await supabase
  .from("professional_profile_localizations")
  .update({ tagline, bio })
  .eq("profile_id", viniciusProfile.id)
  .eq("locale", "pt-BR");

if (localizationError) throw localizationError;

const { error: touchError } = await supabase
  .from("professional_profiles")
  .update({ updated_by: actorId })
  .eq("id", viniciusProfile.id);

if (touchError) throw touchError;

console.log(
  JSON.stringify(
    {
      importResult,
      updatedPresentation: "Vinícius Canto Hecksher",
    },
    null,
    2,
  ),
);
