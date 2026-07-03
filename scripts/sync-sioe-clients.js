/**
 * Sincroniza clientes ativos do SIOE PRO para email_contacts / email_companies.
 * Uso: npx tsx scripts/sync-sioe-clients.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

async function main() {
  const { syncSioeActiveClients, testSioeConnection, isSioeSyncConfigured } = await import(
    "../src/lib/sioe-sync-server.ts"
  );

  if (!isSioeSyncConfigured()) {
    console.error("Configure SIOE_SUPABASE_SERVICE_ROLE_KEY no .env");
    process.exit(1);
  }

  const test = await testSioeConnection();
  if (!test.ok) {
    console.error("Falha ao conectar no SIOE PRO:", test.message);
    process.exit(1);
  }

  console.log(
    `SIOE PRO OK — ${test.activeClients} clientes ativos, ${test.withEmail} com e-mail válido.`
  );
  console.log("Sincronizando...");

  const result = await syncSioeActiveClients();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
