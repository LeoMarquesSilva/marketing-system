/**
 * Vincula empresas/contatos do RD Station aos grupos de cliente do SIOE.
 *
 * Uso:
 *   npx tsx scripts/link-rd-client-groups.js           # aplica
 *   npx tsx scripts/link-rd-client-groups.js --dry-run
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const { linkRdRecordsToSioeGroups } = await import("../src/lib/link-rd-client-groups-server.ts");
  const result = await linkRdRecordsToSioeGroups({ dryRun });

  console.log(dryRun ? "\n[DRY RUN — nenhuma alteração gravada]\n" : "\nVinculação concluída:\n");
  console.log(`  Grupos SIOE indexados: ${result.groupsIndexed}`);
  console.log(`  Empresas RD casadas:   ${result.companiesMatched}${dryRun ? "" : ` (${result.companiesUpdated} atualizadas)`}`);
  console.log(`  Contatos RD casados:   ${result.contactsMatched}${dryRun ? "" : ` (${result.contactsUpdated} atualizados)`}`);

  if (result.ambiguousSamples.length > 0) {
    console.log("\nCasamentos ambíguos (ignorados):");
    for (const s of result.ambiguousSamples.slice(0, 10)) console.log(`  - ${s}`);
  }

  if (result.unmatchedCompanySamples.length > 0) {
    console.log("\nExemplos sem grupo SIOE correspondente:");
    for (const s of result.unmatchedCompanySamples.slice(0, 15)) console.log(`  - ${s}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
