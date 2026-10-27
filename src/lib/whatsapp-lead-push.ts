/**
 * Avisos de lead do WhatsApp no navegador: Web Push (service worker em
 * public/whatsapp-push-sw.js) + som tocado pela página. Quem manda o push é a
 * Edge Function evolution-webhook, só para users.is_whatsapp_lead_notification_recipient.
 */

export const WHATSAPP_PUSH_SW_URL = "/whatsapp-push-sw.js";

/** Parâmetro que abre uma conversa na caixa de entrada (/trafego-pago?conversa=<id>). */
export const WHATSAPP_CONVERSATION_PARAM = "conversa";

export const WHATSAPP_INBOX_PATH = "/trafego-pago";

export function whatsappConversationUrl(conversationId: string): string {
  return `${WHATSAPP_INBOX_PATH}?${WHATSAPP_CONVERSATION_PARAM}=${encodeURIComponent(conversationId)}`;
}

/** Chave VAPID (base64url) no formato que o PushManager espera. */
export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** A inscrição foi feita com esta chave? Se a chave do servidor mudou, inscreve de novo. */
export function sameApplicationServerKey(
  current: ArrayBuffer | null | undefined,
  expected: Uint8Array
): boolean {
  if (!current) return false;
  const bytes = new Uint8Array(current);
  if (bytes.length !== expected.length) return false;
  return bytes.every((byte, i) => byte === expected[i]);
}

/** Chave pública VAPID publicada pela Edge Function; `null` = push ainda não configurado. */
export async function fetchWhatsappPushPublicKey(): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!supabaseUrl) return null;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/evolution-webhook`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { vapidPublicKey?: string | null };
    return json.vapidPublicKey?.trim() || null;
  } catch {
    return null;
  }
}

let audioContext: AudioContext | null = null;

/**
 * O navegador só deixa tocar som depois de um clique na página. Chamado no
 * primeiro clique/tecla e no botão "Ativar".
 */
export function unlockLeadChime(): void {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") void audioContext.resume();
  } catch {
    // Sem Web Audio: fica só o som do aviso do sistema.
  }
}

/** Dois toques curtos (sem arquivo de áudio). `false` se o navegador não deixou tocar. */
export async function playLeadChime(): Promise<boolean> {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") await audioContext.resume().catch(() => {});
    if (audioContext.state !== "running") return false;

    const ctx = audioContext;
    const start = ctx.currentTime + 0.02;
    for (const [offset, frequency] of [
      [0, 880],
      [0.16, 1320],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.34);
    }
    return true;
  } catch {
    return false;
  }
}
