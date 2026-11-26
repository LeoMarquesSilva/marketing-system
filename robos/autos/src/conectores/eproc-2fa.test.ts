import { describe, expect, it } from "vitest";
import { CODIGO_2FA_EPROC } from "./eproc";

// Imita a tela do código do SSO do eproc (Keycloak): menu lateral com busca antes, e o formulário do código com o
// campo, a opção "não usar o 2FA neste dispositivo" e o botão Entrar. Só dados fictícios.
const TELA_DO_SSO = `<!doctype html>
<form id="menu"><input id="busca" type="text"><button type="submit" id="buscar">Buscar</button></form>
<form id="kc-otp-login-form" onsubmit="document.title = 'enviado:' + document.querySelector('#codigo-do-app').value; return false;">
  <label for="codigo-do-app">Código gerado pelo aplicativo de autenticação em 2 fatores</label>
  <input type="hidden" name="selectedCredentialId" value="x">
  <input id="codigo-do-app" name="otp" type="text" autocomplete="off">
  <input id="lembrar" type="checkbox" name="trust">
  <input id="kc-login" type="submit" value="Entrar">
</form>`;

describe("tela do código de 2 fatores do eproc", () => {
  it("digita no campo (não no formulário) e confirma no Entrar do formulário", async (ctx) => {
    const { chromium } = await import("playwright");
    const navegador = await chromium.launch({ headless: true }).catch(() => chromium.launch({ headless: true, channel: "chrome" }).catch(() => null));
    if (!navegador) return ctx.skip();
    try {
      const pagina = await navegador.newPage();
      await pagina.setContent(TELA_DO_SSO);
      expect(await pagina.locator(CODIGO_2FA_EPROC.tela).first().isVisible()).toBe(true);
      const campo = pagina.locator(CODIGO_2FA_EPROC.campo).first();
      expect(await campo.getAttribute("id")).toBe("codigo-do-app");
      await campo.fill("123456");
      const validar = pagina.locator(CODIGO_2FA_EPROC.validar).first();
      expect(await validar.getAttribute("id")).toBe("kc-login");
      await validar.click();
      await pagina.waitForFunction(() => document.title.startsWith("enviado:"));
      expect(await pagina.title()).toBe("enviado:123456");
    } finally {
      await navegador.close();
    }
  }, 30_000);
});
