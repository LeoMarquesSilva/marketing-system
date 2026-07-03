/**
 * Aponta o webhook da Evolution (instância BP) para a Edge Function no ORQESTRAI.
 * Uso: node scripts/configure-evolution-webhook.js
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const base = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
const apiKey = process.env.EVOLUTION_API_KEY;
const instance = process.env.EVOLUTION_INSTANCE || "BP";
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");

if (!base || !apiKey || !supabaseUrl) {
  console.error("Configure EVOLUTION_API_URL, EVOLUTION_API_KEY e NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook`;
const events = ["MESSAGES_UPSERT", "SEND_MESSAGE", "MESSAGES_UPDATE"];

async function main() {
  const res = await fetch(`${base}/webhook/set/${instance}`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        events,
      },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Falha ao configurar webhook:", res.status, text);
    process.exit(1);
  }

  console.log("Webhook configurado:");
  console.log("  URL:", webhookUrl);
  console.log("  Events:", events.join(", "));
  if (text) console.log("  Resposta:", text);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
