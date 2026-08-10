/**
 * Publica os perfis profissionais prontos e cria um cartão NFC nomeado igual
 * ao perfil (mesmo padrão já aplicado manualmente ao Felipe e ao Gustavo).
 *
 * Usa a mesma lógica de negócio da aplicação (getProfessionalProfileAdmin,
 * listMissingPublishRequirements, setProfessionalProfileStatus,
 * createProfileCard) em vez de SQL solto, para não divergir das regras já
 * implementadas (checklist de publicação, geração de código/token do cartão).
 *
 * DRY_RUN=1 mostra o plano sem escrever nada.
 */
import "dotenv/config";
import {
  createProfileAdminClient,
  getProfessionalProfileAdmin,
  listMissingPublishRequirements,
  setProfessionalProfileStatus,
} from "@/lib/profiles/admin";
import { createProfileCard } from "@/lib/profiles/cards";

const ACTOR_ID = "2f08c695-770e-47ce-b4e4-ce27fa414df8"; // Leonardo Marques (admin)
const DRY_RUN = process.env.DRY_RUN === "1";

type Row = Record<string, unknown>;

async function main() {
  const db = createProfileAdminClient();
  const { data: profileRows, error } = await db
    .from("professional_profiles")
    .select("id, slug, status")
    .order("slug");
  if (error || !profileRows) {
    throw new Error("Falha ao listar perfis: " + (error?.message ?? "sem dados"));
  }

  let published = 0;
  let cardsCreated = 0;
  let alreadyOk = 0;
  const blocked: Array<{ name: string; missing: string[] }> = [];

  for (const row of profileRows as Row[]) {
    const id = row.id as string;
    const detail = await getProfessionalProfileAdmin(id);
    const displayName =
      detail.localizations.find((l) => l.locale === "pt-BR")?.displayName?.trim() ||
      detail.userName ||
      detail.slug;
    const missing = listMissingPublishRequirements(detail);

    if (missing.length > 0) {
      blocked.push({ name: displayName, missing });
      continue;
    }

    let willPublish = detail.status !== "published";
    let willCreateCard = !detail.cards.some((c) => c.label === displayName);

    if (!willPublish && !willCreateCard) {
      alreadyOk += 1;
      console.log(`  [ok]      ${displayName} — já publicado e já com cartão "${displayName}"`);
      continue;
    }

    const actions: string[] = [];
    if (willPublish) actions.push("publicar");
    if (willCreateCard) actions.push(`criar cartão "${displayName}"`);
    console.log(`  [${DRY_RUN ? "faria" : "fazendo"}]  ${displayName} — ${actions.join(" + ")}`);

    if (DRY_RUN) continue;

    if (willPublish) {
      await setProfessionalProfileStatus(id, "published", ACTOR_ID);
      published += 1;
    }
    if (willCreateCard) {
      await createProfileCard(id, { label: displayName }, ACTOR_ID);
      cardsCreated += 1;
    }
  }

  console.log("\n=== RESUMO ===");
  console.log(`Já publicados com cartão certo (nada a fazer): ${alreadyOk}`);
  console.log(`${DRY_RUN ? "Publicariam" : "Publicados agora"}: ${DRY_RUN ? "-" : published}`);
  console.log(`${DRY_RUN ? "Cartões que seriam criados" : "Cartões criados agora"}: ${DRY_RUN ? "-" : cardsCreated}`);
  console.log(`\nBloqueados (checklist incompleto) — ${blocked.length}:`);
  for (const b of blocked) {
    console.log(`  ${b.name.padEnd(35)} falta: ${b.missing.join(", ")}`);
  }
}

main().catch((err) => {
  console.error("ERRO:", err instanceof Error ? err.message : err);
  process.exit(1);
});
