"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { fetchCommentStats } from "@/lib/request-comments";
import { fetchMarketingRequests } from "@/lib/marketing-requests";
import { useWhatsappUnreadCount } from "@/hooks/use-whatsapp-unread";
import { REELS_APPROVAL_HREF, useReelDeliveriesPendingCount } from "@/hooks/use-reel-deliveries-pending";
import { hasOpsPlannerAccess } from "@/lib/access-control";
import { authFetch } from "@/lib/auth-fetch";
import { OPS_PLANNER_PATH } from "@/lib/ops-planner/types";

export type NavBadgeTone = "cyan" | "amber";
export type NavBadge = { value: number; tone: NavBadgeTone };

const EMPTY_BADGE: NavBadge = { value: 0, tone: "cyan" };

const NavBadgesContext = createContext<(href: string) => NavBadge>(() => EMPTY_BADGE);

/** Contadores da navegação, buscados uma vez para sidebar e abas do cabeçalho. */
export function NavBadgesProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [pendingAlterations, setPendingAlterations] = useState(0);
  const whatsappUnread = useWhatsappUnreadCount();
  const reelPending = useReelDeliveriesPendingCount(Boolean(profile));
  const [opsDue, setOpsDue] = useState(0);
  const opsPlanner = hasOpsPlannerAccess(profile);

  useEffect(() => {
    if (!opsPlanner) return;
    const load = async () => {
      try {
        const response = await authFetch("/api/operacoes-legais/planner/badge");
        if (!response.ok) return;
        const data = (await response.json()) as { due?: number };
        setOpsDue(data.due ?? 0);
      } catch {
        // Badge opcional: falhas temporarias nao devem derrubar a navegacao.
      }
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [opsPlanner]);

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      try {
        const requests = await fetchMarketingRequests({
          userId: profile.id,
          role: profile.role as "designer" | "admin" | "solicitante",
        });
        if (requests.length === 0) return;
        const ids = requests.map((r) => r.id);
        const { pendingAlterationsCounts } = await fetchCommentStats(ids);
        const total = Object.values(pendingAlterationsCounts).reduce((sum, n) => sum + n, 0);
        setPendingAlterations(total);
      } catch {
        // Badge opcional: falhas temporarias nao devem derrubar a navegacao.
      }
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [profile?.id, profile?.role]);

  const badgeFor = useCallback(
    (href: string): NavBadge => {
      if (href === "/planner") return { value: pendingAlterations, tone: "amber" };
      if (href === "/trafego-pago") return { value: whatsappUnread, tone: "cyan" };
      if (href === REELS_APPROVAL_HREF) return { value: reelPending, tone: "cyan" };
      // Minhas tarefas: atrasadas + vencendo hoje.
      if (href === OPS_PLANNER_PATH) return { value: opsPlanner ? opsDue : 0, tone: "amber" };
      return EMPTY_BADGE;
    },
    [pendingAlterations, whatsappUnread, reelPending, opsDue, opsPlanner]
  );

  return <NavBadgesContext.Provider value={badgeFor}>{children}</NavBadgesContext.Provider>;
}

export function useNavBadges() {
  return useContext(NavBadgesContext);
}

/** Soma os contadores de várias páginas; amber prevalece quando houver pendência amber. */
export function sumBadges(badges: NavBadge[]): NavBadge {
  const value = badges.reduce((sum, badge) => sum + badge.value, 0);
  const tone = badges.some((badge) => badge.tone === "amber" && badge.value > 0) ? "amber" : "cyan";
  return { value, tone };
}

export function NavBadgePill({
  badge,
  variant,
  active = false,
}: {
  badge: NavBadge;
  /** `dot` marca o ícone no trilho recolhido; `count` mostra o número. */
  variant: "dot" | "count";
  active?: boolean;
}) {
  if (badge.value <= 0) return null;

  const label = `${badge.value} ${badge.value === 1 ? "notificação pendente" : "notificações pendentes"}`;

  if (variant === "dot") {
    return (
      <span
        role="status"
        aria-label={label}
        className={cn(
          "absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2",
          active ? "border-[#47cdd0]" : "border-[#03070c]",
          badge.tone === "amber" ? "bg-[#f4c95d]" : active ? "bg-[#04202f]" : "bg-[#47cdd0]"
        )}
      />
    );
  }

  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "relative z-10 ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold leading-none",
        badge.tone === "amber"
          ? "bg-[#f4c95d] text-[#1c1c1c]"
          : active
            ? "bg-[#04202f] text-white"
            : "bg-[#47cdd0] text-[#1c1c1c]"
      )}
    >
      {badge.value > 99 ? "99+" : badge.value}
    </span>
  );
}
