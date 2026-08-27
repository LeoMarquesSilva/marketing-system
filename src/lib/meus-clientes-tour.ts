import { canAccessPath } from "@/lib/access-control";

export interface MeusClientesTourProfile {
  role?: string | null;
  permissions?: string[] | null;
  meus_clientes_tutorial_completed_at?: string | null;
  /** Quando true, o tour não pode iniciar — primeiro acesso exige trocar a senha. */
  must_change_password?: boolean | null;
}

export function isMeusClientesUserForTour(
  profile: MeusClientesTourProfile | null | undefined
): boolean {
  if (!profile) return false;
  return canAccessPath(profile, "/meus-clientes");
}

export function shouldShowMeusClientesTutorial(
  profile: MeusClientesTourProfile | null | undefined,
  options?: { forced?: boolean }
): boolean {
  if (!profile || !isMeusClientesUserForTour(profile)) return false;
  // Nunca sobrepor a tela de troca de senha obrigatória.
  if (profile.must_change_password) return false;
  if (options?.forced) return true;
  return !profile.meus_clientes_tutorial_completed_at;
}

export const MEUS_CLIENTES_TUTORIAL_SESSION_KEY = "meus-clientes-tutorial-pending";

export interface MeusClientesTourStep {
  id: string;
  target: string | null;
  title: string;
  body: string;
  /** Badge opcional no card (ex.: "Gestor", "Responsável"). */
  roleLabel?: string;
}

const COMMON_STEPS: MeusClientesTourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Guia do NPS em Meus Clientes",
    body: "Este guia explica o fluxo completo da pesquisa NPS: o gestor da área designa quem vai contatar cada cliente; a pessoa responsável completa os cadastros, marca quem responde o NPS, envia o link e acompanha até o cliente responder.",
  },
  {
    id: "header",
    target: '[data-tour="mc-header"]',
    title: "Painel Meus Clientes",
    body: "Aqui você vê os clientes da sua área. Use Ver guia no cabeçalho sempre que quiser rever este passo a passo.",
  },
  {
    id: "progress",
    target: '[data-tour="mc-progress"]',
    title: "Progresso geral",
    body: "A barra resume quantos cadastros já estão completos na sua lista. Clique em “Ver pendências” para filtrar só o que ainda falta preencher antes de enviar o NPS.",
  },
  {
    id: "stats",
    target: '[data-tour="mc-stats"]',
    title: "Completos e pendentes",
    body: "Use os cards para alternar entre cadastros completos e pendentes. Só contatos com cadastro completo e NPS marcado entram no link da pesquisa.",
  },
  {
    id: "filters",
    target: '[data-tour="mc-filters"]',
    title: "Busca e filtros",
    body: "Busque por nome ou e-mail. Filtre por área jurídica e status comercial. Atalho: tecla / foca a busca.",
  },
  {
    id: "group-sample",
    target: '[data-tour="mc-group-sample"]',
    title: "Cada card é um cliente",
    body: "Abrimos um card de exemplo. Neles você vê contatos, pendências, área responsável e ações de NPS. Fora do guia, clique no card para expandir ou recolher.",
  },
  {
    id: "group-status",
    target: '[data-tour="mc-group-status"]',
    title: "Status comercial",
    body: "Confirme se o grupo está ativo ou inativo. Para inativos, informe se houve término de vigência ou rescisão contratual, com a data correspondente.",
  },
];

const GESTOR_STEP: MeusClientesTourStep = {
  id: "area-contact",
  target: '[data-tour="mc-area-contact"]',
  title: "Gestor: quem contata o cliente",
  roleLabel: "Gestor",
  body: "Como gestor oficial da área, escolha aqui o colaborador responsável por este grupo — quem vai completar cadastros, marcar elegíveis ao NPS, enviar o link e cobrar a resposta do cliente.",
};

