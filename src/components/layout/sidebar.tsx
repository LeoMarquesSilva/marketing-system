"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  List,
  Users,
  Columns3,
  ClipboardList,
  CalendarDays,
  LogOut,
  Settings,
  Newspaper,
  Heart,
  Images,
  Instagram,
  Linkedin,
  Megaphone,
  User,
  Camera,
  Wallet,
  Mail,
  Contact,
  Clapperboard,
  MoreHorizontal,
  RadioTower,
  ScrollText,
  Palmtree,
  BriefcaseBusiness,
  IdCard,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { isContentCollaborator } from "@/lib/content-areas";
import {
  resolveAllowedSections,
  isCollaboratorPhotosManager,
  isAdminRole,
} from "@/lib/access-control";
import { hasHrAccess } from "@/lib/rh/access";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchCommentStats } from "@/lib/request-comments";
import { fetchMarketingRequests } from "@/lib/marketing-requests";
import { useWhatsappUnreadCount } from "@/hooks/use-whatsapp-unread";

type SidebarProps = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

type NavLeaf = {
  href: string;
  icon: LucideIcon;
  label: string;
};

type NavGroup = {
  key: string;
  icon: LucideIcon;
  label: string;
  children: NavLeaf[];
};

type NavEntry = NavLeaf | NavGroup;

function isNavGroup(item: NavEntry): item is NavGroup {
  return "children" in item && Array.isArray(item.children);
}

function flattenNav(items: NavEntry[]): NavLeaf[] {
  return items.flatMap((item) => (isNavGroup(item) ? item.children : [item]));
}

const SIDEBAR_WIDTH = {
  collapsed: 72,
  expanded: 260,
};

const baseNavItems: NavLeaf[] = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/planner", icon: Columns3, label: "Planner" },
  { href: "/solicitacoes", icon: List, label: "Solicitacoes" },
  { href: "/conteudo/roteiros", icon: Newspaper, label: "Conteudo para Post" },
  { href: "/conteudo/boletim", icon: ScrollText, label: "Newsletter" },
  { href: "/conteudo/reels", icon: Clapperboard, label: "Roteiros de Reels" },
  { href: "/clima", icon: Heart, label: "Clima" },
  { href: "/instagram-insights", icon: Instagram, label: "Instagram Insights" },
  { href: "/linkedin-insights", icon: Linkedin, label: "LinkedIn Insights" },
  { href: "/trafego-pago", icon: Megaphone, label: "Trafego Pago" },
  { href: "/vios-tarefas", icon: ClipboardList, label: "Tarefas VIOS" },
  { href: "/eventos", icon: CalendarDays, label: "Eventos" },
  { href: "/email-marketing", icon: Mail, label: "E-mail Marketing" },
  { href: "/nfc", icon: RadioTower, label: "NFC Hub" },
  { href: "/minhas-fotos", icon: Images, label: "Minhas fotos" },
  { href: "/fotos-colaboradores", icon: Camera, label: "Fotos Colaboradores" },
  { href: "/usuarios", icon: Users, label: "Usuarios" },
  { href: "/custos-projetos", icon: Wallet, label: "Custos de Projetos" },
];

const collaboratorNavItems: NavLeaf[] = [
  { href: "/conteudo/inicio", icon: Instagram, label: "Inicio" },
  { href: "/minhas-fotos", icon: Images, label: "Minhas fotos" },
  { href: "/conteudo/roteiros", icon: Newspaper, label: "Conteudo para Post" },
  { href: "/conteudo/boletim", icon: ScrollText, label: "Newsletter" },
  { href: "/conteudo/reels", icon: Clapperboard, label: "Roteiros de Reels" },
];

const meusClientesNavItem: NavLeaf = {
  href: "/meus-clientes",
  icon: Contact,
  label: "Meus Clientes",
};

const rhNavGroup: NavGroup = {
  key: "/rh",
  icon: BriefcaseBusiness,
  label: "RH",
  children: [
    { href: "/rh/ferias", icon: Palmtree, label: "Ferias" },
    { href: "/rh/qualificacoes", icon: IdCard, label: "Qualificacoes" },
  ],
};

const adminNavItems: NavLeaf[] = [
  { href: "/admin", icon: Settings, label: "Configuracoes" },
];

