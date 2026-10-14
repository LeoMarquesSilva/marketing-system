/**
 * Catálogo da navegação do ORQESTRAI, organizado por frentes.
 *
 * Frente (Marketing, Relacionamento / Comercial, Pessoas e Cultura…) →
 * funcionalidade (um item na sidebar) → páginas. Funcionalidade com mais de
 * uma página vira abas no cabeçalho. Sidebar e cabeçalho leem deste arquivo
 * para que os nomes nunca divirjam.
 *
 * A visibilidade replica a regra de acesso da sidebar; a autorização de
 * verdade continua em `canAccessPath` e no servidor.
 */

import type { LucideIcon } from "lucide-react";
import {
  Award,
  CalendarClock,
  CalendarRange,
  Camera,
  Clapperboard,
  Coffee,
  Columns3,
  Contact,
  Crosshair,
  Heart,
  House,
  IdCard,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquareHeart,
  Network,
  Newspaper,
  Nfc,
  Palmtree,
  PenLine,
  Scale,
  Settings,
  Sparkles,
  Ticket,
  TrendingUp,
  User,
  Users,
  Wallet,
} from "lucide-react";
import {
  hasCafeCulturaAccess,
  hasIcpAccess,
  hasOperacoesLegaisAccess,
  hasVistagemAccess,
  isAdminRole,
  isVistagemPath,
  isCollaboratorPhotosManager,
  resolveAllowedSections,
  type AccessProfile,
} from "@/lib/access-control";
import { isContentCollaborator } from "@/lib/content-areas";
import { canAccessGustavoContent } from "@/lib/gustavo-content/access";
import { hasHrAccess } from "@/lib/rh/access";
import { REELS_APPROVAL_HREF } from "@/hooks/use-reel-deliveries-pending";

export type NavPage = {
  href: string;
  /** Nome da página nas abas do cabeçalho. */
  label: string;
};

export type NavFeature = {
  id: string;
  /** Nome na sidebar. */
  label: string;
  /** Nome no cabeçalho, quando o da sidebar precisa ser mais curto. */
  title?: string;
  /** Rótulo da barra inferior do celular. */
  shortLabel?: string;
  icon: LucideIcon;
  pages: NavPage[];
};

export type NavFront = {
  id: string;
  label: string;
  /** Atalhos do topo: aparecem sem título de frente. */
  untitled?: boolean;
  /** Começa fechada na sidebar até a pessoa abrir ou navegar para ela. */
  collapsedByDefault?: boolean;
  features: NavFeature[];
};

/** Funcionalidade já filtrada por acesso; `href` é a primeira página liberada. */
export type VisibleNavFeature = NavFeature & { href: string };
export type VisibleNavFront = Omit<NavFront, "features"> & { features: VisibleNavFeature[] };

