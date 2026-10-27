import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { readEvolutionMediaResponse } from "./media-response.ts";
import { MAX_TRANSCRIPTION_BYTES, transcribeAudio, whisperFileName } from "./transcription.ts";

/**
 * Mídias do WhatsApp guardadas no Storage. A Evolution só sabe baixar o arquivo
 * pelo link do WhatsApp (mmg.whatsapp.net), que some em ~2 semanas; depois disso
 * getBase64FromMediaMessage devolve "Failed to fetch stream" para sempre. Aqui
 * baixamos assim que a mensagem chega e gravamos no bucket privado.
 */
export const WHATSAPP_MEDIA_BUCKET = "MARKETING-SYSTEM-WHATSAPP";

export const MEDIA_ROW_SELECT =
  "id, conversation_id, wa_message_id, remote_jid, from_me, message_type, body, instance_name, message_timestamp, raw_payload, media_storage_path, media_mimetype, media_expired_at, audio_transcript";

/**
 * O arquivo decodificado fica ~2× na memória da função (256 MB) até subir, e o
 * bucket aceita até 50 MB. Acima disso a mídia fica só na Evolution, como antes.
 */
const MAX_MEDIA_BYTES = 40 * 1024 * 1024;

/**
 * O link pode sumir antes do "oe" que vem nele, então não dá para saber pela URL.
 * Mensagem recente que falha pode ser instabilidade: só marcamos como perdida
 * depois de alguns dias.
 */
const EXPIRED_MIN_AGE_MS = 3 * 24 * 60 * 60 * 1000;

type MediaKind = "image" | "video" | "audio" | "document";

export interface MediaRow {
  id: string;
  conversation_id: string | null;
  wa_message_id: string | null;
  remote_jid: string | null;
  from_me: boolean | null;
  message_type: string | null;
  body: string | null;
  instance_name: string | null;
  message_timestamp: string | null;
  raw_payload: Record<string, unknown> | null;
  media_storage_path: string | null;
  media_mimetype: string | null;
  media_expired_at: string | null;
  audio_transcript: string | null;
}

export type TranscriptionResult =
  | { status: "transcribed"; chars: number }
  | {
      status: "skipped";
      reason: "already" | "not_audio" | "no_file" | "empty" | "too_large" | "no_key";
    }
  | { status: "error"; error: string };

export type ArchiveResult =
  | { status: "stored"; path: string; mimetype: string }
  | { status: "expired" }
  | { status: "skipped"; reason: "not_media" | "too_large" | "not_found" }
  | { status: "error"; error: string };

/** Mesma regra de fetchEvolutionMessageMedia (src/lib/evolution-whatsapp.ts). */
export function mediaKindOf(
  messageType: string | null | undefined,
  body: string | null | undefined
): MediaKind | null {
  const t = (messageType ?? "").toLowerCase();
  const b = (body ?? "").trim().toLowerCase();
  if (t.includes("image") || b.startsWith("[imagem]")) return "image";
  if (t.includes("video") || b.startsWith("[vídeo]") || b.startsWith("[video]")) return "video";
  if (t.includes("document") || b.startsWith("[documento]")) return "document";
  if (t.includes("audio") || t === "ptt" || b === "[áudio]") return "audio";
  return null;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "video/quicktime": "mov",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "application/pdf": "pdf",
};

