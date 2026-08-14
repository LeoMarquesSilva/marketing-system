import { canAccessPath } from "@/lib/access-control";

export interface MinhasFotosTourProfile {
  role?: string | null;
  permissions?: string[] | null;
  minhas_fotos_tutorial_completed_at?: string | null;
  /** Quando true, o tour não pode iniciar — primeiro acesso exige trocar a senha. */
  must_change_password?: boolean | null;
}

export function canAccessMinhasFotosTour(
  profile: MinhasFotosTourProfile | null | undefined
): boolean {
  if (!profile) return false;
  return canAccessPath(profile, "/minhas-fotos");
}

export function shouldShowMinhasFotosTutorial(
  profile: MinhasFotosTourProfile | null | undefined,
  options?: { forced?: boolean; photoCount?: number }
): boolean {
  if (!profile || !canAccessMinhasFotosTour(profile)) return false;
  if (profile.must_change_password) return false;
  if (options?.forced) return true;
  const photoCount = options?.photoCount ?? 0;
  if (photoCount <= 0) return false;
  return !profile.minhas_fotos_tutorial_completed_at;
}

export const MINHAS_FOTOS_TUTORIAL_SESSION_KEY = "minhas-fotos-tutorial-pending";

export interface MinhasFotosTourStep {
  id: string;
  /** Seletor CSS; null = modal centralizado */
  target: string | null;
  title: string;
  body: string;
}

export const MINHAS_FOTOS_TOUR_STEPS: MinhasFotosTourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Bem-vindo às Minhas fotos",
    body: "Este guia mostra como escolher quais fotos da sessão corporativa o marketing pode usar e qual imagem aparece no seu perfil do sistema.",
  },
  {
    id: "header",
    target: '[data-tour="mf-header"]',
    title: "Sua galeria",
    body: "Aqui você vê as fotos disponibilizadas pelo marketing. Use Ver guia no cabeçalho sempre que quiser rever este tour.",
  },
  {
    id: "gallery",
    target: '[data-tour="mf-gallery"]',
    title: "Grade de fotos",
    body: "Cada card é uma foto da sessão. Use Abrir para ver em qualidade normal, ou Baixar e Excluir nas ações do card.",
  },
  {
    id: "session",
    target: '[data-tour="mf-session"]',
    title: "Sessão da foto",
    body: "O rótulo indica de qual sessão corporativa veio a foto — útil quando você tem fotos de anos ou eventos diferentes.",
  },
  {
    id: "usage-options",
    target: '[data-tour="mf-usage-options"]',
    title: "Opções de uso",
    body: "Marque em quais ações o marketing pode usar cada foto. Uma mesma foto pode ter mais de um uso ativo.",
  },
  {
    id: "official-usage",
    target: '[data-tour="mf-official-usage"]',
    title: "Foto dos sistemas do escritório",
    body: "Esta opção define qual foto vira seu avatar no sistema e a imagem do perfil NFC. Só uma foto pode estar ativa por vez.",
  },
  {
    id: "finish",
    target: '[data-tour="mf-actions"]',
    title: "Baixar e concluir",
    body: "Baixe a foto original quando precisar. Pronto — escolha seus usos e comece a usar a galeria.",
  },
];

function extractTourTargetKey(target: string): string | null {
  const match = target.match(/data-tour="([^"]+)"/);
  return match?.[1] ?? null;
}

/** Remove passos cujo alvo condicional não está presente no DOM. */
export function filterMinhasFotosTourSteps(
  steps: MinhasFotosTourStep[],
  availableTargets: string[]
): MinhasFotosTourStep[] {
  const available = new Set(availableTargets);
  return steps.filter((step) => {
    if (step.target === null) return true;
    const key = extractTourTargetKey(step.target);
    if (!key) return true;
    return available.has(key);
  });
}

/** Resolve os passos contra os elementos realmente renderizados antes de abrir o tour. */
export function resolveMinhasFotosTourSteps(
  steps: MinhasFotosTourStep[],
  hasTarget: (selector: string) => boolean
): MinhasFotosTourStep[] {
  return steps.filter((step) => step.target === null || hasTarget(step.target));
}