export const NAV_FRONTS: NavFront[] = [
  {
    id: "geral",
    label: "Visão geral",
    untitled: true,
    features: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        pages: [{ href: "/", label: "Dashboard" }],
      },
      {
        id: "inicio",
        label: "Início",
        title: "Meu desempenho",
        icon: House,
        pages: [{ href: "/conteudo/inicio", label: "Início" }],
      },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    features: [
      {
        id: "planner",
        label: "Planner",
        icon: Columns3,
        pages: [
          { href: "/planner", label: "Quadro" },
          { href: "/solicitacoes", label: "Solicitações" },
          { href: "/vios-tarefas", label: "Tarefas do VIOS" },
        ],
      },
      {
        id: "gerador-conteudo",
        label: "Gerador de conteúdo",
        shortLabel: "Conteúdo",
        icon: Sparkles,
        pages: [
          { href: "/conteudo/roteiros", label: "Posts" },
          { href: "/conteudo/reels", label: "Roteiros de Reels" },
        ],
      },
      {
        // Item próprio: é onde o colaborador aprova o vídeo que gravou, com contador de pendências.
        id: "aprovacao-reels",
        label: "Aprovação de Reels",
        shortLabel: "Reels",
        icon: Clapperboard,
        pages: [{ href: REELS_APPROVAL_HREF, label: "Aprovação de Reels" }],
      },
      {
        id: "gerador-newsletter",
        label: "Gerador de newsletter",
        shortLabel: "Newsletter",
        icon: Newspaper,
        pages: [{ href: "/conteudo/boletim", label: "Newsletter" }],
      },
      {
        id: "calendario-editorial",
        label: "Calendário editorial",
        shortLabel: "Calendário",
        icon: CalendarRange,
        pages: [{ href: "/conteudo/cronograma", label: "Calendário editorial" }],
      },
      {
        id: "posicionamento-socios",
        label: "Posicionamento dos sócios",
        shortLabel: "Sócios",
        icon: PenLine,
        pages: [{ href: "/conteudo/gustavo", label: "Posicionamento dos sócios" }],
      },
      {
        id: "metricas",
        label: "Métricas de redes sociais",
        shortLabel: "Métricas",
        icon: TrendingUp,
        pages: [
          { href: "/instagram-insights", label: "Instagram" },
          { href: "/linkedin-insights", label: "LinkedIn" },
          { href: "/ga4-insights", label: "Site (GA4)" },
        ],
      },
      {
        id: "trafego-pago",
        label: "Tráfego pago",
        shortLabel: "Tráfego",
        icon: Megaphone,
        pages: [{ href: "/trafego-pago", label: "Tráfego pago" }],
      },
      {
        id: "email-marketing",
        label: "E-mail marketing",
        shortLabel: "E-mail",
        icon: Mail,
        pages: [{ href: "/email-marketing", label: "E-mail marketing" }],
      },
      {
        id: "certificados",
        label: "Certificados",
        icon: Award,
        pages: [{ href: "/certificados", label: "Certificados" }],
      },
      {
        id: "eventos",
        label: "Gestão de eventos",
        shortLabel: "Eventos",
        icon: Ticket,
        pages: [{ href: "/eventos", label: "Eventos" }],
      },
      {
        id: "fotos",
        label: "Fotos institucionais",
        shortLabel: "Fotos",
        icon: Camera,
        pages: [
          { href: "/minhas-fotos", label: "Minhas fotos" },
          { href: "/fotos-eventos", label: "Fotos de eventos" },
          { href: "/fotos-colaboradores", label: "Fotos dos colaboradores" },
        ],
      },
      {
        id: "nfc",
        label: "NFC Hub",
        shortLabel: "NFC",
        icon: Nfc,
        pages: [{ href: "/nfc", label: "NFC Hub" }],
      },
    ],
  },
  {
    id: "relacionamento",
    label: "Relacionamento / Comercial",
    features: [
      {
        id: "clientes",
        label: "Cadastro de clientes",
        shortLabel: "Clientes",
        icon: Contact,
        pages: [{ href: "/meus-clientes", label: "Cadastro de clientes" }],
      },
      {
        id: "nps",
        label: "Gestão de NPS",
        shortLabel: "NPS",
        icon: MessageSquareHeart,
        pages: [{ href: "/meus-clientes/nps", label: "Gestão de NPS" }],
      },
      {
        id: "icp",
        label: "ICP (cliente ideal)",
        title: "ICP (perfil de cliente ideal)",
        shortLabel: "ICP",
        icon: Crosshair,
        pages: [{ href: "/icp", label: "ICP" }],
      },
    ],
  },
  {
    id: "pessoas",
    label: "Pessoas e Cultura",
    features: [
      {
        id: "ferias",
        label: "Gestão de férias",
        shortLabel: "Férias",
        icon: Palmtree,
        pages: [{ href: "/rh/ferias", label: "Férias" }],
      },
      {
        id: "colaboradores",
        label: "Cadastro de colaboradores",
        shortLabel: "Equipe",
        icon: IdCard,
        pages: [
          { href: "/rh/qualificacoes", label: "Qualificações" },
          { href: "/rh/fichas-cadastrais", label: "Fichas cadastrais" },
        ],
      },
      {
        id: "organograma",
        label: "Organograma",
        icon: Network,
        pages: [{ href: "/rh/organograma", label: "Organograma" }],
      },
      {
        id: "clima",
        label: "Clima organizacional",
        shortLabel: "Clima",
        icon: Heart,
        pages: [{ href: "/clima", label: "Clima organizacional" }],
      },
      {
        id: "cafe-cultura",
        label: "Café com Cultura",
        shortLabel: "Café",
        icon: Coffee,
        pages: [{ href: "/cafe-cultura", label: "Café com Cultura" }],
      },
    ],
  },
  {
    id: "operacoes-legais",
    label: "Operações Legais",
    features: [
      {
        id: "operacoes-legais",
        label: "Visão geral",
        title: "Operações Legais",
        shortLabel: "Legal Ops",
        icon: Scale,
        pages: [{ href: "/operacoes-legais", label: "Operações Legais" }],
      },
      {
        id: "vistagem",
        label: "Vistagem e agendamento",
        shortLabel: "Vistagem",
        icon: CalendarClock,
        pages: [
          { href: "/operacoes-legais/vistagem", label: "Captura" },
          { href: "/operacoes-legais/vistagem/controladoria", label: "Controladoria" },
          { href: "/operacoes-legais/vistagem/duplicidades", label: "Duplicidades" },
          { href: "/operacoes-legais/vistagem/juridico", label: "Jurídico" },
          { href: "/operacoes-legais/vistagem/conferencia", label: "Conferência" },
        ],
      },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    collapsedByDefault: true,
    features: [
      {
        id: "usuarios",
        label: "Usuários",
        icon: Users,
        pages: [{ href: "/usuarios", label: "Usuários" }],
      },
      {
        id: "custos-projetos",
        label: "Custos de projetos",
        shortLabel: "Custos",
        icon: Wallet,
        pages: [{ href: "/custos-projetos", label: "Custos de projetos" }],
      },
      {
        id: "configuracoes",
        label: "Configurações",
        shortLabel: "Ajustes",
        icon: Settings,
        pages: [{ href: "/admin", label: "Configurações" }],
      },
    ],
  },
];

