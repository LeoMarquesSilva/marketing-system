"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { authFetch } from "@/lib/auth-fetch";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/auth-context";

const RECONCILIATION_INTERVAL_MS = 10 * 60_000;
const REALTIME_DEBOUNCE_MS = 600;

type CountListener = (value: number) => void;

const listeners = new Set<CountListener>();
let sharedTotalUnread = 0;
let activeUserId: string | null = null;
let channel: RealtimeChannel | null = null;
let reconciliationId: ReturnType<typeof setInterval> | null = null;
let debounceId: ReturnType<typeof setTimeout> | null = null;
let refreshPromise: Promise<void> | null = null;
let subscriptionGeneration = 0;

function publish(value: number) {
  sharedTotalUnread = value;
  listeners.forEach((listener) => listener(value));
}

async function refreshUnreadCount() {
  if (refreshPromise) return refreshPromise;
  if (!activeUserId) return;

  const generation = subscriptionGeneration;
  const pending = (async () => {
    try {
      const res = await authFetch("/api/evolution/conversations?unreadSummary=1");
      if (!res.ok) return;
      const json = (await res.json()) as { totalUnread?: number };
      if (generation === subscriptionGeneration) {
        publish(Math.max(0, Number(json.totalUnread) || 0));
      }
    } catch {
      /* O Realtime ou a próxima reconciliação tentará novamente. */
    }
  })();
  refreshPromise = pending;

  try {
    await pending;
  } finally {
    if (refreshPromise === pending) refreshPromise = null;
  }
}

function scheduleRefresh() {
  if (debounceId) clearTimeout(debounceId);
  debounceId = setTimeout(() => {
    debounceId = null;
    void refreshUnreadCount();
  }, REALTIME_DEBOUNCE_MS);
}

function stopSharedSubscription() {
  subscriptionGeneration += 1;
  if (debounceId) clearTimeout(debounceId);
  if (reconciliationId) clearInterval(reconciliationId);
  if (channel) void supabase.removeChannel(channel);
  debounceId = null;
  reconciliationId = null;
  channel = null;
  activeUserId = null;
  refreshPromise = null;
}

function startSharedSubscription(userId: string) {
  if (activeUserId === userId && channel) return;

  stopSharedSubscription();
  activeUserId = userId;
  void refreshUnreadCount();

  channel = supabase
    .channel(`whatsapp-unread-badge-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "whatsapp_conversations" },
      scheduleRefresh
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "whatsapp_messages" },
      scheduleRefresh
    )
    .subscribe();

  reconciliationId = setInterval(
    () => void refreshUnreadCount(),
    RECONCILIATION_INTERVAL_MS
  );
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
