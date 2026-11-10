/**
 * Logo oficial de cada sistema dos links de boas-vindas, escolhido pelo
 * endereço. Os arquivos ficam em public/rh/boas-vindas/logos (PNG 128 px),
 * tirados do próprio sistema em 09/11/2026:
 * - VIOS: ícone da tela de entrada de bp.vios.com.br;
 * - Responsum: favicon de www.responsum.com.br;
 * - Feedz: o app (app.feedz.com.br) hoje se apresenta como TOTVS RH e usa o símbolo da TOTVS;
 * - Legis: ícone do app na tela de entrada do Quoti (quoti.cloud/bismarchipires);
 * - Excel e SharePoint: ícones de produto da Microsoft (CDN do Office);
 * - Planner: ícone atual (2024) do Microsoft Planner.
 * Endereço sem logo conhecido cai no ícone genérico.
 */

export const TOOL_LOGO_BASE = "/rh/boas-vindas/logos";

export interface ToolLogo {
  src: string;
  /** Nome do sistema, para o texto alternativo. */
  name: string;
}

function logo(file: string, name: string): ToolLogo {
  return { src: `${TOOL_LOGO_BASE}/${file}`, name };
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function toolLogoFor(url: string): ToolLogo | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const path = decodeURIComponent(parsed.pathname).toLowerCase();

  if (hostMatches(host, "vios.com.br")) return logo("vios.png", "VIOS");
  if (hostMatches(host, "responsum.com.br")) return logo("responsum.png", "Responsum");
  if (hostMatches(host, "feedz.com.br")) return logo("feedz.png", "Feedz");
  if (hostMatches(host, "quoti.cloud")) return logo("legis.png", "Legis");
  if (hostMatches(host, "planner.cloud.microsoft") || hostMatches(host, "tasks.office.com")) {
    return logo("planner.png", "Microsoft Planner");
  }
  if (hostMatches(host, "sharepoint.com")) {
    // Link de compartilhamento de planilha (/:x:/) ou arquivo .xlsx abre no Excel.
    if (path.startsWith("/:x:/") || /\.xlsx?$/.test(path)) return logo("excel.png", "Microsoft Excel");
    return logo("sharepoint.png", "SharePoint");
  }
  return null;
}
