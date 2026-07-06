"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabase/client";

export type MeusClientesRealtimeStatus = "connecting" | "connected" | "unavailable";

const REALTIME_TABLES = [
  "email_contacts",
  "email_people",
  "email_companies",
  "email_group_responsibles",
  "email_client_groups",
] as const;

const DEBOUNCE_MS = 450;

export function useMeusClientesRealtime(options: {
  enabled?: boolean;
  /** Evita sobrescrever formulários abertos; flush ao fechar. */
  paused?: boolean;
  onRefresh: () => void;
}) {
  const { enabled = true, paused = false, onRefresh } = options;
  const [status, setStatus] = useState<MeusClientesRealtimeStatus>("connecting");
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRefreshRef = useRef(onRefresh);
  const pausedRef = useRef(paused);

  onRefreshRef.current = onRefresh;
  pausedRef.current = paused;

  const flushRefresh = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onRefreshRef.current();
      pendingRef.current = false;
    }, DEBOUNCE_MS);
  };

  const scheduleRefresh = () => {
    if (pausedRef.current) {
      pendingRef.current = true;
      return;
    }
    flushRefresh();
  };

  useEffect(() => {
    if (!paused && pendingRef.current) {
      flushRefresh();
    }
  }, [paused]);

  useEffect(() => {
    if (!enabled) {
      setStatus("unavailable");
      return;
    }

    setStatus("connecting");
    let channel = supabase.channel("meus-clientes-realtime");
    for (const table of REALTIME_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh
      );
    }

    channel.subscribe((subscribeStatus, error) => {
      if (subscribeStatus === "SUBSCRIBED") {
        setStatus("connected");
        return;
      }
      if (
        subscribeStatus === "CHANNEL_ERROR" ||
        subscribeStatus === "TIMED_OUT" ||
        subscribeStatus === "CLOSED"
      ) {
        setStatus("unavailable");
        if (error) console.error("[meus-clientes] Realtime:", error);
      }
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [enabled]);

  return { status };
}
