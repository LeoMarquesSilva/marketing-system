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

/** Tela inicial de todo usuário logado (dados da pessoa, pendências, atalhos e equipe). */
export const HOME_PATH = "/";
/** Dashboard do Planner de marketing: até 10/11/2026 era a rota "/". */
export const MARKETING_DASHBOARD_PATH = "/painel-marketing";
/** Chave antiga do dashboard, ainda gravada em `users.permissions` de quem não foi salvo de novo. */
const LEGACY_DASHBOARD_KEY = "/";

/** Troca a chave antiga do dashboard ("/") pela rota nova, sem duplicar. */
function withCurrentKeys(keys: string[]): string[] {
  if (!keys.includes(LEGACY_DASHBOARD_KEY)) return keys;
  const mapped = keys.map((key) => (key === LEGACY_DASHBOARD_KEY ? MARKETING_DASHBOARD_PATH : key));
  return [...new Set(mapped)];
}

/** Seções do sistema (chave = rota base usada no menu e nas rotas). */
export const ACCESS_SECTIONS: AccessSection[] = [
  { key: MARKETING_DASHBOARD_PATH, label: "Dashboard de marketing" },
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
  { key: "/operacoes-legais/vistagem", label: "Vistagem de Publicações BP", manualOnly: true },
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
  { key: "/pe27", label: "PE27 · Planejamento 2027 (só leitura)", manualOnly: true },
  { key: "/pe27/editar", label: "PE27 · editar decisões, alavancas e metas", manualOnly: true },
  { key: "/admin", label: "Configurações", admin: true },
];

const ALL_KEYS = ACCESS_SECTIONS.map((s) => s.key);
const VALID_PERMISSION_KEYS = new Set(ALL_KEYS);

/** Chaves liberadas apenas manualmente (por usuário), nunca via preset em lote. */
export const MEUS_CLIENTES_KEY = "/meus-clientes";
export const CAFE_CULTURA_KEY = "/cafe-cultura";
export const OPERACOES_LEGAIS_KEY = "/operacoes-legais";
export const VISTAGEM_KEY = "/operacoes-legais/vistagem";
export const TEAM_SURVEYS_KEY = "/operacoes-legais/pesquisas";
export const ICP_KEY = "/icp";
export const FACILITIES_KEY = "/facilities";
export const PE27_KEY = "/pe27";
/** Chave de permissão (não é rota): edição no PE27 para quem não é admin. */
export const PE27_EDIT_KEY = "/pe27/editar";
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
  // Links de boas-vindas da própria área (Pessoas e Cultura).
  "/meus-links",
  // Votação do BP Awards (o comitê fica em /rh/bp-awards, só com RH).
  "/bp-awards",
  // Resposta às pesquisas com a equipe (o servidor confere se a pessoa está no público).
  "/pesquisa",
  // Confirmação de presença na festa de 10 anos (o servidor confere se a pessoa é da equipe).
  "/festa-10-anos",
  // Envio dos convites da festa aos clientes: cada remetente vê só os seus (o servidor confere).
  "/convites-festa",
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

/**
 * Pesquisas com a equipe (criar, enviar e ver resultados): só admin, sem
 * liberação manual em Usuários (decisão dos embaixadores do PE27). Responder é
 * aberto a quem está no público da pesquisa.
 */
export function hasTeamSurveysAccess(profile: AccessProfile | null | undefined): boolean {
  return isAdminRole(profile);
}

export function isTeamSurveysPath(pathname: string): boolean {
  return pathname === TEAM_SURVEYS_KEY || pathname.startsWith(`${TEAM_SURVEYS_KEY}/`);
}

/**
 * PE27 (Planejamento Estratégico 2027): admin ou liberação manual em Usuários
 * (nunca pelo modo legado). A chave `/pe27` só lê; `/pe27/editar` também
 * decide, edita e cria (consultores Camila e Zamboni, desde 10/11/2026).
 */
export function hasPe27Access(profile: AccessProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isAdminRole(profile)) return true;
  return Boolean(profile.permissions?.some((key) => key === PE27_KEY || key === PE27_EDIT_KEY));
}

export function canEditPe27(profile: AccessProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isAdminRole(profile)) return true;
  return Boolean(profile.permissions?.includes(PE27_EDIT_KEY));
}

export function isPe27Path(pathname: string): boolean {
  return pathname === PE27_KEY || pathname.startsWith(`${PE27_KEY}/`);
}

/**
 * Perfil liberado só para o PE27 (ex.: consultores externos Camila Gracioli e
 * Carlos Zamboni): não enxerga nada além do módulo, nem as telas abertas a
 * todo usuário logado (Meus Clientes, fotos, calendário editorial…).
 */
export function isPe27OnlyProfile(profile: AccessProfile | null | undefined): boolean {
  if (!profile || isAdminRole(profile)) return false;
  const permissions = profile.permissions ?? [];
  return permissions.length > 0 && permissions.every((key) => key === PE27_KEY || key === PE27_EDIT_KEY);
}

/** Fora do módulo, o perfil só-PE27 abre apenas a troca de senha. */
const PE27_ONLY_EXTRA_PATHS = ["/alterar-senha"];

/** Painel de Vistagem e agendamento: admin ou liberação manual em Usuários. */
export function hasVistagemAccess(profile: AccessProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isAdminRole(profile)) return true;
  return Boolean(profile.permissions?.includes(VISTAGEM_KEY));
}