function extensionFor(mimetype: string, fileName: string | null): string {
  const fromName = fileName?.match(/\.([a-z0-9]{1,8})$/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  return EXTENSION_BY_MIME[mimetype.split(";")[0].trim().toLowerCase()] ?? "bin";
}

type EvolutionMedia =
  | { ok: true; bytes: Uint8Array; mimetype: string | null; fileName: string | null }
  | { ok: false; reason: "expired" | "too_large" | "not_found" | "error"; error: string };

/**
 * `content` é o `message` que veio no webhook. Com ele a Evolution não precisa
 * achar a mensagem no banco dela, que às vezes a guarda sem conteúdo
 * (`message: null` → "Cannot read properties of null"). Sem ele, ou se falhar
 * por outro motivo, busca só pela chave, como fazia a rota de mídia.
 */
async function downloadFromEvolution(
  row: MediaRow,
  kind: MediaKind,
  content: Record<string, unknown> | null
): Promise<EvolutionMedia> {
  const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.trim().replace(/\/$/, "");
  const apiKey = Deno.env.get("EVOLUTION_API_KEY")?.trim();
  const instanceName = row.instance_name ?? Deno.env.get("EVOLUTION_INSTANCE") ?? "BP";
  if (!baseUrl || !apiKey) {
    return { ok: false, reason: "error", error: "Evolution API não configurada na função." };
  }

  const rawKey = (row.raw_payload?.key as Record<string, unknown> | undefined) ?? {};
  const key = {
    id: (rawKey.id as string | undefined) ?? row.wa_message_id,
    remoteJid: (rawKey.remoteJid as string | undefined) ?? row.remote_jid,
    fromMe: (rawKey.fromMe as boolean | undefined) ?? row.from_me,
  };
  const url = `${baseUrl}/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`;

  if (content) {
    const media = await requestEvolutionMedia(url, apiKey, { key, message: content }, kind);
    if (media.ok || media.reason === "expired" || media.reason === "too_large") return media;
  }
  return requestEvolutionMedia(url, apiKey, { key }, kind);
}

async function requestEvolutionMedia(
  url: string,
  apiKey: string,
  message: Record<string, unknown>,
  kind: MediaKind
): Promise<EvolutionMedia> {
  const res = await fetch(url, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ message, convertToMp4: kind === "video" }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 500);
    if (/failed to fetch stream/i.test(text)) {
      return { ok: false, reason: "expired", error: text };
    }
    // Mensagens até jul/2026 são da instância "BP", que não existe mais na Evolution;
    // "ephemeralMessage" é a Evolution com a mensagem guardada sem conteúdo.
    if (/message not found|instance does not exist|reading 'ephemeralMessage'/i.test(text)) {
      return { ok: false, reason: "not_found", error: text };
    }
    return { ok: false, reason: "error", error: `Evolution ${res.status}: ${text}` };
  }

  if (!res.body) {
    return { ok: false, reason: "error", error: "Evolution respondeu sem corpo." };
  }
  const parsed = await readEvolutionMediaResponse(res.body, MAX_MEDIA_BYTES);
  if (parsed.status === "too_large") {
    return { ok: false, reason: "too_large", error: "Mídia acima do limite para guardar." };
  }
  if (parsed.status === "no_media") {
    return { ok: false, reason: "error", error: "Evolution não devolveu a mídia." };
  }
  const { mimetype, fileName } = parsed.meta as { mimetype?: unknown; fileName?: unknown };
  return {
    ok: true,
    bytes: parsed.bytes,
    mimetype: typeof mimetype === "string" ? mimetype : null,
    fileName: typeof fileName === "string" ? fileName : null,
  };
}

function fallbackMimetype(kind: MediaKind): string {
  if (kind === "image") return "image/jpeg";
  if (kind === "video") return "video/mp4";
  if (kind === "document") return "application/octet-stream";
  return "audio/ogg; codecs=opus";
}

function isOldEnoughToGiveUp(row: MediaRow): boolean {
  const ts = row.message_timestamp ? new Date(row.message_timestamp).getTime() : NaN;
  return Number.isFinite(ts) && Date.now() - ts > EXPIRED_MIN_AGE_MS;
}

/** Baixa a mídia da mensagem na Evolution e grava no Storage. Idempotente. */
export async function archiveMessageMedia(
  supabase: SupabaseClient,
  row: MediaRow,
  content: Record<string, unknown> | null = null
): Promise<ArchiveResult> {
  if (row.media_storage_path) {
    return {
      status: "stored",
      path: row.media_storage_path,
      mimetype: row.media_mimetype ?? "application/octet-stream",
    };
  }
  if (row.media_expired_at) return { status: "expired" };

  const kind = mediaKindOf(row.message_type, row.body);
  if (!kind) return { status: "skipped", reason: "not_media" };

  const media = await downloadFromEvolution(row, kind, content);
  if (!media.ok) {
    // Sem o arquivo no WhatsApp ou sem a mensagem na Evolution, não há de onde baixar.
    const gone = media.reason === "expired" || media.reason === "not_found";
    if (gone && isOldEnoughToGiveUp(row)) {
      await supabase
        .from("whatsapp_messages")
        .update({ media_expired_at: new Date().toISOString() })
        .eq("id", row.id);
      return { status: "expired" };
    }
    if (media.reason === "expired") return { status: "expired" };
    if (media.reason === "too_large" || media.reason === "not_found") {
      return { status: "skipped", reason: media.reason };
    }
    return { status: "error", error: media.error };
  }

  const mimetype = media.mimetype ?? fallbackMimetype(kind);
  const path = `${row.conversation_id ?? "sem-conversa"}/${row.id}.${extensionFor(mimetype, media.fileName)}`;
  const { error: uploadError } = await supabase.storage
    .from(WHATSAPP_MEDIA_BUCKET)
    .upload(path, media.bytes, { contentType: mimetype, upsert: true });
  if (uploadError) return { status: "error", error: uploadError.message };

  const { error: updateError } = await supabase
    .from("whatsapp_messages")
    .update({ media_storage_path: path, media_mimetype: mimetype, media_expired_at: null })
    .eq("id", row.id);
  if (updateError) return { status: "error", error: updateError.message };

  if (kind === "audio") {
    // Em segundo plano: nem o webhook nem a rota de mídia esperam o Whisper.
    EdgeRuntime.waitUntil(
      transcribeMessageAudio(
        supabase,
        { ...row, media_storage_path: path, media_mimetype: mimetype },
        media.bytes
      ).then((result) => {
        if (result.status === "error") {
          console.error("[evolution-webhook] falha ao transcrever áudio:", row.id, result.error);
        }
      })
    );
  }

  return { status: "stored", path, mimetype };
}

