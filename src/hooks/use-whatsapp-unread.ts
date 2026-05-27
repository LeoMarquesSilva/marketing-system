"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/auth-context";

export function useWhatsappUnreadCount() {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch("/api/evolution/conversations?unreadSummary=1");
      if (!res.ok) return;
      const json = (await res.json()) as { totalUnread?: number };
      setTotalUnread(Math.max(0, Number(json.totalUnread) || 0));
    } catch {
      /* ignore */
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void refresh();
    }, 600);
  }, [refresh]);

  useEffect(() => {
    if (!user) return;

    void refresh();
    const pollId = setInterval(refresh, 30_000);

    const channel = supabase
      .channel("whatsapp-unread-badge")
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

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [user, refresh, scheduleRefresh]);

  return user ? totalUnread : 0;
}