/** Telas com cabeçalho próprio que não aparecem na sidebar. */
const EXTRA_HEADERS: Array<{ href: string; eyebrow: string; title: string; icon: LucideIcon }> = [
  { href: "/perfil", eyebrow: "Conta", title: "Meu perfil", icon: User },
  { href: "/cafe-com-cultura", eyebrow: "Pessoas e Cultura", title: "Café com Cultura", icon: Coffee },
  { href: "/nfc/leituras", eyebrow: "NFC Hub", title: "Leituras que formam trajetórias", icon: Nfc },
];

export type NavProfile = AccessProfile & { department?: string | null };

const ALWAYS_VISIBLE = new Set([
  "/minhas-fotos",
  "/fotos-eventos",
  "/meus-clientes",
  "/meus-clientes/nps",
  "/conteudo/cronograma",
  REELS_APPROVAL_HREF,
]);

const RH_RESTRICTED = new Set(["/rh/qualificacoes", "/rh/fichas-cadastrais", "/rh/organograma"]);

const COLLABORATOR_PAGES = new Set([
  ...ALWAYS_VISIBLE,
  "/conteudo/inicio",
  "/conteudo/roteiros",
  "/conteudo/boletim",
  "/conteudo/reels",
]);

/**
 * Quais páginas aparecem no menu para este perfil. Três regimes:
 * permissões explícitas, colaborador de conteúdo (sem permissões) e legado/admin.
 */
