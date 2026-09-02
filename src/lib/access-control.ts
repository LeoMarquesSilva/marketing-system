/**
 * Catálogo de seções acessíveis e presets de acesso, usados para decidir o que
 * cada usuário vê no sistema (sidebar + guard de rotas).
 *
 * O acesso de um usuário é dado por `users.permissions` (array de chaves de
 * seção). Quando null/vazio, cai no comportamento legado (role/department).
 */

import { hasOperacoesLegaisAccess, isOperacoesLegaisPath } from "@/lib/operacoes-legais/access";

export interface AccessSection {
  key: string; // rota base
  label: string;
  admin?: boolean;
  /** Liberação só manual (nunca entra em preset de lote, exceto Administrador). */
  manualOnly?: boolean;
  /** Sempre visível para usuário autenticado e ativo — não depende de checkbox. */
  alwaysAllowed?: boolean;
}

/** Seções do sistema (chave = rota base usada no menu e nas rotas). */
export const ACCESS_SECTIONS: AccessSection[] = [
  { key: "/", label: "Dashboard" },
  { key: "/planner", label: "Planner" },
  { key: "/solicitacoes", label: "Solicitações" },
  { key: "/conteudo/roteiros", label: "Conteúdo para Post" },
  { key: "/conteudo/boletim", label: "Newsletter" },
  { key: "/conteudo/reels", label: "Roteiros de Reels" },
  { key: "/clima", label: "Clima" },
  { key: "/instagram-insights", label: "Instagram Insights" },
  { key: "/linkedin-insights", label: "LinkedIn Insights" },
  { key: "/ga4-insights", label: "Analytics (GA4)" },
  { key: "/trafego-pago", label: "Tráfego Pago" },
  { key: "/vios-tarefas", label: "Tarefas VIOS" },
  { key: "/eventos", label: "Eventos" },
  { key: "/cafe-cultura", label: "Café com Cultura", admin: true },
  { key: "/email-marketing", label: "E-mail Marketing" },
  { key: "/nfc", label: "NFC Hub" },
  { key: "/meus-clientes", label: "Meus Clientes", alwaysAllowed: true },
  { key: "/fotos-colaboradores", label: "Fotos Colaboradores" },
  { key: "/usuarios", label: "Usuários" },
  { key: "/custos-projetos", label: "Custos de Projetos" },
  { key: "/rh", label: "RH (Férias e Qualificações)", manualOnly: true },
  { key: "/operacoes-legais", label: "Operações Legais", manualOnly: true },
  { key: "/admin", label: "Configurações", admin: true },
];

const ALL_KEYS = ACCESS_SECTIONS.map((s) => s.key);
const VALID_PERMISSION_KEYS = new Set(ALL_KEYS);

/** Chaves liberadas apenas manualmente (por usuário), nunca via preset em lote. */
export const MEUS_CLIENTES_KEY = "/meus-clientes";
export const MANUAL_ONLY_KEYS = ACCESS_SECTIONS.filter((s) => s.manualOnly).map((s) => s.key);

const NON_ADMIN_KEYS = ACCESS_SECTIONS.filter(
  (s) => !s.admin && !s.manualOnly && !s.alwaysAllowed
).map((s) => s.key);

/** Presets de acesso (preenchem os checkboxes; o salvo é a lista final). */
export const ACCESS_PRESETS: Record<string, string[]> = {
  "Colaborador de conteúdo": ["/conteudo/roteiros"],
  "Marketing completo": [...NON_ADMIN_KEYS],
  Administrador: [...ALL_KEYS],
};

/** Rotas sempre acessíveis para qualquer usuário autenticado. */
export const ALWAYS_ALLOWED_PATHS = [
  "/perfil",
  "/alterar-senha",
  "/minhas-fotos",
  "/cafe-com-cultura",
  MEUS_CLIENTES_KEY,
];

/**
 * Rotas sensíveis que exigem permissão explícita mesmo no modo legado (perfil sem
 * `permissions` configuradas não ganha acesso automático, ao contrário do resto do
 * catálogo): "/rh" (dados de RH) e "/operacoes-legais" (department Ops ou admin).
 */

/** Página inicial do colaborador de conteúdo (desempenho no Instagram). */
export const CONTENT_HOME_PATH = "/conteudo/inicio";
const CONTENT_KEY = "/conteudo/roteiros";

/** Quem tem acesso ao conteúdo enxerga toda a subárvore /conteudo. */
function hasContentAccess(allowed: string[]): boolean {
  return allowed.some((k) => k === CONTENT_KEY || k.startsWith("/conteudo"));
}

export interface AccessProfile {
  role?: string | null;
  permissions?: string[] | null;
  id?: string;
  department?: string | null;
  /** Indicador de navegação; a autorização de dados é refeita no servidor. */
  ferias_view_enabled?: boolean | null;
}

