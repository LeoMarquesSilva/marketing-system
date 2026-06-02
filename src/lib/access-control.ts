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
  { key: "/usuarios", label: "Usuários" },
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

export interface AccessProfile {
  role?: string | null;
  permissions?: string[] | null;
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

/** O usuário pode acessar a rota informada? (apenas quando há permissões). */
export function canAccessPath(
  profile: AccessProfile | null | undefined,
  pathname: string
): boolean {
  const allowed = resolveAllowedSections(profile);
  if (!allowed) return true; // sem permissões explícitas → regra legada decide
  if (ALWAYS_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  // Match por rota base (mais específico primeiro para evitar "/" pegar tudo).
  const match = (key: string) =>
    key === "/" ? pathname === "/" : pathname === key || pathname.startsWith(key + "/");
  return allowed.some(match);
}

/** Primeira rota permitida (para redirecionar). */
export function firstAllowedPath(profile: AccessProfile | null | undefined): string {
  const allowed = resolveAllowedSections(profile);
  if (!allowed || allowed.length === 0) return "/";
  return allowed.includes("/") ? "/" : allowed[0];
}
