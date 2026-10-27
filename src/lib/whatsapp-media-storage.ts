import type { SupabaseClient } from "@supabase/supabase-js";
import { whatsappMediaCaption } from "@/lib/evolution-leads";

/**
 * Bucket privado com as mídias do WhatsApp. Quem grava é a Edge Function
 * evolution-webhook (supabase/functions/evolution-webhook/media.ts), assim que a
 * mensagem chega: o link do WhatsApp que a Evolution usa some em ~2 semanas.
 */
export const WHATSAPP_MEDIA_BUCKET = "MARKETING-SYSTEM-WHATSAPP";

/** A conversa fica aberta o dia todo, e vídeo/áudio pedem o arquivo de novo ao tocar. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 12;

export type WhatsappMediaArchiveResult =
  | { status: "stored"; path: string; mimetype: string }
  | { status: "expired" }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };

/** Nome do documento no download: o que veio no body, com a extensão do arquivo guardado. */
export function whatsappDocumentDownloadName(
  body: string | null | undefined,
  storagePath: string
): string {
  const ext = storagePath.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  const label = (whatsappMediaCaption(body ?? null, "document") ?? "documento").replace(
    /[\\/]/g,
    "-"
  );
  if (!ext || label.toLowerCase().endsWith(`.${ext}`)) return label;
  return `${label}.${ext}`;
}

export async function signWhatsappMediaUrl(
  supabase: SupabaseClient,
  path: string,
  downloadName?: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(WHATSAPP_MEDIA_BUCKET)
    .createSignedUrl(
      path,
      SIGNED_URL_TTL_SECONDS,
      downloadName ? { download: downloadName } : undefined
    );
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Erro ao gerar o link da mídia.");
  }
  return data.signedUrl;
}

/**
 * Pede à Edge Function que baixe a mídia na Evolution e guarde no Storage. O
 * base64 fica no Supabase; a Vercel só recebe o caminho. `null` = função fora do
 * ar ou sem resposta (quem chama decide se cai no caminho antigo).
 */
export async function requestWhatsappMediaArchive(
  messageId: string
): Promise<WhatsappMediaArchiveResult | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  if (!supabaseUrl || supabaseUrl.includes("placeholder")) return null;
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim().replace(/\r$/, "");

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/evolution-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { apikey: secret } : {}),
      },
      body: JSON.stringify({ action: "archive_media", messageIds: [messageId] }),
      cache: "no-store",
      signal: AbortSignal.timeout(50_000),
    });
    if (!res.ok) {
      console.error("[whatsapp-media] Edge Function respondeu", res.status);
      return null;
    }
    const json = (await res.json()) as {
      results?: Record<string, WhatsappMediaArchiveResult>;
    };
    return json.results?.[messageId] ?? null;
  } catch (err) {
    console.error("[whatsapp-media] falha ao pedir para guardar a mídia:", err);
    return null;
  }
}