/** Usuários com acesso à página Fotos Colaboradores (além do catálogo de permissões). */
const COLLABORATOR_PHOTOS_USER_IDS = new Set([
  "2f08c695-770e-47ce-b4e4-ce27fa414df8", // Leonardo Marques
  "73b4ed1a-6adf-4f61-9f5d-3fcce646d6b7", // Valentina Iacovacci
]);

export function hasCollaboratorPhotosAccess(
  profile: AccessProfile | null | undefined
): boolean {
  if (!profile?.id) return false;
  return COLLABORATOR_PHOTOS_USER_IDS.has(profile.id);
}

/** MTK/admin: sobe galeria, apaga fotos e edita categorias de uso. */
export function isCollaboratorPhotosManager(
  profile: AccessProfile | null | undefined
): boolean {
  if (!profile) return false;
  if (isAdminRole(profile)) return true;
  if (hasCollaboratorPhotosAccess(profile)) return true;
  return Boolean(
    profile.permissions?.some((k) => k === "/usuarios" || k === "/fotos-colaboradores")
  );
}

export function isAdminRole(profile: AccessProfile | null | undefined): boolean {
  return (profile?.role ?? "").toLowerCase() === "admin";
}

export function isManualOnlyKey(key: string): boolean {
  return MANUAL_ONLY_KEYS.includes(key);
}

/**
 * Normaliza a lista salva em `users.permissions`:
 * - remove chaves inválidas
 * - array vazio → null (regra legada por cargo/área)
 */
export function normalizePermissionsInput(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const keys = raw
    .filter((k): k is string => typeof k === "string")
    .filter((k) => VALID_PERMISSION_KEYS.has(k));
  // Mantém ordem do catálogo para UI estável.
  const ordered = ALL_KEYS.filter((k) => keys.includes(k));
  return ordered.length > 0 ? ordered : null;
}

/**
 * Seções permitidas explicitamente. Retorna null quando não há permissões
 * definidas (usar regra legada). Admin sempre tem tudo.
 */
export function resolveAllowedSections(
  profile: AccessProfile | null | undefined
): string[] | null {
  if (!profile) return null;
  // Admin nunca é limitado pelo catálogo (acesso total, inclusive rotas futuras).
  if (isAdminRole(profile)) return null;
  if (profile.permissions && profile.permissions.length > 0) {
    return profile.permissions;
  }
  return null;
}

/** O usuário pode acessar a rota informada? */
export function canAccessPath(
  profile: AccessProfile | null | undefined,
  pathname: string
): boolean {
  if (ALWAYS_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }

  const isFeriasRoute =
    pathname === "/rh" ||
    pathname === "/rh/ferias" ||
    pathname.startsWith("/rh/ferias/") ||
    pathname === "/ferias" ||
    pathname.startsWith("/ferias/");
  if (isFeriasRoute) {
    if (isAdminRole(profile)) return true;
    const permissions = profile?.permissions ?? [];
    return (
      permissions.includes("/rh") ||
      permissions.includes("/ferias") ||
      profile?.ferias_view_enabled === true
    );
  }

  const isOtherRhRoute = pathname.startsWith("/rh/");
  if (isOtherRhRoute) {
    if (isAdminRole(profile)) return true;
    const permissions = profile?.permissions ?? [];
    return permissions.includes("/rh") || permissions.includes("/ferias");
  }

  if (isOperacoesLegaisPath(pathname)) {
    return hasOperacoesLegaisAccess(profile);
  }

  const manualOnlyKey = MANUAL_ONLY_KEYS.find(
    (key) => pathname === key || pathname.startsWith(key + "/")
  );
  if (manualOnlyKey) {
    if (isAdminRole(profile)) return true;
    return Boolean(profile?.permissions?.includes(manualOnlyKey));
  }

  const isFotosRoute =
    pathname === "/fotos-colaboradores" || pathname.startsWith("/fotos-colaboradores/");

  if (isFotosRoute) {
    return isCollaboratorPhotosManager(profile);
  }

  const allowed = resolveAllowedSections(profile);
  if (!allowed) return true; // sem permissões explícitas → regra legada decide
  if (pathname.startsWith("/conteudo") && hasContentAccess(allowed)) {
    return true;
  }

  const match = (key: string) =>
    key === "/" ? pathname === "/" : pathname === key || pathname.startsWith(key + "/");
  return allowed.some(match);
}

/** Primeira rota permitida (para redirecionar). */
export function firstAllowedPath(profile: AccessProfile | null | undefined): string {
  const allowed = resolveAllowedSections(profile);
  if (!allowed || allowed.length === 0) return "/";
  // Colaborador de conteúdo cai na home de desempenho.
  if (hasContentAccess(allowed) && !allowed.includes("/")) return CONTENT_HOME_PATH;
  return allowed.includes("/") ? "/" : allowed[0];
}

/**
 * Só admin altera convite da Festa de 10 anos em Meus Clientes.
 * Gestores com `/meus-clientes` veem a opção, mas ela fica inativa.
 */
export function canEditPartyInvite(profile: AccessProfile | null | undefined): boolean {
  return isAdminRole(profile);
}
