import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { Config } from "./config.ts";

/**
 * O navegador do robô: sempre com janela (a pessoa precisa ver para concluir login, código ou CAPTCHA) e
 * com um perfil próprio, em robos/autos/perfil. É nesse perfil que ficam a sessão do tribunal e a extensão
 * Web Signer; ele não é o perfil pessoal de ninguém e não vai para o repositório.
 *
 * O robô abre o Chrome como um navegador comum e só depois se conecta a ele (porta de depuração em
 * 127.0.0.1, sorteada a cada execução). Aberto pelo modo de automação do Playwright, o Chrome não deixa
 * instalar extensão da Chrome Web Store, e o login por certificado depende da extensão Web Signer.
 */

const EXECUTAVEIS: Record<string, Partial<Record<NodeJS.Platform, string[]>>> = {
  chrome: {
    darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
    win32: ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"],
    linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"],
  },
  msedge: {
    darwin: ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"],
    win32: ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"],
    linux: ["/usr/bin/microsoft-edge"],
  },
};

function executavel(config: Config): string {
  if (config.navegadorExecutavel) return config.navegadorExecutavel;
  if (config.navegadorCanal === "chromium") return chromium.executablePath();
  const achado = (EXECUTAVEIS[config.navegadorCanal]?.[process.platform] ?? []).find((caminho) => existsSync(caminho));
  if (!achado) throw new Error(`Não achei o navegador "${config.navegadorCanal}" nesta máquina. Instale o Google Chrome ou aponte NAVEGADOR_EXECUTAVEL no .env.`);
  return achado;
}

/** PDF baixa em vez de abrir no visualizador, e sem perguntar onde salvar. */
async function prepararPreferencias(config: Config): Promise<void> {
  const pasta = join(config.pastas.perfil, "Default");
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
  preferencias.profile = { ...preferencias.profile, exit_type: "Normal" };
  await writeFile(arquivo, JSON.stringify(preferencias));
}

export interface Navegador {
  contexto: BrowserContext;
  pagina: Page;
  fechar: () => Promise<void>;
}

export async function abrirNavegador(config: Config): Promise<Navegador> {
  for (const pasta of Object.values(config.pastas)) await mkdir(pasta, { recursive: true });
  // O Chrome escreve aqui a porta que sorteou. Se o navegador do robô ficou aberto de uma execução anterior
  // (robô interrompido), a porta ainda responde: o robô se conecta a ele e aproveita a sessão do tribunal.
  const arquivoDaPorta = join(config.pastas.perfil, "DevToolsActivePort");
  const lerPorta = async () => (await readFile(arquivoDaPorta, "utf8").catch(() => "")).split("\n")[0]?.trim() ?? "";
  let processo: ChildProcess | null = null;
  let porta = await lerPorta();
  const aberto = /^\d+$/.test(porta) && (await fetch(`http://127.0.0.1:${porta}/json/version`, { signal: AbortSignal.timeout(2_000) }).then((resposta) => resposta.ok, () => false));
  if (!aberto) {
    await prepararPreferencias(config);
    await rm(arquivoDaPorta, { force: true });
    processo = spawn(
      executavel(config),
      [`--user-data-dir=${config.pastas.perfil.replace(/[\\/]+$/, "")}`, "--remote-debugging-port=0", "--no-first-run", "--no-default-browser-check", "--disable-session-crashed-bubble", "--hide-crash-restore-bubble", "about:blank"],
      { stdio: "ignore" }
    );
    processo.on("error", (erro) => console.error(`Não consegui abrir o navegador: ${erro.message}`));
    porta = "";
    for (let tentativa = 0; tentativa < 60 && !porta; tentativa += 1) {
      await new Promise((resolver) => setTimeout(resolver, 500));
      porta = await lerPorta();
    }
    if (!/^\d+$/.test(porta)) {
      processo.kill();
      throw new Error("O navegador do robô não respondeu. Se uma janela dele ficou aberta de uma execução anterior, feche-a e rode de novo.");
    }
  }

  const navegador: Browser = await chromium.connectOverCDP(`http://127.0.0.1:${porta}`);
  const contexto = navegador.contexts()[0];
  if (!contexto) throw new Error("O navegador do robô abriu sem perfil utilizável.");
  contexto.setDefaultTimeout(30_000);
  contexto.setDefaultNavigationTimeout(60_000);
  const pagina = contexto.pages()[0] ?? (await contexto.newPage());

  return {
    contexto,
    pagina,
    async fechar() {
      try {
        const sessao = await navegador.newBrowserCDPSession();
        await sessao.send("Browser.close");
      } catch {
        processo?.kill();
      }
      await new Promise((resolver) => setTimeout(resolver, 1_000));
    },
  };
}

/** Captura de tela e HTML da página, para ajustar um conector quando a tela do tribunal muda. Fica só nesta máquina. */
export async function guardarDiagnostico(config: Config, pagina: Page, etapa: string): Promise<string> {
  const nome = `${new Date().toISOString().replace(/[:.]/g, "-")}-${etapa.normalize("NFD").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().slice(0, 40)}`;
  const base = join(config.pastas.diagnostico, nome);
  await pagina.screenshot({ path: `${base}.png`, fullPage: true }).catch(() => undefined);
  await writeFile(`${base}.html`, await pagina.content().catch(() => "")).catch(() => undefined);
  return `${base}.png`;
}
