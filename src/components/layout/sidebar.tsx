"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LogOut, MoreHorizontal, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import {
  buildNav,
  findActiveHref,
  type VisibleNavFeature,
  type VisibleNavFront,
} from "@/lib/navigation";
import { NavBadgePill, sumBadges, useNavBadges } from "@/components/layout/nav-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HrNotificationsBell } from "@/components/rh/hr-notifications-bell";
import { ContentScheduleNotificationsBell } from "@/components/conteudo/content-schedule-notifications-bell";

type SidebarProps = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

const SIDEBAR_WIDTH = {
  collapsed: 72,
  expanded: 268,
};

/** Frentes abertas/fechadas pela pessoa; vale entre recarregamentos. */
const FRONTS_STORAGE_KEY = "orquestrai:sidebar-fronts";

function readStoredFronts(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FRONTS_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Rótulos ficam sempre no DOM; o trilho recolhido só os esconde, então ícones não saltam. */
function revealClass(expanded: boolean) {
  return expanded
    ? "opacity-100 transition-opacity delay-75 duration-200"
    : "opacity-0 transition-opacity duration-75";
}

function SidebarFeatureLink({
  feature,
  active,
  expanded,
}: {
  feature: VisibleNavFeature;
  active: boolean;
  expanded: boolean;
}) {
  const badgeFor = useNavBadges();
  const badge = sumBadges(feature.pages.map((page) => badgeFor(page.href)));

  return (
    <Link
      href={feature.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 shrink-0 items-center gap-3 overflow-hidden rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-200",
        active
          ? "text-[#1c1c1c]"
          : "text-white/60 hover:bg-white/[0.07] hover:text-white focus-visible:bg-white/[0.07] focus-visible:text-white"
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-item"
          className="absolute inset-0 rounded-lg bg-[#47cdd0] shadow-[0_8px_22px_rgba(71,205,208,0.22)]"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      <span
        className={cn(
          "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center",
          active ? "text-[#1c1c1c]" : "text-white/60 group-hover:text-white"
        )}
      >
        <feature.icon className="h-[18px] w-[18px]" aria-hidden />
        {!expanded && <NavBadgePill badge={badge} variant="dot" active={active} />}
      </span>
      <span className={cn("relative z-10 min-w-0 flex-1 truncate whitespace-nowrap", revealClass(expanded))}>
        {feature.label}
      </span>
      {expanded && <NavBadgePill badge={badge} variant="count" active={active} />}
    </Link>
  );
}

function SidebarFront({
  front,
  open,
  expanded,
  activeFeatureId,
  onToggle,
}: {
  front: VisibleNavFront;
  open: boolean;
  expanded: boolean;
  activeFeatureId: string | null;
  onToggle: () => void;
}) {
  const badgeFor = useNavBadges();
  const hiddenBadge = open
    ? null
    : sumBadges(front.features.flatMap((feature) => feature.pages.map((page) => badgeFor(page.href))));
  const listId = `sidebar-front-${front.id}`;

  return (
    <section className="flex flex-col gap-0.5" aria-label={front.untitled ? undefined : front.label}>
      {!front.untitled && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={listId}
          className="group/front relative mt-3 flex h-8 shrink-0 items-center gap-2 overflow-hidden rounded-lg px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60"
        >
          <span
            aria-hidden
            className={cn(
              "absolute left-[14px] top-1/2 h-px w-5 bg-white/15",
              expanded ? "opacity-0 transition-opacity duration-75" : "opacity-100 transition-opacity delay-75 duration-200"
            )}
          />
          <span
            className={cn(
              "min-w-0 flex-1 truncate whitespace-nowrap text-xs font-semibold text-white/50 group-hover/front:text-white/85",
              revealClass(expanded)
            )}
          >
            {front.label}
          </span>
          {hiddenBadge && hiddenBadge.value > 0 && (
            <span
              role="status"
              aria-label={`${hiddenBadge.value} pendências em ${front.label}`}
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                hiddenBadge.tone === "amber" ? "bg-[#f4c95d]" : "bg-[#47cdd0]",
                revealClass(expanded)
              )}
            />
          )}
          <ChevronDown
            aria-hidden
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-white/35 transition-transform duration-200 group-hover/front:text-white/70",
              open ? "rotate-0" : "-rotate-90",
              revealClass(expanded)
            )}
          />
        </button>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={listId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-0.5 overflow-hidden"
          >
            {front.features.map((feature) => (
              <SidebarFeatureLink
                key={feature.id}
                feature={feature}
                active={feature.id === activeFeatureId}
                expanded={expanded}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function Sidebar({ expanded, onExpandedChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const badgeFor = useNavBadges();

  const nav = useMemo(() => buildNav(profile), [profile]);
  const features = useMemo(() => nav.flatMap((front) => front.features), [nav]);
  const activeHref = findActiveHref(
    pathname,
    features.flatMap((feature) => feature.pages.map((page) => page.href))
  );
  const activeFeatureId =
    features.find((feature) => feature.pages.some((page) => page.href === activeHref))?.id ?? null;
  const activeFrontId =
    nav.find((front) => front.features.some((feature) => feature.id === activeFeatureId))?.id ?? null;
  const mobileFeatures = features.slice(0, 4);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [frontState, setFrontState] = useState<Record<string, boolean>>(readStoredFronts);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const isFrontOpen = (front: VisibleNavFront) =>
    front.untitled ||
    (frontState[front.id] ?? (front.id === activeFrontId || !front.collapsedByDefault));

  const toggleFront = (front: VisibleNavFront) => {
    const next = { ...frontState, [front.id]: !isFrontOpen(front) };
    setFrontState(next);
    try {
      window.localStorage.setItem(FRONTS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Preferência de layout: sem storage, a frente só não fica lembrada.
    }
  };

  // Entrar numa frente fechada a reabre, para a página atual nunca ficar escondida.
  const [revealedFrontId, setRevealedFrontId] = useState<string | null>(null);
  if (activeFrontId !== revealedFrontId) {
    setRevealedFrontId(activeFrontId);
    if (activeFrontId && frontState[activeFrontId] === false) {
      setFrontState({ ...frontState, [activeFrontId]: true });
    }
  }

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut();
    router.replace("/login");
  };

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [profileMenuOpen]);

  return (
    <>
      <motion.aside
        animate={{ width: expanded ? SIDEBAR_WIDTH.expanded : SIDEBAR_WIDTH.collapsed }}
        transition={{ type: "spring", stiffness: 360, damping: 34 }}
        onMouseEnter={() => onExpandedChange(true)}
        onMouseLeave={() => {
          onExpandedChange(false);
          setProfileMenuOpen(false);
        }}
        onFocusCapture={() => onExpandedChange(true)}
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen flex-col overflow-hidden md:flex",
          "border-r border-white/[0.08] bg-[#03070c] text-white",
          "shadow-[1px_0_24px_rgba(3,7,12,0.25)]"
        )}
      >
        <div className="relative flex h-full min-h-0 flex-col">
          <div className={cn("flex h-[72px] shrink-0 items-center", expanded ? "px-4" : "justify-center px-3")}>
            <Link
              href="/"
              className={cn(
                "group flex min-w-0 items-center rounded-xl transition-colors hover:bg-white/8",
                expanded ? "h-12 flex-1 px-2" : "h-11 w-11 justify-center"
              )}
              title="ORQESTRAI - Inicio"
              aria-label="ORQESTRAI - Inicio"
            >
              <AnimatePresence initial={false} mode="wait">
                {expanded ? (
                  <motion.span
                    key="wordmark"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    transition={{ duration: 0.16 }}
                    className="flex min-w-0 flex-1 items-center"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/ORQESTRAI/identidade-visual/logos/orquestrai-logo-horizontal-color.svg"
                      alt="ORQESTRAI"
                      className="h-8 w-auto max-w-[210px] object-contain"
                    />
                  </motion.span>
                ) : (
                  <motion.span
                    key="symbol"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.14 }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/ORQESTRAI/identidade-visual/logos/orquestrai-symbol-white.svg"
                      alt=""
                      width={24}
                      height={24}
                      className="object-contain drop-shadow-[0_1px_6px_rgba(71,205,208,0.4)]"
                      aria-hidden
                    />
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </div>

          <nav
            className={cn(
              "relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 pb-4",
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            )}
            aria-label="Navegacao principal"
            data-tour="sidebar-nav"
          >
            {nav.map((front) => (
              <SidebarFront
                key={front.id}
                front={front}
                open={isFrontOpen(front)}
                expanded={expanded}
                activeFeatureId={activeFeatureId}
                onToggle={() => toggleFront(front)}
              />
            ))}
          </nav>

          <div className="relative border-t border-white/[0.08] p-3">
            <div className={cn("mb-1 flex gap-1", expanded ? "justify-start pl-1" : "justify-center")}>
              <HrNotificationsBell />
              <ContentScheduleNotificationsBell />
            </div>
            <div ref={profileMenuRef} className="relative" data-tour="profile-menu">
              {profile && (
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  title={profile.name}
                  aria-label={`Conta - ${profile.name}`}
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                  className={cn(
                    "group flex h-12 w-full items-center rounded-xl transition-colors",
                    "hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                    expanded ? "gap-3 px-2" : "justify-center px-0"
                  )}
                >
                  <span className="relative shrink-0">
                    <Avatar className="h-9 w-9 border border-white/20 shadow-sm transition-colors group-hover:border-[#47cdd0]/70">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="bg-white/10 text-[10px] font-semibold text-white">
                        {getInitials(profile.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#03070c] bg-emerald-400" aria-hidden />
                  </span>

                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.14 }}
                        className="min-w-0 text-left"
                      >
                        <span className="block truncate text-sm font-semibold text-white">{profile.name}</span>
                        {profile.email && (
                          <span className="block truncate text-[11px] text-white/45">{profile.email}</span>
                        )}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              )}

              <AnimatePresence>
                {profile && profileMenuOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.16 }}
                    className={cn(
                      "absolute bottom-0 z-50 w-56 overflow-hidden rounded-xl border border-white/10",
                      "bg-[#04202f]/95 p-1 shadow-2xl backdrop-blur-xl",
                      expanded ? "left-0" : "left-full ml-3"
                    )}
                  >
                    <div className="border-b border-white/10 px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-white">{profile.name}</p>
                      {profile.email && (
                        <p className="truncate text-[11px] text-white/50">{profile.email}</p>
                      )}
                    </div>
                    <Link
                      href="/perfil"
                      role="menuitem"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <User className="h-4 w-4" />
                      Meu perfil
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        handleSignOut();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/15 hover:text-red-200"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.aside>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Fechar menu"
              className="fixed inset-0 z-40 bg-[#03070c]/35 backdrop-blur-[2px] md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Todas as áreas"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.18 }}
              className="fixed bottom-[4.5rem] left-3 right-3 z-50 max-h-[min(72dvh,600px)] overflow-y-auto rounded-lg border border-[#47cdd0]/20 bg-[#04202f] p-3 text-white shadow-[0_24px_64px_rgba(3,7,12,0.38)] md:hidden"
            >
              <div className="mb-3 flex items-center justify-between border-b border-white/10 px-1 pb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/ORQESTRAI/identidade-visual/logos/orquestrai-logo-horizontal-color.svg"
                  alt="ORQESTRAI"
                  className="h-7 w-auto max-w-[190px] object-contain"
                />
                <span className="text-xs font-medium text-white/55">Navegação</span>
              </div>
              <div className="flex flex-col gap-4">
                {nav.map((front) => (
                  <section key={front.id} aria-label={front.untitled ? undefined : front.label}>
                    {!front.untitled && (
                      <h2 className="mb-1.5 px-1 text-xs font-semibold text-white/45">{front.label}</h2>
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      {front.features.map((feature) => {
                        const isActive = feature.id === activeFeatureId;
                        const badge = sumBadges(feature.pages.map((page) => badgeFor(page.href)));
                        return (
                          <Link
                            key={feature.id}
                            href={feature.href}
                            aria-current={isActive ? "page" : undefined}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              "flex min-h-12 items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                              isActive
                                ? "bg-[#47cdd0] text-[#1c1c1c]"
                                : "bg-white/[0.04] text-white/75 hover:bg-white/[0.09] hover:text-white"
                            )}
                          >
                            <feature.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                            <span className="min-w-0 flex-1 leading-tight">{feature.label}</span>
                            <NavBadgePill badge={badge} variant="count" active={isActive} />
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-1.5 border-t border-white/10 pt-3">
                <Link
                  href="/perfil"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-12 items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-white/75 outline-none transition-colors hover:bg-white/[0.09] hover:text-white focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
                >
                  <User className="h-[18px] w-[18px]" aria-hidden />
                  Meu perfil
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex min-h-12 items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-red-200 outline-none transition-colors hover:bg-red-500/15 hover:text-red-100 focus-visible:ring-2 focus-visible:ring-red-300"
                >
                  <LogOut className="h-[18px] w-[18px]" aria-hidden />
                  Sair
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-white/[0.06] bg-gradient-to-r from-[#03070c] to-[#04202f] px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.2)] md:hidden"
        data-tour="sidebar-nav-mobile"
        aria-label="Navegação principal móvel"
      >
        {mobileFeatures.map((feature) => {
          const isActive = feature.id === activeFeatureId;
          const badge = sumBadges(feature.pages.map((page) => badgeFor(page.href)));
          return (
            <Link
              key={feature.id}
              href={feature.href}
              aria-label={feature.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "relative flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-md px-2 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                isActive ? "text-white" : "text-white/40 hover:text-white/70"
              )}
            >
              <span className="relative flex h-6 w-6 items-center justify-center">
                <feature.icon className="h-5 w-5" />
                <NavBadgePill badge={badge} variant="dot" active={isActive} />
              </span>
              <span className="max-w-[72px] truncate text-xs font-medium leading-none">
                {feature.shortLabel ?? feature.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label="Abrir todas as áreas"
          aria-expanded={mobileMenuOpen}
          className={cn(
            "flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-md px-2 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
            mobileMenuOpen ? "text-[#47cdd0]" : "text-white/40 hover:text-white/70"
          )}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden />
          <span className="text-xs font-medium leading-none">Mais</span>
        </button>
      </nav>

    </>
  );
}
