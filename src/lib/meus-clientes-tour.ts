import { canAccessPath } from "@/lib/access-control";

export interface MeusClientesTourProfile {
  role?: string | null;
  permissions?: string[] | null;
  meus_clientes_tutorial_completed_at?: string | null;
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
  if (options?.forced) return true;
  return !profile.meus_clientes_tutorial_completed_at;
}

export const MEUS_CLIENTES_TUTORIAL_SESSION_KEY = "meus-clientes-tutorial-pending";

export interface MeusClientesTourStep {
  id: string;
  target: string | null;
  title: string;
  body: string;
}

export const MEUS_CLIENTES_TOUR_STEPS: MeusClientesTourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Bem-vindo ao Meus Clientes",
    body: "Este tour mostra como confirmar dados dos seus clientes, o status comercial de cada grupo e a classificação para NPS e Festa de 10 anos.",
  },
  {
    id: "header",
    target: '[data-tour="mc-header"]',
    title: "Sua lista de clientes",
    body: "Aqui você vê os clientes sob sua responsabilidade como gestor de área. O objetivo é conferir e completar e-mail, telefone e cargo de cada contato.",
  },
  {
    id: "progress",
    target: '[data-tour="mc-progress"]',
    title: "Progresso geral",
    body: "A barra resume quantos cadastros já estão completos. Clique em “Ver pendentes” para filtrar só o que ainda falta preencher.",
  },
  {
    id: "stats",
    target: '[data-tour="mc-stats"]',
    title: "Completos e pendentes",
    body: "Use os cards para alternar entre cadastros completos e pendentes. Grupos com pendência aparecem destacados na lista.",
  },
  {
    id: "filters",
    target: '[data-tour="mc-filters"]',
    title: "Busca e filtros",
    body: "Busque por nome ou e-mail. Filtre por área jurídica e status comercial (ativo/inativo). Atalho: tecla / foca a busca.",
  },
  {
    id: "group-sample",
    target: '[data-tour="mc-group-sample"]',
    title: "Seus clientes",
    body: "Cada card é um cliente. Abrimos um card de exemplo: nele você vê os contatos vinculados, avisos do que falta preencher, a área jurídica e se o cliente está ativo ou inativo. Fora do tour, clique no card para expandir.",
  },
  {
    id: "group-status",
    target: '[data-tour="mc-group-status"]',
    title: "Status comercial do grupo",
    body: "Confirme se o grupo está ativo ou inativo. Para inativos, informe se houve término de vigência ou rescisão contratual, com a data correspondente.",
  },
  {
    id: "contact-edit",
    target: '[data-tour="mc-contact-edit"]',
    title: "Preencher contatos",
    body: "Clique no lápis para editar. No formulário, confira e-mail e telefone, cargo, sócios e a classificação NPS/Festa. Para a festa, escolha o critério do convite.",
  },
  {
    id: "export",
    target: '[data-tour="mc-export"]',
    title: "Exportar planilha",
    body: "Se precisar consultar ou compartilhar os dados, você pode exportar a lista em planilha pelo botão Exportar. As alterações oficiais devem ser feitas aqui no sistema.",
  },
  {
    id: "finish",
    target: null,
    title: "Pronto para começar",
    body: "Comece pelos grupos com pendência: confirme o status comercial e complete os contatos. Qualquer dúvida, fale com o marketing.",
  },
];

export const MEUS_CLIENTES_TOUR_EXPAND_STEPS = new Set([
  "group-sample",
  "group-status",
  "contact-edit",
]);
