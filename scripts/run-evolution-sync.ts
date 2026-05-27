import { config } from "dotenv";
config();

async function main() {
  const {
    syncEvolutionMessages,
    fetchWhatsappConversations,
    fetchEvolutionRecentMessages,
    getEvolutionConfig,
  } = await import("../src/lib/evolution-whatsapp");

  console.log("config:", getEvolutionConfig()?.instanceName);
  const preview = await fetchEvolutionRecentMessages({ limit: 5 });
  console.log("preview fetch:", preview.length, preview[0]?.body?.slice(0, 60));

  const result = await syncEvolutionMessages({ limit: 30 });
  console.log("sync result:", result);

  const conversations = await fetchWhatsappConversations(10);
  console.log(
    "conversations:",
    conversations.length,
    conversations.slice(0, 3).map((c) => ({
      name: c.push_name,
      preview: c.last_message_preview?.slice(0, 80),
    }))
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
