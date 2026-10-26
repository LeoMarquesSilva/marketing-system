/**
 * Transcrição dos áudios do WhatsApp com Whisper, igual ao botão "Transcrever"
 * (transcribeWhatsappAudioMessage em src/lib/evolution-whatsapp.ts). Feita assim
 * que o áudio é guardado, para o texto das conversas ficar salvo (base da futura
 * documentação de atendimento).
 */

/** Limite da API de transcrição da OpenAI. */
export const MAX_TRANSCRIPTION_BYTES = 25 * 1024 * 1024;

/** Formatos que o Whisper reconhece pela extensão do nome do arquivo. */
const WHISPER_EXTENSIONS = new Set([
  "flac",
  "m4a",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "oga",
  "ogg",
  "wav",
  "webm",
]);

export function whisperFileName(storagePath: string | null): string {
  const ext = storagePath?.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  return `audio.${ext && WHISPER_EXTENSIONS.has(ext) ? ext : "ogg"}`;
}

export async function transcribeAudio(
  bytes: Uint8Array,
  mimetype: string,
  fileName: string,
  apiKey: string
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimetype }), fileName);
  form.append("model", "whisper-1");
  form.append("language", "pt");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    text?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Whisper respondeu ${res.status}.`);
  }
  return (json.text ?? "").trim();
}
