"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { authFetch } from "@/lib/auth-fetch";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/auth-context";

const RECONCILIATION_INTERVAL_MS = 10 * 60_000;
const STALE_CHECK_MS = 60_000;
const REALTIME_DEBOUNCE_MS = 600;

type CountListener = (value: number) => void;
type ConversationRow = { id?: unknown; unread_count?: unknown };
type UnreadPatch = { id: string; unreadCount: number };

const listeners = new Set<CountListener>();
let sharedTotalUnread = 0;
let activeUserId: string | null = null;
let channel: RealtimeChannel | null = null;
let reconciliationId: ReturnType<typeof setInterval> | null = null;
let debounceId: ReturnType<typeof setTimeout> | null = null;
let refreshPromise: Promise<void> | null = null;
let subscriptionGeneration = 0;
let lastRefreshAt = 0;

/**
 * Não lidas por conversa. O webhook grava `unread_count` na conversa a cada mensagem,
 * então o Realtime já traz o número novo: o badge se atualiza sem chamar a API
 * (cada chamada é uma função na Vercel, multiplicada por aba aberta).
 */
const unreadByConversation = new Map<string, number>();
/** Falso se a API não mandou o detalhe por conversa; aí cada evento volta a consultar. */
let perConversation = false;
/** Eventos que chegam durante uma consulta são reaplicados sobre a resposta dela. */
let patchesDuringRefresh: UnreadPatch[] | null = null;

function publish(value: number) {
  sharedTotalUnread = value;
  listeners.forEach((listener) => listener(value));
}

function applyPatch({ id, unreadCount }: UnreadPatch) {
  if (unreadCount > 0) unreadByConversation.set(id, unreadCount);
  else unreadByConversation.delete(id);
}

function publishFromConversations() {
  let total = 0;
  unreadByConversation.forEach((count) => {
    total += count;
  });
  publish(total);
}

async function refreshUnreadCount() {
  if (refreshPromise) return refreshPromise;
  if (!activeUserId) return;

  const generation = subscriptionGeneration;
  lastRefreshAt = Date.now();
  patchesDuringRefresh = [];
  const pending = (async () => {
    try {
      const res = await authFetch("/api/evolution/conversations?unreadSummary=1");
      if (!res.ok) return;
      const json = (await res.json()) as {
        totalUnread?: number;
        conversations?: { id?: unknown; unreadCount?: unknown }[];
      };
      if (generation !== subscriptionGeneration) return;

      if (!Array.isArray(json.conversations)) {
        perConversation = false;
        publish(Math.max(0, Number(json.totalUnread) || 0));
        return;
      }
      perConversation = true;
      unreadByConversation.clear();
      for (const row of json.conversations) {
        if (typeof row.id === "string") {
          applyPatch({ id: row.id, unreadCount: Math.max(0, Number(row.unreadCount) || 0) });
        }
      }
      patchesDuringRefresh?.forEach(applyPatch);
      publishFromConversations();
    } catch {
      /* O Realtime ou a próxima reconciliação tentará novamente. */
    }
  })();
  refreshPromise = pending;

  try {
    await pending;
  } finally {
    if (refreshPromise === pending) {
      refreshPromise = null;
      patchesDuringRefresh = null;
    }
  }
}

function scheduleRefresh() {
  if (debounceId) clearTimeout(debounceId);
  debounceId = setTimeout(() => {
    debounceId = null;
    void refreshUnreadCount();
  }, REALTIME_DEBOUNCE_MS);
}

function handleConversationChange(payload: RealtimePostgresChangesPayload<ConversationRow>) {
  if (!perConversation) {
    scheduleRefresh();
    return;
  }

  let patch: UnreadPatch | null = null;
  if (payload.eventType === "DELETE") {
    const id = payload.old?.id;
    if (typeof id === "string") patch = { id, unreadCount: 0 };
  } else {
    const { id, unread_count } = payload.new ?? {};
    if (typeof id === "string" && unread_count !== undefined) {
      patch = { id, unreadCount: Math.max(0, Number(unread_count) || 0) };
    }
  }

  // Evento sem os campos esperados: melhor consultar do que mostrar número errado.
  if (!patch) {
    scheduleRefresh();
    return;
  }
  patchesDuringRefresh?.push(patch);
  applyPatch(patch);
  publishFromConversations();
}

/** Reconcilia só com a aba visível; aba escondida não gera chamada. */
function refreshIfStale() {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - lastRefreshAt >= RECONCILIATION_INTERVAL_MS) void refreshUnreadCount();
}

function stopSharedSubscription() {
  subscriptionGeneration += 1;
  if (debounceId) clearTimeout(debounceId);
  if (reconciliationId) clearInterval(reconciliationId);
  if (channel) void supabase.removeChannel(channel);
  document.removeEventListener("visibilitychange", refreshIfStale);
  debounceId = null;
  reconciliationId = null;
  channel = null;
  activeUserId = null;
  refreshPromise = null;
  patchesDuringRefresh = null;
  perConversation = false;
  unreadByConversation.clear();
}

function startSharedSubscription(userId: string) {
  if (activeUserId === userId && channel) return;

  stopSharedSubscription();
  activeUserId = userId;
  void refreshUnreadCount();

  let subscribedOnce = false;
  channel = supabase
    .channel(`whatsapp-unread-badge-${userId}`)
    .on<ConversationRow>(
      "postgres_changes",
      { event: "*", schema: "public", table: "whatsapp_conversations" },
      handleConversationChange
    )
    .subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      // Reconectou (ex.: aba voltou do segundo plano): pode ter perdido eventos.
      if (subscribedOnce) scheduleRefresh();
      subscribedOnce = true;
    });

  reconciliationId = setInterval(refreshIfStale, STALE_CHECK_MS);
  document.addEventListener("visibilitychange", refreshIfStale);
}

export function useWhatsappUnreadCount() {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(sharedTotalUnread);

  useEffect(() => {
    if (!user?.id) return;

    const listener: CountListener = setTotalUnread;
    listeners.add(listener);
    startSharedSubscription(user.id);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) stopSharedSubscription();
    };
  }, [user?.id]);

  return user ? totalUnread : 0;
}
