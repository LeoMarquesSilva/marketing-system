import { resolveAllowedSections } from "@/lib/access-control";
import { isContentCollaborator } from "@/lib/content-areas";

export interface ContentTourProfile {
  department?: string | null;
  role?: string | null;
  permissions?: string[] | null;
  content_tutorial_completed_at?: string | null;
}

export function isContentCollaboratorForTour(
  profile: ContentTourProfile | null | undefined
): boolean {
  if (!profile) return false;
  const allowed = resolveAllowedSections(profile);
  if (allowed?.some((k) => k.startsWith("/conteudo"))) return true;
  return isContentCollaborator(profile);
}

export function shouldShowContentTutorial(
  profile: ContentTourProfile | null | undefined,
  options?: { forced?: boolean }
): boolean {
  if (!profile || !isContentCollaboratorForTour(profile)) return false;
  if (options?.forced) return true;
  return !profile.content_tutorial_completed_at;
}

export const CONTENT_TUTORIAL_SESSION_KEY = "content-tutorial-pending";

export interface ContentTourStep {
  id: string;
  route: string;
  /** Seletor CSS; null = modal centralizado */
  target: string | null;
  title: string;
  body: string;
}

export const CONTENT_TOUR_STEPS: ContentTourStep[] = [
  {
    id: "welcome",
    route: "/conteudo/inicio",
    target: null,
    title: "Bem-vindo ao sistema",
    body: "Este tour rápido mostra o que você pode fazer aqui: acompanhar seu desempenho no Instagram e validar posts da sua área jurídica.",
  },
  {
    id: "inicio-header",
    route: "/conteudo/inicio",
    target: '[data-tour="inicio-header"]',
    title: "Sua página inicial",
    body: "Aqui você vê um resumo do seu desempenho no perfil @bismarchipires — posts vinculados a você e comparação com a média do escritório.",
  },
  {
    id: "inicio-stats",
    route: "/conteudo/inicio",
    target: '[data-tour="inicio-stats"]',
    title: "Métricas e comparação",
    body: "Alcance, interações e engajamento médio. As setas indicam se você está acima ou abaixo da média do escritório.",
  },
  {
    id: "sidebar-nav",
    route: "/conteudo/inicio",
    target: '[data-tour="sidebar-nav"], [data-tour="sidebar-nav-mobile"]',
    title: "Menu lateral",
    body: "Início traz seu desempenho. Conteúdo para Post é onde você valida notícias e carrosséis da sua área.",
  },
  {
    id: "roteiros-header",
    route: "/conteudo/roteiros",
    target: '[data-tour="roteiros-header"]',
    title: "Conteúdo para Post",
    body: "Notícias da sua área jurídica aparecem aqui. A IA monta um carrossel para você revisar antes do marketing publicar.",
  },
  {
    id: "roteiros-tabs",
    route: "/conteudo/roteiros",
    target: '[data-tour="roteiros-tabs"]',
    title: "Filtros e abas",
    body: "Use Recentes para ver novidades dos últimos dias e A validar para o que precisa da sua aprovação agora.",
  },
  {
    id: "roteiros-workflow",
    route: "/conteudo/roteiros",
    target: '[data-tour="roteiros-workflow"]',
    title: "Como validar um post",
    body: "1) Escolha a notícia · 2) Confira o carrossel gerado · 3) Aprove ou peça ajustes. O marketing cuida da arte final.",
  },
  {
    id: "profile-menu",
    route: "/conteudo/roteiros",
    target: '[data-tour="profile-menu"]',
    title: "Seu perfil",
    body: "Atualize nome, e-mail e foto quando quiser. Use Sair para encerrar a sessão com segurança.",
  },
  {
    id: "finish",
    route: "/conteudo/inicio",
    target: null,
    title: "Pronto para começar",
    body: "Explore à vontade. Quando houver posts aguardando validação, eles aparecerão em Conteúdo para Post → A validar.",
  },
];
