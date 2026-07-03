/**
 * Sincroniza processos (processos_completo) do SIOE PRO → email_group_responsibles.
 * Uso: npx tsx scripts/sync-sioe-responsibles.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

async function main() {
  const { syncSioeResponsiblesOnly, isSioeSyncConfigured } = await import(
    "../src/lib/sioe-sync-server.ts"
  );

  if (!isSioeSyncConfigured()) {
    console.error("Configure SIOE_SUPABASE_SERVICE_ROLE_KEY no .env");
    process.exit(1);
  }

  console.log("Sincronizando responsáveis/áreas do SIOE PRO...");
  const result = await syncSioeResponsiblesOnly();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
