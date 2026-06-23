/**
 * Catálogo de seções acessíveis e presets de acesso, usados para decidir o que
 * cada usuário vê no sistema (sidebar + guard de rotas).
 *
 * O acesso de um usuário é dado por `users.permissions` (array de chaves de
 * seção). Quando null/vazio, cai no comportamento legado (role/department).
 */

export interface AccessSection {
  key: string; // rota base
  label: string;
  admin?: boolean;
}

/** Seções do sistema (chave = rota base usada no menu e nas rotas). */
export const ACCESS_SECTIONS: AccessSection[] = [
  { key: "/", label: "Dashboard" },
  { key: "/planner", label: "Planner" },
  { key: "/solicitacoes", label: "Solicitações" },
  { key: "/conteudo/roteiros", label: "Conteúdo para Post" },
  { key: "/vibe-marketing", label: "Vibe Marketing" },
  { key: "/clima", label: "Clima" },
  { key: "/instagram-insights", label: "Instagram Insights" },
  { key: "/trafego-pago", label: "Tráfego Pago" },
  { key: "/vios-tarefas", label: "Tarefas VIOS" },
  { key: "/vincular-solicitantes", label: "Vincular Solicitantes" },
  { key: "/fotos-colaboradores", label: "Fotos Colaboradores" },
  { key: "/usuarios", label: "Usuários" },
  { key: "/custos-projetos", label: "Custos de Projetos" },
  { key: "/admin", label: "Configurações", admin: true },
  { key: "/admin/conteudo-temas", label: "Temas RSS", admin: true },
];

const ALL_KEYS = ACCESS_SECTIONS.map((s) => s.key);
const NON_ADMIN_KEYS = ACCESS_SECTIONS.filter((s) => !s.admin).map((s) => s.key);

/** Presets de acesso (preenchem os checkboxes; o salvo é a lista final). */
export const ACCESS_PRESETS: Record<string, string[]> = {
  "Colaborador de conteúdo": ["/conteudo/roteiros"],
  "Marketing completo": [...NON_ADMIN_KEYS],
  Administrador: [...ALL_KEYS],
};

/** Rotas sempre acessíveis para qualquer usuário autenticado. */
export const ALWAYS_ALLOWED_PATHS = ["/perfil", "/alterar-senha"];

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

/**
 * Seções permitidas explicitamente. Retorna null quando não há permissões
 * definidas (usar regra legada). Admin sempre tem tudo.
 */
export function resolveAllowedSections(
  profile: AccessProfile | null | undefined
): string[] | null {
  if (!profile) return null;
  // Admin nunca é limitado pelo catálogo (acesso total, inclusive rotas futuras).
  if ((profile.role ?? "").toLowerCase() === "admin") return null;
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
  const isFotosRoute =
    pathname === "/fotos-colaboradores" || pathname.startsWith("/fotos-colaboradores/");

  if (isFotosRoute) {
    if (hasCollaboratorPhotosAccess(profile)) return true;
    const allowed = resolveAllowedSections(profile);
    if (allowed?.some((k) => k === "/usuarios" || k === "/fotos-colaboradores")) return true;
    return false;
  }

  const allowed = resolveAllowedSections(profile);
  if (!allowed) return true; // sem permissões explícitas → regra legada decide
  if (ALWAYS_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
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
