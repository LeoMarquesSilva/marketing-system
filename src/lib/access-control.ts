/**
 * Catálogo de seções acessíveis e presets de acesso, usados para decidir o que
 * cada usuário vê no sistema (sidebar + guard de rotas).
 *
 * O acesso de um usuário é dado por `users.permissions` (array de chaves de
 * seção). Quando null/vazio, cai no comportamento legado (role/department).
 */

import {
  canAccessGustavoContent,
  isGustavoContentPath,
} from "@/lib/gustavo-content/access";

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
  { key: "/planner", label: "Planner (quadro)" },
  { key: "/solicitacoes", label: "Planner (solicitações)" },
  { key: "/conteudo/roteiros", label: "Gerador de conteúdo (posts)" },
  { key: "/conteudo/boletim", label: "Gerador de newsletter" },
  { key: "/conteudo/reels", label: "Gerador de conteúdo (roteiros de Reels)" },
  { key: "/conteudo/cronograma", label: "Calendário editorial", alwaysAllowed: true },
  { key: "/conteudo/aprovacao-reels", label: "Aprovação de Reels", alwaysAllowed: true },
  { key: "/clima", label: "Clima organizacional" },
  { key: "/instagram-insights", label: "Métricas (Instagram)" },
  { key: "/linkedin-insights", label: "Métricas (LinkedIn)" },
  { key: "/ga4-insights", label: "Métricas (site GA4)" },
  { key: "/trafego-pago", label: "Tráfego pago" },
  { key: "/vios-tarefas", label: "Planner (tarefas do VIOS)" },
  { key: "/operacoes-legais", label: "Operações Legais", admin: true, manualOnly: true },
  { key: "/operacoes-legais/vistagem", label: "Vistagem e agendamento", manualOnly: true },
  { key: "/eventos", label: "Gestão de eventos" },
  { key: "/facilities", label: "Fornecedores e contratos (Facilities)", manualOnly: true },
  { key: "/cafe-cultura", label: "Café com Cultura", manualOnly: true },
  { key: "/email-marketing", label: "E-mail marketing" },
  { key: "/certificados", label: "Certificados" },
  { key: "/nfc", label: "NFC Hub" },
  { key: "/meus-clientes", label: "Cadastro de clientes e NPS", alwaysAllowed: true },
  { key: "/fotos-colaboradores", label: "Fotos dos colaboradores" },
  { key: "/usuarios", label: "Usuários" },
  { key: "/custos-projetos", label: "Custos de projetos" },
  { key: "/icp", label: "ICP (cliente ideal)", manualOnly: true },
  { key: "/rh", label: "RH (férias, dados cadastrais, organograma e boas práticas)", manualOnly: true },
  { key: "/admin", label: "Configurações", admin: true },
];

const ALL_KEYS = ACCESS_SECTIONS.map((s) => s.key);
const VALID_PERMISSION_KEYS = new Set(ALL_KEYS);

/** Chaves liberadas apenas manualmente (por usuário), nunca via preset em lote. */
export const MEUS_CLIENTES_KEY = "/meus-clientes";
export const CAFE_CULTURA_KEY = "/cafe-cultura";
export const OPERACOES_LEGAIS_KEY = "/operacoes-legais";
export const VISTAGEM_KEY = "/operacoes-legais/vistagem";
export const ICP_KEY = "/icp";
export const FACILITIES_KEY = "/facilities";
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
  "/briefings",
  "/minhas-fotos",
  "/fotos-eventos",
  "/cafe-com-cultura",
  "/conteudo/cronograma",
  "/conteudo/aprovacao-reels",
  MEUS_CLIENTES_KEY,
  // Peças de campanha do planner para quem vai postar (ex.: sócios).
  "/entregas",
  // Atualização da própria ficha cadastral (Pessoas e Cultura).
  "/minha-ficha",
];

/**
 * Rotas sensíveis que exigem permissão explícita mesmo no modo legado (perfil sem
 * `permissions` configuradas não ganha acesso automático, ao contrário do resto do
 * catálogo): "/rh" (dados de RH).
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
  /** Indicador de navegação; a autorização de dados é refeita no servidor. */
  ferias_view_enabled?: boolean | null;
  /** Membership do módulo Posicionamento Gustavo — nunca inferir por nome. */
  gustavo_content_member?: boolean | null;
  department?: string | null;
  /** Papel na Vistagem (controladoria ou juridico); a área é refeita no servidor. */
  vistagem_papel?: string | null;
}

/** Postagens da equipe: desempenho no Instagram dos posts de cada área. */
export const TEAM_POSTS_PATH = "/postagens-equipe";

export function isTeamPostsPath(pathname: string): boolean {
  return pathname === TEAM_POSTS_PATH || pathname.startsWith(`${TEAM_POSTS_PATH}/`);
}

/**
 * Indicador de menu e rota para Postagens da equipe: Marketing, quem já vê o
 * Instagram Insights e líderes de área (mesma flag de liderança de Férias).
 * O recorte por área é refeito no servidor.
 */
export function canSeeTeamPosts(profile: AccessProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isAdminRole(profile)) return true;
  if ((profile.role ?? "").toLowerCase() === "designer") return true;
  if ((profile.department ?? "").trim().toLowerCase() === "marketing") return true;
  if (profile.permissions?.includes("/instagram-insights")) return true;
  return profile.ferias_view_enabled === true;
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

