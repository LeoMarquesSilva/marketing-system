"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { isVistagemPath, papelVistagem } from "@/lib/access-control";
import { fetchCommentStats } from "@/lib/request-comments";
import { fetchMarketingRequests } from "@/lib/marketing-requests";
import { ABAS_COM_CONTAGEM, abaDoHref } from "@/lib/vistagem/contagens";
import { useWhatsappUnreadCount } from "@/hooks/use-whatsapp-unread";
import { REELS_APPROVAL_HREF, useReelDeliveriesPendingCount } from "@/hooks/use-reel-deliveries-pending";
import { useVistagemContagens } from "@/hooks/use-vistagem-contagens";

export type NavBadgeTone = "cyan" | "amber";
export type NavBadge = {
  value: number;
  tone: NavBadgeTone;
  /** Frase para leitor de tela e dica ao passar o mouse (ex.: "12 publicações para vistar"). */
  descricao?: string;
  /** Resumo curto que acompanha o número ao lado do título, quando a funcionalidade não tem abas (ex.: "para vistar"). */
  resumo?: string;
  /**
   * Número só das abas do cabeçalho: a sidebar não soma. Ex.: as filas da Vistagem são etapas diferentes da mesma
   * esteira; somadas, não dizem nada.
   */
  soNoCabecalho?: boolean;
};

const EMPTY_BADGE: NavBadge = { value: 0, tone: "cyan" };

const NavBadgesContext = createContext<(href: string) => NavBadge>(() => EMPTY_BADGE);

/** Contadores da navegação, buscados uma vez para sidebar e abas do cabeçalho. */
export function NavBadgesProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const pathname = usePathname();
  const [pendingAlterations, setPendingAlterations] = useState(0);
  const whatsappUnread = useWhatsappUnreadCount();
  const reelPending = useReelDeliveriesPendingCount(Boolean(profile));
  // Filas da Vistagem: só enquanto a pessoa está no módulo (é onde as abas aparecem).
  const vistagem = useVistagemContagens(Boolean(papelVistagem(profile)) && isVistagemPath(pathname), pathname);

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
      const abaVistagem = abaDoHref(href);
      if (abaVistagem) {
        const value = vistagem?.[abaVistagem] ?? 0;
        const { descrever, resumo } = ABAS_COM_CONTAGEM[abaVistagem];
        return { value, tone: "cyan", descricao: descrever(value), resumo, soNoCabecalho: true };
      }
      return EMPTY_BADGE;
    },
    [pendingAlterations, whatsappUnread, reelPending, vistagem]
  );

  return <NavBadgesContext.Provider value={badgeFor}>{children}</NavBadgesContext.Provider>;
}

export function useNavBadges() {
  return useContext(NavBadgesContext);
}

/** Soma os contadores de várias páginas (sidebar); amber prevalece. Números só do cabeçalho ficam de fora. */
export function sumBadges(badges: NavBadge[]): NavBadge {
  const somados = badges.filter((badge) => !badge.soNoCabecalho);
  const value = somados.reduce((sum, badge) => sum + badge.value, 0);
  const tone = somados.some((badge) => badge.tone === "amber" && badge.value > 0) ? "amber" : "cyan";
  return { value, tone };
}

const formatarContagem = (value: number) => (value > 99 ? "99+" : value.toLocaleString("pt-BR"));

export function NavBadgePill({
  badge,
  variant,
  active = false,
}: {
  badge: NavBadge;
  /**
   * `dot` marca o ícone no trilho recolhido; `count` mostra o número na sidebar (escura); `tab` mostra o número
   * nas abas do cabeçalho (claro): neutro nas abas, no tom da marca na aba ativa.
   */
  variant: "dot" | "count" | "tab";
  active?: boolean;
}) {
  if (badge.value <= 0) return null;

  const label =
    badge.descricao ?? `${badge.value} ${badge.value === 1 ? "notificação pendente" : "notificações pendentes"}`;

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

  if (variant === "tab") {
    return (
      <span
        role="status"
        aria-label={label}
        title={badge.descricao}
        className={cn(
          "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold leading-none tabular-nums transition-colors",
          badge.tone === "amber"
            ? "bg-[#f4c95d] text-[#1c1c1c]"
            : active
              ? "bg-[#347796] text-white"
              : "bg-[#eaf2f5] text-[#285f7a] group-hover:bg-[#dcebf0]"
        )}
      >
        {formatarContagem(badge.value)}
      </span>
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
      {formatarContagem(badge.value)}
    </span>
  );
}
