"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/utils/supabase/client";

export type FeriasRealtimeStatus = "connecting" | "connected" | "unavailable";

const REALTIME_TABLES = [
  "hr_employees",
  "vacation_periods",
  "vacation_leaves",
  "company_recess",
  "hr_vios_employees",
] as const;

const DEBOUNCE_MS = 450;

export function useFeriasRealtime(options: {
  enabled?: boolean;
  /** Evita sobrescrever formulários abertos; flush ao fechar. */
  paused?: boolean;
  onRefresh: () => void;
}) {
  const { enabled = true, paused = false, onRefresh } = options;
  const [status, setStatus] = useState<FeriasRealtimeStatus>("connecting");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRefreshRef = useRef(onRefresh);
  const pausedRef = useRef(paused);

  const flushRefresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onRefreshRef.current();
      setLastSyncAt(new Date());
      pendingRef.current = false;
    }, DEBOUNCE_MS);
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (pausedRef.current) {
      pendingRef.current = true;
      return;
    }
    flushRefresh();
  }, [flushRefresh]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused && pendingRef.current) {
      flushRefresh();
    }
  }, [flushRefresh, paused]);

  useEffect(() => {
    if (!enabled) return;

    const connectingTimer = setTimeout(() => setStatus("connecting"), 0);
    let channel = supabase.channel("ferias-realtime");
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
        if (error) console.error("[ferias] Realtime:", error);
      }
    });

    return () => {
      clearTimeout(connectingTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [enabled, scheduleRefresh]);

  return {
    status: enabled ? status : "unavailable",
    lastSyncAt,
  };
}
