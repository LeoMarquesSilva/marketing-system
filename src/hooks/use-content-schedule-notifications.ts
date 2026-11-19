"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { LEONARDO_USER_ID } from "@/lib/planner-visibility";
import type { ContentScheduleAssignmentNotification } from "@/lib/content-schedule/types";

/** Trocas de responsável no calendário editorial que precisam ser refletidas no VIOS (só o Leonardo recebe). */
export function useContentScheduleNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<ContentScheduleAssignmentNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canReceive = profile?.id === LEONARDO_USER_ID;

  const load = useCallback(async () => {
    if (!canReceive) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/content-schedule/notifications", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = await response.json() as {
        notifications?: ContentScheduleAssignmentNotification[];
      };
      setNotifications(payload.notifications ?? []);
      setError(null);
    } catch {
      // Mantém a última lista conhecida durante falhas transitórias.
    } finally {
      setLoading(false);
    }
  }, [canReceive]);

  useEffect(() => {
    if (!canReceive) return;
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [canReceive, load]);

  const resolve = useCallback(async (notification: ContentScheduleAssignmentNotification) => {
    setResolvingId(notification.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/content-schedule/notifications/${encodeURIComponent(notification.id)}/resolve`,
        { method: "POST", credentials: "include" }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "Não foi possível concluir a notificação.");
      }
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a notificação.");
    } finally {
      setResolvingId(null);
    }
  }, []);

  return { canReceive, notifications, loading, resolvingId, error, load, resolve };
}
