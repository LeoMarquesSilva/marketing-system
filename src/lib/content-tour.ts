import { resolveAllowedSections } from "@/lib/access-control";
import { isContentCollaborator } from "@/lib/content-areas";

export interface ContentTourProfile {
  department?: string | null;
  role?: string | null;
  permissions?: string[] | null;
  content_tutorial_completed_at?: string | null;
  /** Quando true, o tour não pode iniciar — primeiro acesso exige trocar a senha. */
  must_change_password?: boolean | null;
}

export function isContentCollaboratorForTour(
  profile: ContentTourProfile | null | undefined
): boolean {
  if (!profile) return false;
  const allowed = resolveAllowedSections(profile);
  // Com permissões explícitas, o tour de conteúdo só vale se tiver seção de conteúdo.
  // Sem isso, gestores de área jurídica (departamento) com acesso só a Meus Clientes
  // eram tratados como colaboradores e o tour redirecionava para /conteudo em loop.
  if (allowed) {
    return allowed.some((k) => k === "/conteudo/roteiros" || k.startsWith("/conteudo"));
  }
  return isContentCollaborator(profile);
}

export function shouldShowContentTutorial(
  profile: ContentTourProfile | null | undefined,
  options?: { forced?: boolean }
): boolean {
  if (!profile || !isContentCollaboratorForTour(profile)) return false;
  // Nunca sobrepor a tela de troca de senha obrigatória.
  if (profile.must_change_password) return false;
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
    title: "Bem-vindo",
    body: "Em poucos passos você vai conhecer as telas principais: seu desempenho no Instagram, as notícias da sua área e como validar um post até enviá-lo ao marketing.",
  },
  {
    id: "inicio-header",
    route: "/conteudo/inicio",
    target: '[data-tour="inicio-header"]',
    title: "Sua página inicial",
    body: "Resumo do seu desempenho no @bismarchipires: posts vinculados a você e comparação com a média do escritório.",
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
    body: "Aqui aparecem as notícias da sua área jurídica. A IA monta um carrossel para você revisar antes de publicar.",
  },
  {
    id: "roteiros-tabs",
    route: "/conteudo/roteiros",
    target: '[data-tour="roteiros-tabs"]',
    title: "Abas e filtros",
    body: "Recentes traz novidades dos últimos dias. A validar lista o que precisa da sua ação agora.",
  },
  {
    id: "roteiros-list",
    route: "/conteudo/roteiros",
    target: '[data-tour="roteiros-list"]',
    title: "Escolha uma notícia",
    body: "Clique em qualquer card ou linha da lista para abrir o detalhe. Nos próximos passos mostramos o que você pode fazer dentro dele.",
  },
  {
    id: "demo-insight",
    route: "/conteudo/roteiros",
    target: '[data-tour="demo-insight"]',
    title: "Insight de performance",
    body: "Cada notícia pode trazer uma dica cruzando temas que performam bem no Instagram na sua área — use para escolher o que vale a pena validar.",
  },
  {
    id: "demo-actions-bar",
    route: "/conteudo/roteiros",
    target: '[data-tour="demo-actions-bar"]',
    title: "Conferir, editar e baixar",
    body: "Conferir notícia abre a fonte original para validar se é real e atual. Editar texto ajusta o carrossel gerado pela IA. Baixar Word gera um .doc para revisar offline ou compartilhar.",
  },
  {
    id: "demo-approve-review",
    route: "/conteudo/roteiros",
    target: '[data-tour="demo-approve-review"]',
    title: "Aprovar e enviar p/ revisão",
    body: "Com o texto ok, clique aqui para registrar no sistema que o post está em revisão. Em seguida, envie o material ao seu gestor pelo VIOS ou e-mail — conforme o processo da sua área. O gestor não acessa este sistema.",
  },
  {
    id: "demo-vios-link",
    route: "/conteudo/roteiros",
    target: '[data-tour="demo-vios-link"]',
    title: "Vincular tarefa do VIOS",
    body: "Se a sua área usa o VIOS para mandar conteúdo ao gestor, vincule a tarefa aqui. Isso conecta este post ao Planner do marketing quando você enviar ao MKT.",
  },
  {
    id: "demo-after-review",
    route: "/conteudo/roteiros",
    target: '[data-tour="demo-after-review"]',
    title: "Gestor aprovou (você registra aqui)",
    body: "Quando o gestor aprovar pelo VIOS ou e-mail, volte a este post e clique em Gestor aprovou. Você confirma no sistema que a revisão externa foi concluída — o gestor não entra aqui.",
  },
  {
    id: "demo-send-mkt",
    route: "/conteudo/roteiros",
    target: '[data-tour="demo-send-mkt"]',
    title: "Enviar ao marketing",
    body: "No lugar de mandar e-mail ao marketing, clique aqui. O conteúdo entra direto no Planner — o time recebe tudo pronto para criar a arte e publicar.",
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
    body: "Abra Conteúdo para Post → A validar sempre que houver novidades. Qualquer dúvida, fale com o marketing.",
  },
];
