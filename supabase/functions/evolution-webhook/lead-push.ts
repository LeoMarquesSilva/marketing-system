import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { LeadPush } from "./lead-push-format.ts";

export { buildLeadPush, isTeamConversation, type LeadPush } from "./lead-push-format.ts";

/**
 * Notificação push (Web Push) quando chega mensagem de lead. Só para quem tem
 * users.is_whatsapp_lead_notification_recipient; cada navegador inscrito fica em
 * whatsapp_push_subscriptions. O som toca pela página aberta (service worker em
 * public/whatsapp-push-sw.js) ou pelo próprio sistema quando não há aba aberta.
 */

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Contato que os serviços de push usam se houver problema com os envios. */
const VAPID_SUBJECT = "https://bismarchipires.com.br";

export function leadPushPublicKey(): string | null {
  return Deno.env.get("WHATSAPP_PUSH_VAPID_PUBLIC_KEY")?.trim() || null;
}

interface WebPush {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options: { TTL: number; urgency: string; topic?: string }
  ): Promise<{ statusCode: number }>;
}

let webPushPromise: Promise<WebPush | null> | null = null;

async function importWebPush(): Promise<WebPush> {
  const mod = await import("npm:web-push@3.6.7");
  return (mod.default ?? mod) as WebPush;
}

/**
 * Biblioteca carregada só na hora de mandar: se ela falhar no runtime, cai o
 * aviso, não o webhook. `null` = sem as chaves VAPID nos segredos da função.
 */
function loadWebPush(): Promise<WebPush | null> {
  webPushPromise ??= (async () => {
    const publicKey = leadPushPublicKey();
    const privateKey = Deno.env.get("WHATSAPP_PUSH_VAPID_PRIVATE_KEY")?.trim();
    if (!publicKey || !privateKey) return null;
    const webpush = await importWebPush();
    webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
    return webpush;
  })().catch((err) => {
    console.error("[evolution-webhook] web-push indisponível:", err);
    webPushPromise = null;
    return null;
  });
  return webPushPromise;
}

async function sendToSubscription(
  supabase: SupabaseClient,
  webpush: WebPush,
  sub: PushSubscriptionRow,
  push: LeadPush
): Promise<void> {
  const payload = JSON.stringify({
    type: "whatsapp-lead",
    title: push.title,
    body: push.body,
    conversationId: push.conversationId,
    url: `/trafego-pago?conversa=${push.conversationId}`,
  });
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      {
        TTL: 6 * 60 * 60,
        urgency: "high",
        // Celular/PC desligado: guarda só a última mensagem de cada conversa.
        topic: push.conversationId.replace(/-/g, "").slice(0, 32),
      }
    );
    await supabase
      .from("whatsapp_push_subscriptions")
      .update({ last_sent_at: new Date().toISOString(), last_error: null })
      .eq("id", sub.id);
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410: o navegador cancelou a inscrição (permissão retirada, perfil apagado).
    if (status === 404 || status === 410) {
      await supabase.from("whatsapp_push_subscriptions").delete().eq("id", sub.id);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[evolution-webhook] falha no push de lead:", status ?? "", message);
    await supabase
      .from("whatsapp_push_subscriptions")
      .update({ last_error: `${status ?? ""} ${message}`.trim().slice(0, 500) })
      .eq("id", sub.id);
  }
}

/** Manda as notificações para todos os navegadores de quem recebe aviso de lead. Não lança. */
export async function sendLeadPushes(
  supabase: SupabaseClient,
  pushes: LeadPush[]
): Promise<void> {
  try {
    if (pushes.length === 0) return;
    const webpush = await loadWebPush();
    if (!webpush) return;
    const { data, error } = await supabase
      .from("whatsapp_push_subscriptions")
      .select("id, endpoint, p256dh, auth, users!inner(is_whatsapp_lead_notification_recipient)")
      .eq("users.is_whatsapp_lead_notification_recipient", true);
    if (error) {
      console.error("[evolution-webhook] falha ao ler inscrições de push:", error.message);
      return;
    }
    const subs = (data ?? []) as PushSubscriptionRow[];
    for (const push of pushes) {
      await Promise.all(subs.map((sub) => sendToSubscription(supabase, webpush, sub, push)));
    }
  } catch (err) {
    console.error("[evolution-webhook] falha no push de lead:", err);
  }
}

/**
 * Teste manual (ação interna test_lead_push): manda um aviso de exemplo para a
 * inscrição informada ou, sem ela, para todos os inscritos. Devolve o resultado
 * de cada envio para conferir se o push sai da função.
 */
export async function sendTestLeadPush(
  supabase: SupabaseClient,
  subscription: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null
): Promise<{
  configured: boolean;
  library: string;
  results: { endpoint: string; status: number | string }[];
}> {
  const webpush = await loadWebPush();
  if (!webpush) {
    // Sem chaves, confere ao menos se a biblioteca carrega neste runtime.
    const library = await importWebPush()
      .then(() => "ok")
      .catch((err) => (err instanceof Error ? err.message : String(err)));
    return { configured: false, library, results: [] };
  }
  const targets: PushSubscriptionRow[] = [];
  if (subscription?.endpoint && subscription.keys?.p256dh && subscription.keys?.auth) {
    targets.push({
      id: "",
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });
  } else {
    const { data } = await supabase
      .from("whatsapp_push_subscriptions")
      .select("id, endpoint, p256dh, auth, users!inner(is_whatsapp_lead_notification_recipient)")
      .eq("users.is_whatsapp_lead_notification_recipient", true);
    targets.push(...((data ?? []) as PushSubscriptionRow[]));
  }

  const payload = JSON.stringify({
    type: "whatsapp-lead",
    title: "Teste · avisos de lead do WhatsApp",
    body: "Se você ouviu o som e viu este aviso, está tudo certo.",
    conversationId: null,
    url: "/trafego-pago",
  });
  const results: { endpoint: string; status: number | string }[] = [];
  for (const target of targets) {
    try {
      const res = await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        payload,
        { TTL: 60, urgency: "high" }
      );
      results.push({ endpoint: target.endpoint.slice(0, 60), status: res.statusCode });
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      results.push({
        endpoint: target.endpoint.slice(0, 60),
        status: status ?? (err instanceof Error ? err.message : String(err)),
      });
    }
  }
  return { configured: true, library: "ok", results };
}
