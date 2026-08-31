/**
 * Grava responsible_area inferida em grupos que já aparecem com área na UI
 * (única área envolvida) mas ainda têm a coluna vazia.
 *
 * Uso: npx tsx scripts/backfill-inferred-responsible-area.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { persistInferredClientGroupResponsibleAreas } = await import(
    "@/lib/persist-inferred-responsible-areas"
  );
  const { updated } = await persistInferredClientGroupResponsibleAreas();
  console.log(`Grupos atualizados: ${updated.length}`);
  for (const row of updated.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))) {
    console.log(`${row.area}\t${row.name}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
