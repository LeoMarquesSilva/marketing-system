/**
 * Tour de novidades do Gerador de conteúdo (18/11/2026): mostra uma vez, para
 * quem já usava a tela, o que mudou. Advogados veem o fluxo da matéria;
 * Marketing vê também Escolhas da equipe e Configurações.
 */

/** Trocar o id quando houver uma nova leva de novidades (todos veem de novo). */
export const NOVIDADES_TOUR_ID = "gerador-novidades-2026-11";

export interface NovidadesTourStep {
  id: string;
  /** Seletor CSS do que fica em destaque; null = cartão no meio da tela. */
  target: string | null;
  title: string;
  body: string;
}

const COMMON_STEPS: NovidadesTourStep[] = [
  {
    id: "boas-vindas",
    target: null,
    title: "O Gerador de conteúdo mudou",
    body: "Em menos de um minuto mostramos o que tem de novo para você escolher matérias e acompanhar cada post até o Marketing.",
  },
  {
    id: "etapas",
    target: '[data-tour="roteiros-tabs"]',
    title: "Cada matéria numa etapa",
    body: "Disponíveis, Com o gestor, Gestor aprovou e Enviadas ao MKT. Clique numa etapa para ver só ela; os números mostram quantas estão em cada uma.",
  },
  {
    id: "selos",
    target: '[data-tour="roteiros-list"]',
    title: "Os selos da lista",
    body: "\"Potencial 8/10\" é a nota que a IA dá antes de escrever. \"Desdobramento\" avisa que a notícia continua um assunto que já postamos; \"Já falamos disso\", que não tem fato novo. E \"Escolhida por\", com foto, mostra quem já pegou cada matéria.",
  },
  {
    id: "ordenar",
    target: '[data-tour="roteiros-ordenar"]',
    title: "Mais promissoras primeiro",
    body: "Troque para \"Mais promissoras\" e a lista passa a vir pela nota de potencial, em vez da data.",
  },
  {
    id: "continuacao",
    target: '[data-tour="followup-alerts"]',
    title: "Aviso de continuação",
    body: "Quando um assunto que você postou tiver fato novo (uma nova decisão no caso, por exemplo), o sistema avisa no sino da barra lateral e aqui no topo, com o botão Fazer a continuação.",
  },
  {
    id: "detalhe",
    target: null,
    title: "Dentro da matéria",
    body: "Ao abrir uma matéria, à direita fica o histórico (quem trouxe, quem escolheu, o que falta) e o motivo da nota. Em cima, \"Refazer com IA\" reescreve o texto com pedidos prontos como \"Mais curto\" ou \"Tom mais técnico\", e a capa do carrossel sai com a foto de quem escolheu.",
  },
];

const MARKETING_STEPS: NovidadesTourStep[] = [
  {
    id: "escolhas",
    target: 'a[href="/conteudo/escolhas"]',
    title: "Escolhas da equipe",
    body: "Quem escolheu cada matéria, por pessoa e por área, o que está parado com o gestor há mais de 7 dias e a linha do tempo de tudo o que foi escolhido, descartado ou trazido por link.",
  },
  {
    id: "configuracoes",
    target: 'a[href="/conteudo/configuracoes"]',
    title: "Configurações do Gerador",
    body: "O que a IA aprendeu com o nosso Instagram, os escritórios de referência, a linha editorial de cada área, as fontes de notícias e a nota mínima para virar carrossel.",
  },
];

export function novidadesTourSteps(isManager: boolean): NovidadesTourStep[] {
  if (!isManager) return COMMON_STEPS;
  // Marketing: as duas telas novas entram antes do passo final do detalhe.
  return [...COMMON_STEPS.slice(0, -1), ...MARKETING_STEPS, COMMON_STEPS[COMMON_STEPS.length - 1]];
}

/**
 * Abre sozinho só para quem já conhecia a tela: o colaborador que ainda não fez o
 * tour de boas-vindas faz esse primeiro (e não vê dois tours de uma vez).
 */
export function shouldShowNovidadesTour(input: {
  forced?: boolean;
  seen: boolean | null;
  mustChangePassword?: boolean | null;
  onboardingActive: boolean;
  onboardingPending: boolean;
}): boolean {
  if (input.mustChangePassword || input.onboardingActive) return false;
  if (input.forced) return true;
  if (input.seen !== false) return false;
  return !input.onboardingPending;
}
