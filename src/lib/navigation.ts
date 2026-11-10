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
  BookCheck,
  CalendarClock,
  CalendarRange,
  Camera,
  ClipboardList,
  Clapperboard,
  Coffee,
  Columns3,
  Compass,
  Contact,
  Crosshair,
  Heart,
  House,
  IdCard,
  LayoutDashboard,
  Link2,
  Mail,
  Megaphone,
  MessageSquareHeart,
  Network,
  Newspaper,
  Nfc,
  Palmtree,
  PartyPopper,
  PenLine,
  Scale,
  Gavel,
  BookUser,
  Settings,
  Sparkles,
  Ticket,
  TrendingUp,
  Trophy,
  Truck,
  User,
  Users,
  UsersRound,
  Wallet,
  Wand2,
} from "lucide-react";
import {
  TEAM_POSTS_PATH,
  canSeeTeamPosts,
  TEAM_SURVEYS_KEY,
  hasTeamSurveysAccess,
  isTeamSurveysPath,
  PE27_KEY,
  hasPe27Access,
  isPe27Path,
  isPe27OnlyProfile,
  hasCafeCulturaAccess,
  hasFacilitiesAccess,
  hasIcpAccess,
  hasOperacoesLegaisAccess,
  canSeeVistagemPath,
  entradaDaVistagem,
  isAdminRole,
  isFacilitiesPath,
  isVistagemPath,
  isCollaboratorPhotosManager,
  resolveAllowedSections,
  type AccessProfile,
} from "@/lib/access-control";
import { isContentCollaborator } from "@/lib/content-areas";
import { canAccessGustavoContent } from "@/lib/gustavo-content/access";
import { FACILITIES_CONTRACTS_PATH, FACILITIES_SUPPLIERS_PATH } from "@/lib/facilities/types";
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
  /** No cabeçalho, sem o nome da frente em cima do título (ex.: "Vistagem de Publicações BP" já diz o que é). */
  semFrenteNoTopo?: boolean;
  /** Rótulo da barra inferior do celular. */
  shortLabel?: string;
  icon: LucideIcon;
  pages: NavPage[];
  /** Página de configurações do módulo (só admin): fica na engrenagem do canto direito do cabeçalho, não nas abas. */
  configuracoes?: NavPage;
  /** Por onde o perfil entra na funcionalidade (link da sidebar), quando não é a primeira aba liberada. */
  entrada?: (profile: NavProfile | null | undefined) => string;
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
    id: "estrategia",
    label: "Estratégia",
    features: [
      {
        // Planejamento Estratégico 2027: insumos do workshop, revisão dos sócios e, depois, plano tático. Admin edita; a chave /pe27 dá só leitura.
        id: "pe27",
        label: "PE27 · Planejamento 2027",
        title: "PE27 · Planejamento Estratégico 2027",
        shortLabel: "PE27",
        icon: Compass,
        pages: [
          { href: PE27_KEY, label: "Visão geral" },
          // Dinâmica 1: o que aproximou e afastou da Visão, Missão, Valores e Propósito.
          { href: `${PE27_KEY}/dinamica-1`, label: "Dinâmica 1 · Aproximou e afastou" },
          // Dinâmica 2: alavancas e metas por dimensão, com a decisão dos sócios.
          { href: `${PE27_KEY}/insumos`, label: "Dinâmica 2 · Alavancas e metas" },
        ],
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
        // Peças a partir dos modelos do Illustrator (campos + IA), exportadas em PNG.
        id: "estudio-pecas",
        label: "Estúdio de peças",
        shortLabel: "Estúdio",
        icon: Wand2,
        pages: [{ href: "/conteudo/estudio", label: "Estúdio de peças" }],
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
        // Coordenadores, gestores e sócios acompanham os posts da própria área.
        id: "postagens-equipe",
        label: "Postagens da equipe",
        shortLabel: "Postagens",
        icon: UsersRound,
        pages: [{ href: TEAM_POSTS_PATH, label: "Postagens da equipe" }],
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
        // Fichas de admissão, atualização cadastral e boas-vindas de quem entra.
        label: "Dados cadastrais",
        shortLabel: "Cadastro",
        icon: IdCard,
        pages: [{ href: "/rh/fichas-cadastrais", label: "Fichas cadastrais" }],
      },
      {
        id: "organograma",
        label: "Organograma",
        icon: Network,
        pages: [{ href: "/rh/organograma", label: "Organograma" }],
      },
      {
        id: "boas-praticas",
        // Registro dos feedbacks do Manual de Boas Práticas + dashboard (só para o RH).
        label: "Feedbacks de boas práticas",
        shortLabel: "Boas práticas",
        icon: BookCheck,
        pages: [{ href: "/rh/boas-praticas", label: "Boas práticas" }],
      },
      {
        // Premiação CIVIL da festa de 10 anos: todos votam; o comitê (RH) apura e revela.
        id: "bp-awards",
        label: "BP Awards",
        icon: Trophy,
        pages: [
          { href: "/rh/bp-awards", label: "Comitê" },
          { href: "/bp-awards", label: "Votação" },
        ],
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
        shortLabel: "Operações Legais",
        icon: Scale,
        pages: [{ href: "/operacoes-legais", label: "Operações Legais" }],
      },
      {
        id: "vistagem",
        label: "Vistagem de Publicações BP",
        shortLabel: "Vistagem",
        semFrenteNoTopo: true,
        icon: CalendarClock,
        pages: [
          { href: "/operacoes-legais/vistagem", label: "Visão geral" },
          { href: "/operacoes-legais/vistagem/base", label: "Gestão das publicações" },
          { href: "/operacoes-legais/vistagem/controladoria", label: "Triagem Manual" },
          { href: "/operacoes-legais/vistagem/duplicidades", label: "Duplicidades" },
          { href: "/operacoes-legais/vistagem/juridico", label: "Vistagem" },
          { href: "/operacoes-legais/vistagem/conferencia", label: "Conferência" },
          { href: "/operacoes-legais/vistagem/check", label: "Check" },
        ],
        configuracoes: { href: "/operacoes-legais/vistagem/configuracoes", label: "Configurações" },
        // O jurídico vê a Visão geral e a Vistagem, mas entra pela Vistagem (como no firstAllowedPath).
        entrada: entradaDaVistagem,
      },
      {
        // Cadastro de processos do ORQESTRAI (1º módulo do sistema que substitui o VIOS). Só admin por enquanto.
        id: "processos",
        label: "Processos",
        shortLabel: "Processos",
        icon: Gavel,
        pages: [
          { href: "/operacoes-legais/processos", label: "Processos" },
          { href: "/operacoes-legais/processos/saneamento", label: "Saneamento" },
        ],
        configuracoes: { href: "/operacoes-legais/processos/importacao", label: "Importação e VIOS" },
      },
      {
        // Cadastro único de pessoas (clientes, partes, sócios, fiadores, advogados), usado por Processos.
        id: "cadastro-pessoas",
        label: "Pessoas",
        shortLabel: "Pessoas",
        icon: BookUser,
        pages: [
          { href: "/operacoes-legais/pessoas", label: "Pessoas" },
          { href: "/operacoes-legais/pessoas/duplicadas", label: "Repetidas" },
        ],
      },
      {
        // Escuta do time (1º uso: PE27); a resposta fica em /pesquisa/<link>, aberta ao público de cada pesquisa.
        id: "pesquisas-equipe",
        label: "Pesquisas com a equipe",
        shortLabel: "Pesquisas",
        icon: ClipboardList,
        pages: [{ href: TEAM_SURVEYS_KEY, label: "Pesquisas" }],
      },
    ],
  },
  {
    id: "facilities",
    label: "Facilities",
    features: [
      {
        id: "eventos",
        label: "Gestão de eventos",
        shortLabel: "Eventos",
        icon: Ticket,
        pages: [{ href: "/eventos", label: "Eventos" }],
      },
      {
        // Cadastro único de fornecedores (o mesmo dos eventos) + contratos com datas-chave.
        id: "fornecedores",
        label: "Fornecedores e contratos",
        shortLabel: "Fornecedores",
        icon: Truck,
        pages: [
          { href: FACILITIES_SUPPLIERS_PATH, label: "Fornecedores" },
          { href: FACILITIES_CONTRACTS_PATH, label: "Contratos" },
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
  { href: "/meus-links", eyebrow: "Conta", title: "Meus links", icon: Link2 },
  { href: "/cafe-com-cultura", eyebrow: "Pessoas e Cultura", title: "Café com Cultura", icon: Coffee },
  { href: "/nfc/leituras", eyebrow: "NFC Hub", title: "Leituras que formam trajetórias", icon: Nfc },
  // Fora do menu de propósito: os remetentes chegam pelo link; quem organiza, pela aba Convidados do evento.
  { href: "/convites-festa", eyebrow: "Festa de 10 anos", title: "Convites dos clientes", icon: PartyPopper },
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

const RH_RESTRICTED = new Set([
  "/rh/fichas-cadastrais",
  "/rh/organograma",
  "/rh/boas-praticas",
  "/rh/bp-awards",
  // A votação é aberta a todos (canAccessPath), mas no menu só para o RH: o
  // colaborador chega pelo convite no sistema e pelo link do comunicado.
  "/bp-awards",
]);

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
  // Consultores externos liberados só no PE27 não veem nem as telas abertas a todos.
  if (isPe27OnlyProfile(profile)) return (href) => isPe27Path(href);
  const feriasView =
    hasHrAccess(profile?.role, profile?.permissions) || profile?.ferias_view_enabled === true;
  const gustavo = canAccessGustavoContent(profile);
  const teamPosts = canSeeTeamPosts(profile);
  const allowed = resolveAllowedSections(profile);

  if (allowed) {
    // Admin nunca cai aqui (resolveAllowedSections devolve null), então RH completo é só a chave.
    const rhFull = allowed.includes("/rh");
    const contentAccess = allowed.some((key) => key.startsWith("/conteudo"));
    return (href) => {
      if (ALWAYS_VISIBLE.has(href)) return true;
      if (href === "/fotos-colaboradores") return isCollaboratorPhotosManager(profile);
      if (isFacilitiesPath(href)) return hasFacilitiesAccess(profile);
      if (isVistagemPath(href)) return canSeeVistagemPath(profile, href);
      if (isTeamSurveysPath(href)) return hasTeamSurveysAccess(profile);
      if (isPe27Path(href)) return hasPe27Access(profile);
      if (href.startsWith("/operacoes-legais")) return hasOperacoesLegaisAccess(profile);
      if (href === "/icp") return hasIcpAccess(profile);
      if (href === "/conteudo/gustavo") return gustavo;
      if (href === TEAM_POSTS_PATH) return teamPosts;
      if (href === "/rh/ferias") return rhFull || feriasView;
      if (RH_RESTRICTED.has(href)) return rhFull;
      if (href.startsWith("/conteudo") && contentAccess) return true;
      return allowed.includes(href);
    };
  }

  if (isContentCollaborator(profile)) {
    return (href) => {
      if (COLLABORATOR_PAGES.has(href)) return true;
      if (isPe27Path(href)) return hasPe27Access(profile);
      if (href === "/rh/ferias") return feriasView;
      if (href === "/conteudo/gustavo") return gustavo;
      if (href === TEAM_POSTS_PATH) return teamPosts;
      return false;
    };
  }

  const isAdmin = isAdminRole(profile);
  return (href) => {
    if (isFacilitiesPath(href)) return hasFacilitiesAccess(profile);
    if (isVistagemPath(href)) return canSeeVistagemPath(profile, href);
    if (isTeamSurveysPath(href)) return hasTeamSurveysAccess(profile);
    if (isPe27Path(href)) return hasPe27Access(profile);
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
      case TEAM_POSTS_PATH:
        return teamPosts;
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
      if (pages.length === 0) return [];
      // A entrada do perfil só vale se for uma das abas que ele enxerga; senão, a primeira liberada.
      const entrada = feature.entrada?.(profile);
      const href = entrada && pages.some((page) => page.href === entrada) ? entrada : pages[0].href;
      return [{ ...feature, pages, href }];
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
  /** Engrenagem das configurações do módulo (quem mostra decide se a pessoa é admin); `ativa` na própria página. */
  configuracoes?: NavPage & { ativa: boolean };
};

const allPages = NAV_FRONTS.flatMap((front) =>
  front.features.flatMap((feature) => feature.pages.map((page) => ({ front, feature, page })))
);

const allConfiguracoes = NAV_FRONTS.flatMap((front) =>
  front.features.flatMap((feature) => (feature.configuracoes ? [{ front, feature, configuracoes: feature.configuracoes }] : []))
);

export function resolveHeaderContext(pathname: string, nav: VisibleNavFront[]): HeaderContext {
  // Página de configurações de um módulo: o cabeçalho do módulo, com as abas, nenhuma ativa e a engrenagem marcada.
  const naConfiguracao = allConfiguracoes.find(({ configuracoes }) => matchesHref(pathname, configuracoes.href));
  if (naConfiguracao) {
    const visivel = nav.flatMap((front) => front.features).find((feature) => feature.id === naConfiguracao.feature.id);
    return {
      eyebrow: naConfiguracao.feature.semFrenteNoTopo ? "" : naConfiguracao.front.label,
      title: naConfiguracao.feature.title ?? naConfiguracao.feature.label,
      icon: naConfiguracao.feature.icon,
      tabs: visivel && visivel.pages.length > 1 ? visivel.pages : [],
      activeHref: null,
      configuracoes: { ...naConfiguracao.configuracoes, ativa: true },
    };
  }

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
    eyebrow: entry.feature.semFrenteNoTopo ? "" : entry.front.label,
    title: entry.feature.title ?? entry.feature.label,
    icon: entry.feature.icon,
    tabs,
    activeHref,
    ...(entry.feature.configuracoes ? { configuracoes: { ...entry.feature.configuracoes, ativa: false } } : {}),
  };
}