export function createNavVisibility(profile: NavProfile | null | undefined): (href: string) => boolean {
  const feriasView =
    hasHrAccess(profile?.role, profile?.permissions) || profile?.ferias_view_enabled === true;
  const gustavo = canAccessGustavoContent(profile);
  const allowed = resolveAllowedSections(profile);

  if (allowed) {
    // Admin nunca cai aqui (resolveAllowedSections devolve null), então RH completo é só a chave.
    const rhFull = allowed.includes("/rh");
    const contentAccess = allowed.some((key) => key.startsWith("/conteudo"));
    return (href) => {
      if (ALWAYS_VISIBLE.has(href)) return true;
      if (href === "/fotos-colaboradores") return isCollaboratorPhotosManager(profile);
      if (isVistagemPath(href)) return hasVistagemAccess(profile);
      if (href.startsWith("/operacoes-legais")) return hasOperacoesLegaisAccess(profile);
      if (href === "/icp") return hasIcpAccess(profile);
      if (href === "/conteudo/gustavo") return gustavo;
      if (href === "/rh/ferias") return rhFull || feriasView;
      if (RH_RESTRICTED.has(href)) return rhFull;
      if (href.startsWith("/conteudo") && contentAccess) return true;
      return allowed.includes(href);
    };
  }

  if (isContentCollaborator(profile)) {
    return (href) => {
      if (COLLABORATOR_PAGES.has(href)) return true;
      if (href === "/rh/ferias") return feriasView;
      if (href === "/conteudo/gustavo") return gustavo;
      return false;
    };
  }

  const isAdmin = isAdminRole(profile);
  return (href) => {
    if (isVistagemPath(href)) return hasVistagemAccess(profile);
    if (href.startsWith("/operacoes-legais/")) return hasOperacoesLegaisAccess(profile);
    switch (href) {
      case "/conteudo/inicio":
        return false;
      case "/nfc":
        return isAdmin;
      case "/cafe-cultura":
        return hasCafeCulturaAccess(profile);
      case "/operacoes-legais":
        return hasOperacoesLegaisAccess(profile);
      case "/icp":
        return hasIcpAccess(profile);
      case "/fotos-colaboradores":
        return isCollaboratorPhotosManager(profile);
      case "/conteudo/gustavo":
        return gustavo;
      case "/rh/ferias":
        return isAdmin || feriasView;
      case "/admin":
        return isAdmin;
      default:
        return RH_RESTRICTED.has(href) ? isAdmin : true;
    }
  };
}

/** Frentes e funcionalidades que o perfil enxerga, na ordem do catálogo. */
export function buildNav(profile: NavProfile | null | undefined): VisibleNavFront[] {
  const isVisible = createNavVisibility(profile);
  return NAV_FRONTS.map((front) => ({
    ...front,
    features: front.features.flatMap((feature) => {
      const pages = feature.pages.filter((page) => isVisible(page.href));
      return pages.length > 0 ? [{ ...feature, pages, href: pages[0].href }] : [];
    }),
  })).filter((front) => front.features.length > 0);
}

function matchesHref(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Página mais específica que contém a rota (ex.: /meus-clientes/nps vence /meus-clientes). */
export function findActiveHref(pathname: string, hrefs: Iterable<string>): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (matchesHref(pathname, href) && (!best || href.length > best.length)) best = href;
  }
  return best;
}

export type HeaderContext = {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  /** Abas das páginas irmãs; vazio quando a funcionalidade tem uma página só. */
  tabs: NavPage[];
  activeHref: string | null;
};

const allPages = NAV_FRONTS.flatMap((front) =>
  front.features.flatMap((feature) => feature.pages.map((page) => ({ front, feature, page })))
);

export function resolveHeaderContext(pathname: string, nav: VisibleNavFront[]): HeaderContext {
  const activeHref = findActiveHref(pathname, allPages.map((entry) => entry.page.href));
  const extraHref = findActiveHref(pathname, EXTRA_HEADERS.map((extra) => extra.href));

  if (extraHref && (!activeHref || extraHref.length > activeHref.length)) {
    const extra = EXTRA_HEADERS.find((item) => item.href === extraHref)!;
    return { eyebrow: extra.eyebrow, title: extra.title, icon: extra.icon, tabs: [], activeHref: null };
  }

  const entry = allPages.find((item) => item.page.href === activeHref);
  if (!entry) {
    return { eyebrow: "ORQESTRAI", title: "Sistema de Marketing", icon: LayoutDashboard, tabs: [], activeHref: null };
  }

  const visibleFeature = nav
    .flatMap((front) => front.features)
    .find((feature) => feature.id === entry.feature.id);
  const tabs =
    visibleFeature && visibleFeature.pages.length > 1 && visibleFeature.pages.some((p) => p.href === activeHref)
      ? visibleFeature.pages
      : [];

  return {
    eyebrow: entry.front.label,
    title: entry.feature.title ?? entry.feature.label,
    icon: entry.feature.icon,
    tabs,
    activeHref,
  };
}