function withMinhasFotos(items: NavEntry[], minhasFotos: NavLeaf): NavEntry[] {
  const flat = flattenNav(items);
  if (flat.some((i) => i.href === "/minhas-fotos")) return items;
  const contentIndex = items.findIndex(
    (i) => !isNavGroup(i) && i.href.startsWith("/conteudo")
  );
  if (contentIndex >= 0) {
    const copy = [...items];
    copy.splice(contentIndex + 1, 0, minhasFotos);
    return copy;
  }
  return [items[0], minhasFotos, ...items.slice(1)].filter(Boolean) as NavEntry[];
}

function profileHasRhAccess(
  profile: { role?: string | null; permissions?: string[] | null } | null
): boolean {
  return hasHrAccess(profile?.role, profile?.permissions);
}

function getNavItems(
  profile: {
    id?: string;
    role?: string | null;
    department?: string | null;
    permissions?: string[] | null;
  } | null
): NavEntry[] {
  const minhasFotos: NavLeaf = { href: "/minhas-fotos", icon: Images, label: "Minhas fotos" };
  const allowed = resolveAllowedSections(profile);
  if (allowed) {
    const leafCatalog: NavLeaf[] = [...baseNavItems, meusClientesNavItem, ...adminNavItems];
    let items: NavEntry[] = leafCatalog.filter((i) => {
      if (i.href === "/minhas-fotos") return true;
      if (i.href === "/fotos-colaboradores") {
        return isCollaboratorPhotosManager(profile);
      }
      return allowed.includes(i.href);
    });

    if (profileHasRhAccess(profile) || allowed.includes("/rh") || allowed.includes("/ferias")) {
      items = [...items, rhNavGroup];
    }

    if (allowed.some((k) => k.startsWith("/conteudo"))) {
      items = [
        { href: "/conteudo/inicio", icon: Instagram, label: "Inicio" },
        minhasFotos,
        { href: "/conteudo/roteiros", icon: Newspaper, label: "Conteudo para Post" },
        { href: "/conteudo/boletim", icon: ScrollText, label: "Newsletter" },
        { href: "/conteudo/reels", icon: Clapperboard, label: "Roteiros de Reels" },
        ...items.filter(
          (i) =>
            isNavGroup(i) ||
            (!i.href.startsWith("/conteudo") && i.href !== "/minhas-fotos")
        ),
      ];
    } else {
      items = withMinhasFotos(items, minhasFotos);
    }
    return items;
  }

  if (isContentCollaborator(profile)) {
    return collaboratorNavItems;
  }

  const isAdmin = isAdminRole(profile);
  return [
    ...baseNavItems.filter((i) => {
      if (i.href === "/nfc") return isAdmin;
      if (i.href === "/minhas-fotos") return true;
      return i.href !== "/fotos-colaboradores" || isCollaboratorPhotosManager(profile);
    }),
    ...(isAdmin ? [meusClientesNavItem, rhNavGroup, ...adminNavItems] : []),
  ];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isRouteActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

function NotificationBadge({
  value,
  tone = "cyan",
  expanded,
  active = false,
}: {
  value: number;
  tone?: "cyan" | "amber";
  expanded: boolean;
  active?: boolean;
}) {
  if (value <= 0) return null;

  const label = `${value} ${value === 1 ? "notificação pendente" : "notificações pendentes"}`;

  if (!expanded) {
    return (
      <span
        role="status"
        aria-label={label}
        className={cn(
          "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2",
          active ? "border-[#47cdd0]" : "border-[#03070c]",
          tone === "amber" ? "bg-[#f4c95d]" : active ? "bg-[#04202f]" : "bg-[#47cdd0]"
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
        tone === "amber"
          ? "bg-[#f4c95d] text-[#1c1c1c]"
          : active
            ? "bg-[#04202f] text-white"
            : "bg-[#47cdd0] text-[#1c1c1c]"
      )}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

export function Sidebar({ expanded, onExpandedChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const [pendingAlterations, setPendingAlterations] = useState(0);
  const whatsappUnread = useWhatsappUnreadCount();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const navItems = getNavItems(profile);
  const flatNavItems = flattenNav(navItems);
  const mobileNavItems = flatNavItems.slice(0, 4);

  const toggleGroup = (key: string) => {
    if (!expanded) {
      onExpandedChange(true);
      setOpenGroups((prev) => ({ ...prev, [key]: true }));
      return;
    }
    setOpenGroups((prev) => {
      const forcedOpen = pathname.startsWith(key);
      const currentlyOpen = prev[key] ?? forcedOpen;
      return { ...prev, [key]: !currentlyOpen };
    });
  };

  const isGroupOpen = (key: string) => {
    if (key in openGroups) return Boolean(openGroups[key]);
    return pathname.startsWith(key);
  };

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
        <div className="pointer-events-none absolute inset-0 bg-[#03070c]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[#47cdd0]/40 to-transparent" />

        <div className="relative flex h-full min-h-0 flex-col">
          <div className={cn("flex h-[72px] items-center", expanded ? "px-4" : "justify-center px-3")}>
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
              "relative flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 pb-3",
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            )}
            aria-label="Navegacao principal"
            data-tour="sidebar-nav"
          >
            {navItems.map((item) => {
              if (isNavGroup(item)) {
                const groupOpen = isGroupOpen(item.key);
                const groupActive = item.children.some((child) =>
                  isRouteActive(pathname, child.href)
                );
                return (
                  <div key={item.key} className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.key)}
                      title={!expanded ? item.label : undefined}
                      aria-label={item.label}
                      aria-expanded={groupOpen}
                      className={cn(
                        "group relative flex h-11 w-full items-center rounded-xl text-sm font-medium outline-none transition-colors duration-200",
                        expanded ? "gap-3 px-3" : "justify-center px-0",
                        groupActive && !groupOpen
                          ? "text-[#1c1c1c]"
                          : "text-white/55 hover:bg-white/[0.08] hover:text-white focus-visible:bg-white/[0.08] focus-visible:text-white"
                      )}
                    >
                      {groupActive && !groupOpen && (
                        <motion.span
                          layoutId="sidebar-active-item"
                          className="absolute inset-0 rounded-xl bg-[#47cdd0] shadow-[0_10px_28px_rgba(71,205,208,0.26)]"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span
                        className={cn(
                          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          groupActive && !groupOpen
                            ? "text-[#1c1c1c]"
                            : "text-white/65 group-hover:text-white"
                        )}
                      >
                        <item.icon className="h-[18px] w-[18px]" />
                      </span>
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.span
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -6 }}
                            transition={{ duration: 0.14 }}
                            className="relative z-10 min-w-0 flex-1 truncate text-left"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {expanded && (
                        <ChevronDown
                          className={cn(
                            "relative z-10 h-4 w-4 shrink-0 transition-transform duration-200",
                            groupOpen ? "rotate-0" : "-rotate-90",
                            groupActive && !groupOpen ? "text-[#1c1c1c]" : "text-white/40"
                          )}
                        />
                      )}
                      {!expanded && (
                        <span
                          className={cn(
                            "pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg",
                            "border border-white/10 bg-[#04202f]/95 px-3 py-1.5 text-xs font-medium text-white shadow-xl backdrop-blur-xl",
                            "z-50 -translate-x-1 scale-95 opacity-0 transition-all duration-150",
                            "group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100"
                          )}
                          aria-hidden
                        >
                          {item.label}
                        </span>
                      )}
                    </button>
                    <AnimatePresence initial={false}>
                      {expanded && groupOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden pl-3"
                        >
                          <div className="flex flex-col gap-0.5 border-l border-white/10 pl-2">
                            {item.children.map((child) => {
                              const isActive = isRouteActive(pathname, child.href);
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  aria-label={child.label}
                                  aria-current={isActive ? "page" : undefined}
                                  className={cn(
                                    "group relative flex h-10 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium outline-none transition-colors duration-200",
                                    isActive
                                      ? "text-[#1c1c1c]"
                                      : "text-white/55 hover:bg-white/[0.08] hover:text-white focus-visible:bg-white/[0.08] focus-visible:text-white"
                                  )}
                                >
                                  {isActive && (
                                    <motion.span
                                      layoutId="sidebar-active-item"
                                      className="absolute inset-0 rounded-xl bg-[#47cdd0] shadow-[0_10px_28px_rgba(71,205,208,0.26)]"
                                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                                    />
                                  )}
                                  <span
                                    className={cn(
                                      "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                                      isActive
                                        ? "text-[#1c1c1c]"
                                        : "text-white/65 group-hover:text-white"
                                    )}
                                  >
                                    <child.icon className="h-4 w-4" />
                                  </span>
                                  <span className="relative z-10 min-w-0 flex-1 truncate">
                                    {child.label}
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              const isActive = isRouteActive(pathname, item.href);
              const badgeValue =
                item.href === "/planner"
                  ? pendingAlterations
                  : item.href === "/trafego-pago"
                    ? whatsappUnread
                    : 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!expanded ? item.label : undefined}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative flex h-11 items-center rounded-xl text-sm font-medium outline-none transition-colors duration-200",
                    expanded ? "gap-3 px-3" : "justify-center px-0",
                    isActive
                      ? "text-[#1c1c1c]"
                      : "text-white/55 hover:bg-white/[0.08] hover:text-white focus-visible:bg-white/[0.08] focus-visible:text-white"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active-item"
                      className="absolute inset-0 rounded-xl bg-[#47cdd0] shadow-[0_10px_28px_rgba(71,205,208,0.26)]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}

                  <span
                    className={cn(
                      "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200",
                      !isActive && "group-hover:scale-105",
                      isActive ? "text-[#1c1c1c]" : "text-white/65 group-hover:text-white"
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                    {!expanded && (
                      <NotificationBadge
                        value={badgeValue}
                        tone={item.href === "/planner" ? "amber" : "cyan"}
                        expanded={false}
                        active={isActive}
                      />
                    )}
                  </span>

                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.14 }}
                        className="relative z-10 min-w-0 flex-1 truncate"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {expanded && (
                    <NotificationBadge
                      value={badgeValue}
                      tone={item.href === "/planner" ? "amber" : "cyan"}
                      expanded
                      active={isActive}
                    />
                  )}

                  {!expanded && (
                    <span
                      className={cn(
                        "pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg",
                        "border border-white/10 bg-[#04202f]/95 px-3 py-1.5 text-xs font-medium text-white shadow-xl backdrop-blur-xl",
                        "z-50 -translate-x-1 scale-95 opacity-0 transition-all duration-150",
                        "group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100"
                      )}
                      aria-hidden
                    >
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="relative border-t border-white/[0.08] p-3">
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
              className="fixed bottom-[4.5rem] left-3 right-3 z-50 max-h-[min(70dvh,560px)] overflow-y-auto rounded-lg border border-[#47cdd0]/20 bg-[#04202f] p-3 text-white shadow-[0_24px_64px_rgba(3,7,12,0.38)] md:hidden"
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
              <div className="grid grid-cols-2 gap-1.5">
                {flatNavItems.map((item) => {
                  const isActive = isRouteActive(pathname, item.href);
                  const badgeValue =
                    item.href === "/planner"
                      ? pendingAlterations
                      : item.href === "/trafego-pago"
                        ? whatsappUnread
                        : 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex min-h-12 items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                        isActive
                          ? "bg-[#47cdd0] text-[#1c1c1c]"
                          : "bg-white/[0.04] text-white/75 hover:bg-white/[0.09] hover:text-white"
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <NotificationBadge
                        value={badgeValue}
                        tone={item.href === "/planner" ? "amber" : "cyan"}
                        expanded
                        active={isActive}
                      />
                    </Link>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-white/10 pt-3">
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
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
          const badgeValue =
            item.href === "/planner"
              ? pendingAlterations
              : item.href === "/trafego-pago"
                ? whatsappUnread
                : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "relative flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-md px-2 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                isActive ? "text-white" : "text-white/40 hover:text-white/70"
              )}
            >
              <span className="relative flex h-6 w-6 items-center justify-center">
                <item.icon className="h-5 w-5" />
                <NotificationBadge
                  value={badgeValue}
                  tone={item.href === "/planner" ? "amber" : "cyan"}
                  expanded={false}
                  active={isActive}
                />
              </span>
              <span className="max-w-[64px] truncate text-xs font-medium leading-none">{item.label.split(" ")[0]}</span>
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

      <div className="h-16 md:hidden" />
    </>
  );
}