/**
 * Transcreve o áudio da mensagem e grava em `audio_transcript`. Não lança: falha
 * aqui não pode afetar o webhook nem a mídia guardada. `bytes` evita baixar de
 * novo do Storage quando o áudio acabou de chegar.
 */
export async function transcribeMessageAudio(
  supabase: SupabaseClient,
  row: MediaRow,
  bytes: Uint8Array | null = null
): Promise<TranscriptionResult> {
  try {
    if (mediaKindOf(row.message_type, row.body) !== "audio") {
      return { status: "skipped", reason: "not_audio" };
    }
    if (row.audio_transcript?.trim()) return { status: "skipped", reason: "already" };
    // Chave própria do atendimento separa o gasto no painel da OpenAI.
    const apiKey =
      Deno.env.get("OPENAI_API_KEY_ATENDIMENTO")?.trim() || Deno.env.get("OPENAI_API_KEY")?.trim();
    if (!apiKey) return { status: "skipped", reason: "no_key" };

    let audio = bytes;
    if (!audio) {
      if (!row.media_storage_path) return { status: "skipped", reason: "no_file" };
      const { data, error } = await supabase.storage
        .from(WHATSAPP_MEDIA_BUCKET)
        .download(row.media_storage_path);
      if (error || !data) {
        return { status: "error", error: error?.message ?? "Áudio não encontrado no Storage." };
      }
      audio = new Uint8Array(await data.arrayBuffer());
    }
    if (audio.byteLength > MAX_TRANSCRIPTION_BYTES) {
      return { status: "skipped", reason: "too_large" };
    }

    const text = await transcribeAudio(
      audio,
      row.media_mimetype ?? "audio/ogg",
      whisperFileName(row.media_storage_path),
      apiKey
    );
    if (!text) return { status: "skipped", reason: "empty" };

    // Se alguém clicou em "Transcrever" enquanto isso, fica o texto que já estava.
    const { error } = await supabase
      .from("whatsapp_messages")
      .update({ audio_transcript: text })
      .eq("id", row.id)
      .is("audio_transcript", null);
    if (error) return { status: "error", error: error.message };
    return { status: "transcribed", chars: text.length };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

/** Transcreve os áudios já guardados das mensagens indicadas (ação interna e backfill). */
export async function transcribeMessagesAudio(
  supabase: SupabaseClient,
  messageIds: string[]
): Promise<Record<string, TranscriptionResult>> {
  const results: Record<string, TranscriptionResult> = {};
  if (messageIds.length === 0) return results;

  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select(MEDIA_ROW_SELECT)
    .in("id", messageIds);
  if (error) {
    for (const id of messageIds) results[id] = { status: "error", error: error.message };
    return results;
  }

  const rows = new Map(((data ?? []) as MediaRow[]).map((row) => [row.id, row]));
  for (const id of messageIds) {
    const row = rows.get(id);
    results[id] = row
      ? await transcribeMessageAudio(supabase, row)
      : { status: "skipped", reason: "no_file" };
    if (results[id].status === "error") {
      console.error("[evolution-webhook] falha ao transcrever áudio:", id, results[id]);
    }
  }
  return results;
}

/**
 * Guarda as mídias das mensagens indicadas. `attempts` > 1 é para o webhook: a
 * mensagem acabou de chegar e a Evolution pode ainda não ter terminado de salvá-la.
 * `contents` traz, por id, o `message` recebido no webhook.
 */
export async function archiveMessagesMedia(
  supabase: SupabaseClient,
  messageIds: string[],
  options: {
    attempts?: number;
    contents?: Map<string, Record<string, unknown> | null>;
  } = {}
): Promise<Record<string, ArchiveResult>> {
  const attempts = Math.max(1, options.attempts ?? 1);
  const results: Record<string, ArchiveResult> = {};
  if (messageIds.length === 0) return results;

  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select(MEDIA_ROW_SELECT)
    .in("id", messageIds);
  if (error) {
    for (const id of messageIds) results[id] = { status: "error", error: error.message };
    return results;
  }

  const rows = new Map(((data ?? []) as MediaRow[]).map((row) => [row.id, row]));
  for (const id of messageIds) {
    const row = rows.get(id);
    if (!row) {
      results[id] = { status: "skipped", reason: "not_found" };
      continue;
    }
    let result: ArchiveResult = { status: "error", error: "não tentado" };
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        result = await archiveMessageMedia(supabase, row, options.contents?.get(id) ?? null);
      } catch (err) {
        result = { status: "error", error: err instanceof Error ? err.message : String(err) };
      }
      const retry =
        result.status === "error" ||
        (result.status === "skipped" && result.reason === "not_found");
      if (!retry || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
    }
    if (result.status === "error") {
      console.error("[evolution-webhook] falha ao guardar mídia:", id, result.error);
    }
    results[id] = result;
  }
  return results;
}
