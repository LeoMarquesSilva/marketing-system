/**
 * Guarda no Storage as mídias do WhatsApp que chegaram antes do webhook passar a
 * guardar (Edge Function evolution-webhook, ação archive_media). Quem baixa e
 * grava é a função; o script só manda os ids em lotes. Pode rodar de novo: pula o
 * que já tem arquivo ou já foi marcado como perdido.
 *
 * Com --transcripts, transcreve (ação transcribe_audio) os áudios que já têm
 * arquivo guardado e ainda estão sem audio_transcript.
 *
 * Uso: node scripts/backfill-whatsapp-media.mjs [--transcripts] [--dry-run]
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const secret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();
const dryRun = process.argv.includes("--dry-run");
const transcripts = process.argv.includes("--transcripts");
// Mídia vencida leva ~6 s na Evolution; lotes pequenos em paralelo ficam longe do
// limite de 150 s por chamada da Edge Function.
const BATCH = 2;
const PARALLEL = 4;

if (!supabaseUrl || !serviceKey) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function pendingQuery() {
  const query = supabase.from("whatsapp_messages").select("id");
  if (transcripts) {
    return query
      .not("media_storage_path", "is", null)
      .is("audio_transcript", null)
      .or("message_type.ilike.*audio*,message_type.eq.ptt");
  }
  return query
    .is("media_storage_path", null)
    .is("media_expired_at", null)
    .or(
      "message_type.ilike.*image*,message_type.ilike.*video*,message_type.ilike.*audio*,message_type.ilike.*document*,message_type.eq.ptt"
    );
}

async function pendingMessageIds() {
  const ids = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await pendingQuery()
      // As mais novas primeiro: são as que ainda têm o link do WhatsApp valendo.
      .order("message_timestamp", { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    ids.push(...data.map((row) => row.id));
    if (data.length < 1000) return ids;
  }
}

async function archive(messageIds) {
  const res = await fetch(`${supabaseUrl}/functions/v1/evolution-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(secret ? { apikey: secret } : {}) },
    body: JSON.stringify({
      action: transcripts ? "transcribe_audio" : "archive_media",
      messageIds,
    }),
  });
  if (!res.ok) throw new Error(`Edge Function ${res.status}: ${await res.text()}`);
  return (await res.json()).results ?? {};
}

async function main() {
  const ids = await pendingMessageIds();
  console.log(
    transcripts
      ? `${ids.length} áudios guardados sem transcrição.`
      : `${ids.length} mídias sem arquivo guardado.`
  );
  if (dryRun || ids.length === 0) return;

  const batches = [];
  for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));

  const totals = {};
  let done = 0;
  async function worker() {
    for (let batch = batches.shift(); batch; batch = batches.shift()) {
      let results;
      try {
        results = await archive(batch);
      } catch (err) {
        console.error("Lote falhou:", err.message);
        totals.falha_lote = (totals.falha_lote ?? 0) + batch.length;
        continue;
      }
      for (const id of batch) {
        const r = results[id] ?? { status: "sem_resposta" };
        const label = r.status === "skipped" ? `skipped:${r.reason}` : r.status;
        totals[label] = (totals[label] ?? 0) + 1;
        if (r.status === "error") console.error(`  ${id}: ${r.error}`);
      }
      done += batch.length;
      console.log(`${done}/${ids.length}`, JSON.stringify(totals));
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  console.log("Fim:", totals);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
