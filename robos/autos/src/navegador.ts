import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import type { Config } from "./config.ts";

/**
 * O navegador do robô: sempre com janela (a pessoa precisa ver para concluir login, código ou CAPTCHA) e
 * com um perfil próprio, em robos/autos/perfil. É nesse perfil que ficam a sessão do tribunal e a extensão
 * Web Signer; ele não é o perfil pessoal de ninguém e não vai para o repositório.
 */

/** PDF baixa em vez de abrir no visualizador, e sem perguntar onde salvar. */
async function prepararPreferencias(perfil: string): Promise<void> {
  const pasta = join(perfil, "Default");
  const arquivo = join(pasta, "Preferences");
  await mkdir(pasta, { recursive: true });
  let preferencias: Record<string, Record<string, unknown>> = {};
  try {
    preferencias = JSON.parse(await readFile(arquivo, "utf8"));
  } catch {
    // primeiro uso do perfil
  }
  preferencias.plugins = { ...preferencias.plugins, always_open_pdf_externally: true };
  preferencias.download = { ...preferencias.download, prompt_for_download: false };
  await writeFile(arquivo, JSON.stringify(preferencias));
}

export async function abrirNavegador(config: Config): Promise<{ contexto: BrowserContext; pagina: Page }> {
  for (const pasta of Object.values(config.pastas)) await mkdir(pasta, { recursive: true });
  await prepararPreferencias(config.pastas.perfil);
  const contexto = await chromium.launchPersistentContext(config.pastas.perfil, {
    channel: config.navegadorCanal === "chromium" ? undefined : config.navegadorCanal,
    headless: false,
    acceptDownloads: true,
    downloadsPath: config.pastas.downloads,
    viewport: null,
    // O Playwright desliga extensões por padrão; o login por certificado depende da extensão Web Signer.
    ignoreDefaultArgs: ["--disable-extensions"],
  });
  contexto.setDefaultTimeout(30_000);
  contexto.setDefaultNavigationTimeout(60_000);
  const pagina = contexto.pages()[0] ?? (await contexto.newPage());
  return { contexto, pagina };
}

/** Captura de tela e HTML da página, para ajustar um conector quando a tela do tribunal muda. Fica só nesta máquina. */
export async function guardarDiagnostico(config: Config, pagina: Page, etapa: string): Promise<string> {
  const nome = `${new Date().toISOString().replace(/[:.]/g, "-")}-${etapa.normalize("NFD").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().slice(0, 40)}`;
  const base = join(config.pastas.diagnostico, nome);
  await pagina.screenshot({ path: `${base}.png`, fullPage: true }).catch(() => undefined);
  await writeFile(`${base}.html`, await pagina.content().catch(() => "")).catch(() => undefined);
  return `${base}.png`;
}
