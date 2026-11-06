/**
 * Guia (tour) da Vistagem: um por aba, como o onboarding do SAMA. Abre sozinho na primeira vez que a pessoa entra na
 * aba e volta pelo "Ver guia" do cabeçalho. Cada passo aponta para um elemento da tela com data-tour; sem o elemento
 * (fila vazia, nada aberto), o cartão aparece no meio da tela com o mesmo texto.
 */

export const MODULOS_GUIA = [
  "visao-geral",
  "gestao",
  "triagem",
  "duplicidades",
  "vistagem",
  "conferencia",
  "check",
  "configuracoes",
] as const;
export type ModuloGuia = (typeof MODULOS_GUIA)[number];

export interface PassoGuia {
  id: string;
  titulo: string;
  texto: string;
  /** Valor do data-tour do elemento a destacar; null = cartão no meio da tela. */
  alvo: string | null;
  /** Outro data-tour, quando o alvo só existe com dados (ex.: publicação aberta). */
  alternativa?: string;
}

const BASE = "/operacoes-legais/vistagem";

const ROTAS: Record<string, ModuloGuia> = {
  "": "visao-geral",
  base: "gestao",
  controladoria: "triagem",
  duplicidades: "duplicidades",
  juridico: "vistagem",
  conferencia: "conferencia",
  check: "check",
  configuracoes: "configuracoes",
};

/** Aba da Vistagem pela rota; null fora da Vistagem. */
export function moduloDaRota(pathname: string | null | undefined): ModuloGuia | null {
  if (!pathname) return null;
  const caminho = pathname.replace(/\/+$/, "");
  if (caminho !== BASE && !caminho.startsWith(`${BASE}/`)) return null;
  const aba = caminho.slice(BASE.length).replace(/^\//, "").split("/")[0] ?? "";
  return ROTAS[aba] ?? null;
}

/** Abas cujo guia a pessoa já viu (até o fim ou pulando), com a data; o banco e o navegador somados. */
export type GuiasVistos = Partial<Record<ModuloGuia, string>>;

export function guiasVistos(...fontes: unknown[]): GuiasVistos {
  const vistos: GuiasVistos = {};
  for (const fonte of fontes) {
    if (!fonte || typeof fonte !== "object") continue;
    for (const [modulo, quando] of Object.entries(fonte as Record<string, unknown>)) {
      if ((MODULOS_GUIA as readonly string[]).includes(modulo) && typeof quando === "string" && quando) {
        vistos[modulo as ModuloGuia] ??= quando;
      }
    }
  }
  return vistos;
}

export function ehModuloGuia(valor: unknown): valor is ModuloGuia {
  return typeof valor === "string" && (MODULOS_GUIA as readonly string[]).includes(valor);
}
