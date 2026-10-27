"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BellRing, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/utils/supabase/client";
import {
  fetchWhatsappPushPublicKey,
  playLeadChime,
  sameApplicationServerKey,
  unlockLeadChime,
  urlBase64ToUint8Array,
  WHATSAPP_INBOX_PATH,
  WHATSAPP_PUSH_SW_URL,
} from "@/lib/whatsapp-lead-push";

const DISMISS_KEY = "orqestrai:whatsapp-lead-push-dismissed-at";
const DISMISS_MS = 3 * 24 * 60 * 60 * 1000;
const TOAST_MS = 8000;

/** prompt = mostrar o convite para ativar; on = inscrito; o resto não mostra nada. */
type PushState = "idle" | "prompt" | "on" | "blocked" | "unavailable";

interface LeadToast {
  id: number;
  title: string;
  body: string;
  url: string;
}

interface WorkerMessage {
  type?: string;
  title?: string;
  body?: string;
  url?: string;
}

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

function rememberDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Sem storage o convite só volta a aparecer na próxima visita.
  }
}

/** Inscreve este navegador (ou confirma a inscrição atual) e guarda no Supabase. */
async function ensureSubscription(userId: string, publicKey: string): Promise<void> {
  await navigator.serviceWorker.register(WHATSAPP_PUSH_SW_URL);
  const registration = await navigator.serviceWorker.ready;
  const key = urlBase64ToUint8Array(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameApplicationServerKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });

  const { keys } = subscription.toJSON();
  const { error } = await supabase.from("whatsapp_push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: keys?.p256dh,
      auth: keys?.auth,
      user_agent: navigator.userAgent.slice(0, 300),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) throw new Error(error.message);
}

/**
 * Notificação com som quando chega mensagem de lead no WhatsApp, só para quem
 * tem users.is_whatsapp_lead_notification_recipient. O push vem da Edge Function
 * evolution-webhook; aqui ficam o convite para ativar, o som e o aviso na tela.
 */
export function WhatsappLeadNotifications() {
  const { profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const userId = profile?.is_whatsapp_lead_notification_recipient ? profile.id : null;
  const [state, setState] = useState<PushState>("idle");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<LeadToast | null>(null);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // O navegador só deixa tocar som depois do primeiro clique ou tecla na página.
  useEffect(() => {
    if (!userId) return;
    const unlock = () => unlockLeadChime();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (!pushSupported()) {
      setState("unavailable");
      return;
    }
    let cancelled = false;
    void (async () => {
      const key = await fetchWhatsappPushPublicKey();
      if (cancelled) return;
      if (!key) {
        setState("unavailable");
        return;
      }
      setPublicKey(key);
      if (Notification.permission === "denied") {
        setState("blocked");
        return;
      }
      if (Notification.permission === "granted") {
        try {
          // Renova a inscrição a cada visita: o navegador pode trocar o endpoint.
          await ensureSubscription(userId, key);
          if (!cancelled) setState("on");
        } catch (err) {
          console.error("[whatsapp-lead-push]", err);
          if (!cancelled) setState("prompt");
        }
        return;
      }
      setState(dismissedRecently() ? "idle" : "prompt");
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const openUrl = useCallback(
    (url: string) => {
      if (pathnameRef.current === WHATSAPP_INBOX_PATH) {
        // Já na caixa de entrada: troca só a URL, sem ir ao servidor.
        window.history.pushState(null, "", url);
      } else {
        router.push(url);
      }
    },
    [router]
  );

  useEffect(() => {
    if (!userId || !pushSupported()) return;
    const onMessage = (event: MessageEvent<WorkerMessage | null>) => {
      const data = event.data;
      if (data?.type === "whatsapp-lead") {
        const port = event.ports[0];
        void playLeadChime().then((played) => {
          port?.postMessage({ played });
          if (document.hasFocus()) {
            setToast({
              id: Date.now(),
              title: data.title ?? "Mensagem no WhatsApp",
              body: data.body ?? "",
              url: data.url ?? WHATSAPP_INBOX_PATH,
            });
          }
        });
      } else if (data?.type === "whatsapp-open" && data.url) {
        openUrl(data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [userId, openUrl]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activate = async () => {
    if (!userId || !publicKey) return;
    unlockLeadChime();
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "prompt");
        if (permission === "denied") {
          setError("O navegador bloqueou as notificações deste site.");
        }
        return;
      }
      await ensureSubscription(userId, publicKey);
      setState("on");
      void playLeadChime();
      setToast({
        id: Date.now(),
        title: "Avisos de lead ativados",
        body: "Você vai ouvir este som e ver um aviso a cada mensagem de lead.",
        url: WHATSAPP_INBOX_PATH,
      });
    } catch (err) {
      console.error("[whatsapp-lead-push]", err);
      setError("Não foi possível ativar os avisos neste navegador.");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    rememberDismissed();
    setState("idle");
  };

  if (!userId) return null;

  return (
    <>
      {state === "prompt" && (
        <div
          role="dialog"
          aria-labelledby="whatsapp-lead-push-title"
          className="fixed right-5 top-[4.5rem] z-50 w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border bg-background p-4 shadow-lg"
        >
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <BellRing className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p id="whatsapp-lead-push-title" className="text-sm font-semibold">
                Avisos de lead do WhatsApp
              </p>
              <p className="text-xs text-muted-foreground">
                Notificação com som a cada mensagem de lead, mesmo com o ORQESTRAI em outra aba
                ou minimizado.
              </p>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => void activate()} disabled={busy || !publicKey}>
                  {busy ? "Ativando…" : "Ativar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss} disabled={busy}>
                  Agora não
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && state !== "prompt" && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="fixed right-5 top-[4.5rem] z-50 w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border bg-background p-3 shadow-lg"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <MessageCircle className="h-4 w-4" />
            </span>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                openUrl(toast.url);
                setToast(null);
              }}
            >
              <p className="truncate text-sm font-semibold">{toast.title}</p>
              {toast.body && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{toast.body}</p>
              )}
            </button>
            <button
              type="button"
              aria-label="Fechar aviso"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              onClick={() => setToast(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