export function isVistagemPath(pathname: string): boolean {
  return pathname === VISTAGEM_KEY || pathname.startsWith(`${VISTAGEM_KEY}/`);
}

/** Papel na Vistagem: a controladoria vê todas as abas e áreas; o jurídico, a Visão geral e a aba Vistagem, só das suas áreas. */
export type PapelVistagem = "controladoria" | "juridico";

export const VISTAGEM_JURIDICO_PATH = `${VISTAGEM_KEY}/juridico`;

/** Admin e quem tem a Vistagem sem papel marcado são controladoria; sem acesso, null. */
export function papelVistagem(profile: AccessProfile | null | undefined): PapelVistagem | null {
  if (!hasVistagemAccess(profile)) return null;
  if (isAdminRole(profile)) return "controladoria";
  return profile?.vistagem_papel === "juridico" ? "juridico" : "controladoria";
}

/** Configurações da Vistagem (regras, IA, vistadores): só admin. */
export const VISTAGEM_CONFIGURACOES_PATH = `${VISTAGEM_KEY}/configuracoes`;

/**
 * Tela da Vistagem que o perfil pode abrir: o jurídico abre a Visão geral (só a página, não as abas abaixo dela) e
 * a aba Vistagem; as configurações, só admin.
 */
export function canSeeVistagemPath(profile: AccessProfile | null | undefined, pathname: string): boolean {
  if (pathname === VISTAGEM_CONFIGURACOES_PATH || pathname.startsWith(`${VISTAGEM_CONFIGURACOES_PATH}/`)) return isAdminRole(profile);
  const papel = papelVistagem(profile);
  if (papel === "controladoria") return true;
  if (papel !== "juridico") return false;
  return pathname === VISTAGEM_KEY || pathname === VISTAGEM_JURIDICO_PATH || pathname.startsWith(`${VISTAGEM_JURIDICO_PATH}/`);
}

/** Por onde a pessoa entra na Vistagem: o jurídico, pela aba Vistagem (a Visão geral é consulta); os outros, pela Visão geral. */
export function entradaDaVistagem(profile: AccessProfile | null | undefined): string {
  return papelVistagem(profile) === "juridico" ? VISTAGEM_JURIDICO_PATH : VISTAGEM_KEY;
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
  const keys = withCurrentKeys(raw.filter((k): k is string => typeof k === "string")).filter((k) =>
    VALID_PERMISSION_KEYS.has(k)
  );
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
    return withCurrentKeys(profile.permissions);
  }
  return null;
}

/** O usuário pode acessar a rota informada? */
export function canAccessPath(
  profile: AccessProfile | null | undefined,
  pathname: string
): boolean {
  if (isPe27OnlyProfile(profile)) {
    return isPe27Path(pathname) || PE27_ONLY_EXTRA_PATHS.includes(pathname);
  }

  if (pathname === HOME_PATH) return canSeeHome(profile);

  if (ALWAYS_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }

  if (isVistagemPath(pathname)) {
    return canSeeVistagemPath(profile, pathname);
  }

  if (isTeamSurveysPath(pathname)) {
    return hasTeamSurveysAccess(profile);
  }

  if (isPe27Path(pathname)) {
    return hasPe27Access(profile);
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

  return allowed.some((key) => pathname === key || pathname.startsWith(key + "/"));
}

/**
 * A tela inicial ("/") está em lançamento: por enquanto só admin enxerga
 * (decisão do usuário em 10/11/2026). Para liberar a todos, trocar para false.
 */
export const HOME_ADMIN_ONLY = true;

/** Quem abre a tela inicial. O perfil liberado só para o PE27 nunca abre. */
export function canSeeHome(profile: AccessProfile | null | undefined): boolean {
  if (!profile || isPe27OnlyProfile(profile)) return false;
  return HOME_ADMIN_ONLY ? isAdminRole(profile) : true;
}

/**
 * Para onde a pessoa vai ao entrar (e quando tenta abrir o que não pode): a
 * tela inicial, para quem a enxerga; os demais seguem entrando pela primeira
 * seção liberada, como antes dela existir.
 */
export function firstAllowedPath(profile: AccessProfile | null | undefined): string {
  if (isPe27OnlyProfile(profile)) return PE27_KEY;
  if (canSeeHome(profile)) return HOME_PATH;
  const allowed = resolveAllowedSections(profile);
  if (!allowed || allowed.length === 0) return MARKETING_DASHBOARD_PATH;
  // Colaborador de conteúdo cai na tela de desempenho.
  if (hasContentAccess(allowed) && !allowed.includes(MARKETING_DASHBOARD_PATH)) return CONTENT_HOME_PATH;
  const primeiro = allowed.includes(MARKETING_DASHBOARD_PATH) ? MARKETING_DASHBOARD_PATH : allowed[0];
  // A chave de edição do PE27 não é uma página: entra pela Visão geral do módulo.
  if (primeiro === PE27_EDIT_KEY) return PE27_KEY;
  // O jurídico entra direto na aba Vistagem, onde está o trabalho dele.
  return primeiro === VISTAGEM_KEY ? entradaDaVistagem(profile) : primeiro;
}

/**
 * Só admin altera convite da Festa de 10 anos em Meus Clientes.
 * Gestores com `/meus-clientes` veem a opção, mas ela fica inativa.
 */
export function canEditPartyInvite(profile: AccessProfile | null | undefined): boolean {
  return isAdminRole(profile);
}
