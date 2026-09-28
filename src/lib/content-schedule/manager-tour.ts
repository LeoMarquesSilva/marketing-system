export interface ContentScheduleTourProfile {
  must_change_password?: boolean | null;
  content_schedule_tutorial_completed_at?: string | null;
}

export function shouldShowContentScheduleManagerTour(
  profile: ContentScheduleTourProfile | null | undefined,
  options?: { forced?: boolean; managerMode?: boolean }
): boolean {
  if (!profile || !options?.managerMode || profile.must_change_password) return false;
  return Boolean(options.forced || !profile.content_schedule_tutorial_completed_at);
}

export interface ContentScheduleManagerTourStep {
  id: string;
  target: string | null;
  title: string;
  body: string;
}

export const CONTENT_SCHEDULE_MANAGER_TOUR_STEPS: ContentScheduleManagerTourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Seu cronograma de conteúdo",
    body: "Aqui você acompanha somente as entregas das áreas sob sua gestão e organiza quem da equipe ficará responsável por cada data.",
  },
  {
    id: "scope",
    target: '[data-tour="schedule-manager-scope"]',
    title: "Uma visão segura da sua gestão",
    body: "Estas etiquetas mostram seu escopo. Outras áreas não aparecem e você não consegue alterar entregas fora da sua equipe.",
  },
  {
    id: "summary",
    target: '[data-tour="schedule-summary"]',
    title: "Entenda o mês rapidamente",
    body: "Veja quantas entregas estão previstas, quantas já têm responsável, conteúdo vinculado ou publicação no Instagram.",
  },
  {
    id: "views",
    target: '[data-tour="schedule-views"]',
    title: "Calendário ou lista",
    body: "Use o calendário para entender a distribuição do mês. A lista facilita localizar uma entrega e fazer ajustes pontuais.",
  },
  {
    id: "filters",
    target: '[data-tour="schedule-filters"]',
    title: "Encontre uma entrega",
    body: "Pesquise por pessoa ou conteúdo e refine por área, formato, responsável e situação.",
  },
  {
    id: "assignment",
    target: '[data-tour="schedule-workspace"]',
    title: "Defina o responsável",
    body: "Abra uma data e escolha alguém da sua equipe. A troca fica salva imediatamente e Leonardo recebe uma notificação para ajustar a tarefa no VIOS.",
  },
];
