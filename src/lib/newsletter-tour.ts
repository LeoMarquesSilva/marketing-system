import { canAccessPath } from "@/lib/access-control";

export interface NewsletterTourProfile {
  role?: string | null;
  permissions?: string[] | null;
  newsletter_tutorial_completed_at?: string | null;
  must_change_password?: boolean | null;
}

export function canAccessNewsletterTour(
  profile: NewsletterTourProfile | null | undefined
): boolean {
  if (!profile) return false;
  return canAccessPath(profile, "/conteudo/boletim");
}

export function shouldShowNewsletterTutorial(
  profile: NewsletterTourProfile | null | undefined,
  options?: { forced?: boolean }
): boolean {
  if (!profile || !canAccessNewsletterTour(profile)) return false;
  if (profile.must_change_password) return false;
  if (options?.forced) return true;
  return !profile.newsletter_tutorial_completed_at;
}

export const NEWSLETTER_TUTORIAL_SESSION_KEY = "newsletter-tutorial-pending";

export interface NewsletterTourStep {
  id: string;
  /** Seletor CSS; null = modal centralizado */
  target: string | null;
  title: string;
  body: string;
}

/** Tour da lista de edições (antes de abrir uma newsletter). */
export const NEWSLETTER_LIST_TOUR_STEPS: NewsletterTourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Bem-vindo à Newsletter",
    body: "Aqui você monta o informativo da sua área a partir das notícias já coletadas pela IA: escolhe o que entra, revisa o texto, assina e baixa o Word.",
  },
  {
    id: "list-header",
    target: '[data-tour="nl-list-header"]',
    title: "Suas edições",
    body: "Cada edição é um número do informativo (ex.: 1ª Edição | 2026). Abra uma existente ou crie uma nova para começar.",
  },
  {
    id: "list-new",
    target: '[data-tour="nl-new-edition"]',
    title: "Nova edição",
    body: "Clique aqui, dê um título (ex.: Newsletter de Reestruturação) e, se quiser, o rótulo da edição. Em seguida você escolhe as notícias.",
  },
  {
    id: "list-finish",
    target: null,
    title: "Próximo passo",
    body: "Crie ou abra uma edição. O guia continua dentro dela: escolher notícias, pontuar, redigir, assinar e baixar o Word.",
  },
];

/** Tour dentro da edição aberta. */
export const NEWSLETTER_EDITOR_TOUR_STEPS: NewsletterTourStep[] = [
  {
    id: "editor-welcome",
    target: null,
    title: "Montando a edição",
    body: "O fluxo é em dois passos: primeiro escolher as notícias, depois revisar os textos e assinar. Começamos pela curadoria.",
  },
  {
    id: "editor-pick",
    target: '[data-tour="nl-pick-news"]',
    title: "Passo 1 — Escolher notícias",
    body: "Esta é a etapa principal. Aqui aparecem as notícias da sua área já coletadas pela IA. Clique em um card para ler o resumo completo.",
  },
  {
    id: "editor-card",
    target: '[data-tour="nl-news-card"]',
    title: "Abrir, pontuar e decidir",
    body: "No detalhe você lê o texto da matéria, dá uma nota de 1 a 5 (relevância para a newsletter) e escolhe Adicionar e redigir — ou marca várias com + para redigir em lote.",
  },
  {
    id: "editor-add",
    target: '[data-tour="nl-add-batch"]',
    title: "Redigir com a IA",
    body: "Depois de marcar as notícias, use este botão. A IA escreve cada seção em tom institucional, pronta para você revisar.",
  },
  {
    id: "editor-build",
    target: '[data-tour="nl-build"]',
    title: "Passo 2 — Montar a newsletter",
    body: "Abaixo ficam a abertura, os textos de cada seção e a assinatura. Edite o que precisar, reordene ou peça para a IA regerar um trecho.",
  },
  {
    id: "editor-sign",
    target: '[data-tour="nl-actions"]',
    title: "Assinar e baixar",
    body: "Quando estiver pronto, Assinar newsletter registra que você validou o conteúdo. Baixar Word gera o documento para compartilhar. Pronto para começar.",
  },
];