/** Usuários não-admin que podem excluir solicitações (tarefas) no Planner. */
const DELETE_REQUESTS_USER_IDS = new Set([
  "73b4ed1a-6adf-4f61-9f5d-3fcce646d6b7", // Valentina Iacovacci
]);

export function canDeleteMarketingRequests(
  profile: AccessProfile | null | undefined
): boolean {
  if (!profile) return false;
  if (isAdminRole(profile)) return true;
  return Boolean(profile.id && DELETE_REQUESTS_USER_IDS.has(profile.id));
}

/** Painel do Café com Cultura: admin ou liberação manual em Usuários. */
export function hasCafeCulturaAccess(profile: AccessProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isAdminRole(profile)) return true;
  return Boolean(profile.permissions?.includes(CAFE_CULTURA_KEY));
}

/** Operações Legais: por enquanto só admin. Depois libera para o departamento. */
export function hasOperacoesLegaisAccess(profile: AccessProfile | null | undefined): boolean {
  return isAdminRole(profile);
}

/** Painel de Vistagem e agendamento: admin ou liberação manual em Usuários. */
export function hasVistagemAccess(profile: AccessProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isAdminRole(profile)) return true;
  return Boolean(profile.permissions?.includes(VISTAGEM_KEY));
}

export function isVistagemPath(pathname: string): boolean {
  return pathname === VISTAGEM_KEY || pathname.startsWith(`${VISTAGEM_KEY}/`);
}

/** Papel na Vistagem: a controladoria vê todas as abas e áreas; o jurídico, só a aba Jurídico das suas áreas. */
export type PapelVistagem = "controladoria" | "juridico";

export const VISTAGEM_JURIDICO_PATH = `${VISTAGEM_KEY}/juridico`;

/** Admin e quem tem a Vistagem sem papel marcado são controladoria; sem acesso, null. */
export function papelVistagem(profile: AccessProfile | null | undefined): PapelVistagem | null {
  if (!hasVistagemAccess(profile)) return null;
  if (isAdminRole(profile)) return "controladoria";
  return profile?.vistagem_papel === "juridico" ? "juridico" : "controladoria";
}

/** Tela da Vistagem que o perfil pode abrir: o jurídico só abre a aba Jurídico. */
export function canSeeVistagemPath(profile: AccessProfile | null | undefined, pathname: string): boolean {
  const papel = papelVistagem(profile);
  if (papel === "controladoria") return true;
  return papel === "juridico" && (pathname === VISTAGEM_JURIDICO_PATH || pathname.startsWith(`${VISTAGEM_JURIDICO_PATH}/`));
}

/**
 * ICP (receita por cliente): admin ou liberação manual em Usuários. A chave
 * nunca vem do modo legado — sem `/icp` marcado, só admin vê.
 */
export function hasIcpAccess(profile: AccessProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isAdminRole(profile)) return true;
  return Boolean(profile.permissions?.includes(ICP_KEY));
}

/**
 * Fornecedores e contratos (valores, contratos e dados de pagamento): admin ou
 * liberação manual em Usuários. Sem `/facilities` marcado, só admin vê.
 */
export function hasFacilitiesAccess(profile: AccessProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isAdminRole(profile)) return true;
  return Boolean(profile.permissions?.includes(FACILITIES_KEY));
}

export function isFacilitiesPath(pathname: string): boolean {
  return pathname === FACILITIES_KEY || pathname.startsWith(`${FACILITIES_KEY}/`);
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

  if (isVistagemPath(pathname)) {
    return canSeeVistagemPath(profile, pathname);
  }

  const isOperacoesLegaisRoute =
    pathname === OPERACOES_LEGAIS_KEY || pathname.startsWith(`${OPERACOES_LEGAIS_KEY}/`);
  if (isOperacoesLegaisRoute) {
    return hasOperacoesLegaisAccess(profile);
  }

  if (pathname === ICP_KEY || pathname.startsWith(`${ICP_KEY}/`)) {
    return hasIcpAccess(profile);
  }

  if (isTeamPostsPath(pathname)) {
    return canSeeTeamPosts(profile);
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
    return permissions.includes("/rh") || profile?.ferias_view_enabled === true;
  }

  const isOtherRhRoute = pathname.startsWith("/rh/");
  if (isOtherRhRoute) {
    if (isAdminRole(profile)) return true;
    const permissions = profile?.permissions ?? [];
    return permissions.includes("/rh");
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

  if (isGustavoContentPath(pathname)) {
    return canAccessGustavoContent(profile);
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
  const primeiro = allowed.includes("/") ? "/" : allowed[0];
  // O jurídico não abre a Captura (1ª aba da Vistagem): entra direto na aba Jurídico.
  return primeiro === VISTAGEM_KEY && papelVistagem(profile) === "juridico" ? VISTAGEM_JURIDICO_PATH : primeiro;
}

/**
 * Só admin altera convite da Festa de 10 anos em Meus Clientes.
 * Gestores com `/meus-clientes` veem a opção, mas ela fica inativa.
 */
export function canEditPartyInvite(profile: AccessProfile | null | undefined): boolean {
  return isAdminRole(profile);
}
