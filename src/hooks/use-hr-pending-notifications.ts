"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { hasHrAccess } from "@/lib/rh/access";
import type { HrOnboardingNotification } from "@/lib/ferias/types";

/**
 * Fonte única das notificações de onboarding de RH (VIOS): usada pelo popup
 * de login e pelo sininho no menu de perfil, para os dois ficarem em sincronia.
 */
export function useHrPendingNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<HrOnboardingNotification[]>([]);
  /** Ajustes pendentes no organograma (colaborador novo sem posição ou que saiu). */
  const [orgChartAdjustments, setOrgChartAdjustments] = useState(0);

  const canReceive =
    !!profile &&
    (hasHrAccess(profile.role, profile.permissions) || !!profile.is_hr_notification_recipient);

  const refetch = useCallback(async () => {
    if (!canReceive) {
      setNotifications([]);
      setOrgChartAdjustments(0);
      return;
    }
    try {
      const response = await fetch("/api/hr/notifications", { credentials: "include" });
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(data.notifications ?? []);
      setOrgChartAdjustments(Number(data.orgChartAdjustments) || 0);
    } catch {
      // Falha pontual de rede: mantém a última lista conhecida.
    }
  }, [canReceive]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Busca as notificações pendentes assim que o perfil autorizado carrega.
    void refetch();
  }, [refetch]);

  return {
    canReceive,
    notifications,
    orgChartAdjustments,
    pendingCount: notifications.length + (orgChartAdjustments > 0 ? 1 : 0),
    refetch,
  };
}