const COLABORADOR_STEPS: MeusClientesTourStep[] = [
  {
    id: "contact-edit",
    target: '[data-tour="mc-contact-edit"]',
    title: "Responsável: editar contatos",
    roleLabel: "Responsável",
    body: "Clique no lápis para abrir o cadastro. Preencha nome, e-mail, telefone e cargo. Sem esses dados o contato fica pendente e não entra no link NPS.",
  },
  {
    id: "contact-nps",
    target: '[data-tour="mc-contact-edit"]',
    title: "Responsável: marcar elegíveis ao NPS",
    roleLabel: "Responsável",
    body: "No mesmo formulário, em Classificação, marque “Elegível ao NPS” para cada pessoa do grupo que pode responder a pesquisa. Se alguém não participa, use “Sem NPS”. Salve ao concluir.",
  },
  {
    id: "nps-send",
    target: '[data-tour="mc-nps-button"]',
    title: "Responsável: enviar o link NPS",
    roleLabel: "Responsável",
    body: "Com contatos completos e NPS marcado, clique em NPS no card. Copie a mensagem do WhatsApp, envie ao cliente, marque “NPS enviado” e acompanhe até ele responder. Se necessário, cobre o cliente pelo retorno.",
  },
];

const CLOSING_STEPS: MeusClientesTourStep[] = [
  {
    id: "export",
    target: '[data-tour="mc-export"]',
    title: "Exportar planilha",
    body: "Se precisar consultar ou compartilhar os dados, exporte a lista em planilha. As alterações oficiais devem ser feitas aqui no sistema.",
  },
  {
    id: "finish-gestor",
    target: null,
    title: "Resumo — gestor",
    roleLabel: "Gestor",
    body: "Seu papel: (1) designar quem contata em cada grupo; (2) acompanhar pendências na lista; (3) cobrar o responsável até todos os NPS elegíveis estarem enviados. Dúvidas: fale com o marketing.",
  },
  {
    id: "finish-colaborador",
    target: null,
    title: "Resumo — responsável",
    roleLabel: "Responsável",
    body: "Seu papel: (1) completar cadastros; (2) marcar elegíveis ao NPS; (3) enviar o link pelo WhatsApp; (4) marcar “NPS enviado”; (5) cobrar o cliente até responder. Dúvidas: fale com o marketing.",
  },
  {
    id: "finish",
    target: null,
    title: "Pronto para começar",
    body: "Comece pelos grupos com pendência. Gestores: definam quem contata. Responsáveis: completem cadastros, marquem NPS e enviem o link. Qualquer dúvida, fale com o marketing.",
  },
];

/** Passos que exigem um card de grupo expandido na lista. */
export const MEUS_CLIENTES_TOUR_EXPAND_STEPS = new Set([
  "group-sample",
  "group-status",
  "area-contact",
  "contact-edit",
  "contact-nps",
  "nps-send",
]);

export function buildMeusClientesTourSteps(options: {
  hasSampleGroup: boolean;
  /** Usuário é gestor oficial em `email_area_managers`. */
  isAreaManager: boolean;
  /** O card de exemplo tem área responsável e o usuário pode editar “Quem contata”. */
  canShowAreaContactStep: boolean;
}): MeusClientesTourStep[] {
  const steps: MeusClientesTourStep[] = [...COMMON_STEPS];

  if (options.canShowAreaContactStep) {
    steps.push(GESTOR_STEP);
  }

  steps.push(...COLABORADOR_STEPS, CLOSING_STEPS[0]);

  if (options.isAreaManager) {
    steps.push(CLOSING_STEPS[1]);
  }

  steps.push(CLOSING_STEPS[2], CLOSING_STEPS[3]);

  if (!options.hasSampleGroup) {
    return steps.filter((step) => !MEUS_CLIENTES_TOUR_EXPAND_STEPS.has(step.id));
  }

  return steps;
}

/** @deprecated Use buildMeusClientesTourSteps — mantido para referência em testes legados. */
export const MEUS_CLIENTES_TOUR_STEPS = buildMeusClientesTourSteps({
  hasSampleGroup: true,
  isAreaManager: true,
  canShowAreaContactStep: true,
});
