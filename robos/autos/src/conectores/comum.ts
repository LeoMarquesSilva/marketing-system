import { open, stat } from "node:fs/promises";
import type { Page } from "playwright";
import { comecaComoPdf } from "./esaj-urls.ts";
import { FalhaDoConector, type Ambiente } from "./tipos.ts";

/** O que todo conector usa: CAPTCHA, cliques com diagnóstico e a conferência do PDF baixado. */

const TAMANHO_MAXIMO = 200 * 1024 * 1024;

/** Desafio visível na tela (reCAPTCHA, hCaptcha, Turnstile ou imagem). O robô só detecta: quem resolve é a pessoa. */
export async function temCaptcha(pagina: Page): Promise<boolean> {
  const desafio = pagina.locator(
    "iframe[src*='recaptcha'][src*='bframe'], iframe[src*='recaptcha'][src*='anchor'], iframe[src*='hcaptcha'], iframe[src*='challenges.cloudflare'], img[src*='captcha' i], input[name*='captcha' i]:not([type=hidden])"
  );
  const total = await desafio.count().catch(() => 0);
  for (let i = 0; i < total; i += 1) {
    if (
      await desafio
        .nth(i)
        .isVisible()
        .catch(() => false)
    )
      return true;
  }
  return false;
}

export async function visivel(pagina: Page, seletor: string): Promise<boolean> {
  return pagina
    .locator(seletor)
    .first()
    .isVisible()
    .catch(() => false);
}

/** Clica no primeiro candidato que existir na tela; sem nenhum, guarda o diagnóstico e explica em que etapa parou. */
export async function clicar(ambiente: Ambiente, pagina: Page, candidatos: readonly string[], etapa: string, sistema: string, espera = 20_000): Promise<void> {
  const limite = Date.now() + espera;
  while (Date.now() < limite) {
    for (const seletor of candidatos) {
      const alvo = pagina.locator(seletor).first();
      if (await alvo.isVisible().catch(() => false)) {
        await alvo.click();
        return;
      }
    }
    await pagina.waitForTimeout(500);
  }
  const captura = await ambiente.diagnostico(pagina, etapa);
  throw new FalhaDoConector(`A tela do ${sistema} mudou ou não carregou: não achei como ${etapa}. Diagnóstico guardado em ${captura}.`);
}

/** O arquivo baixado é um PDF dentro do limite do bucket? */
export async function conferirPdf(arquivo: string): Promise<void> {
  const { size } = await stat(arquivo);
  const leitor = await open(arquivo, "r");
  try {
    const inicio = new Uint8Array(5);
    await leitor.read(inicio, 0, 5, 0);
    if (!comecaComoPdf(inicio)) throw new FalhaDoConector("O tribunal devolveu um arquivo que não é PDF (provável página de erro). Tente de novo mais tarde.");
  } finally {
    await leitor.close();
  }
  if (size > TAMANHO_MAXIMO) throw new FalhaDoConector(`O PDF dos autos tem ${Math.round(size / (1024 * 1024))} MB e passa do limite de 200 MB. Baixe em partes e anexe à mão.`);
}

/** Botões, links e campos da tela, para ajustar um conector (modo --inspecionar). Só o que identifica o controle. */
export async function controlesDaTela(pagina: Page): Promise<Record<string, unknown>[]> {
  return pagina.evaluate(() =>
    [...document.querySelectorAll("button, input[type=button], input[type=submit], input[type=radio], input[type=checkbox], a[id], a[onclick], a[href*='acao='], select")].slice(0, 300).map((elemento) => {
      const item = elemento as HTMLInputElement & HTMLAnchorElement;
      const href = (item.getAttribute("href") ?? "").replace(/([?&](hash|ticket|key)=)[^&]+/gi, "$1…");
      return {
        tag: item.tagName.toLowerCase(),
        id: item.id,
        nome: item.getAttribute("name") ?? "",
        tipo: item.type ?? "",
        acao: (/acao=([^&]+)/.exec(href) ?? [])[1] ?? "",
        texto: (item.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
        titulo: (item.title || item.getAttribute("aria-label") || "").slice(0, 80),
        onclick: (item.getAttribute("onclick") ?? "").replace(/([?&](hash|ticket|key)=)[^&'"]+/gi, "$1…").slice(0, 120),
        visivel: item.offsetParent !== null,
      };
    })
  );
}
