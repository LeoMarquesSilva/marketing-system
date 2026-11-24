import { describe, expect, it } from "vitest";
import { escolherPerfilNaTela } from "./eproc";

// Imita a "Seleção de perfil" do eproc depois do 2FA: o mesmo texto escondido no menu antes do título, e a lista
// de perfis numa tabela dentro do quadro. Só dados fictícios.
const TELA = `<!doctype html><html><head><title>:: eproc - Seleção de perfil ::</title></head><body>
<nav style="display:none"><a href="#">Seleção de perfil</a></nav>
<h1>Seleção de perfil</h1>
<table><tr><td><b>SP000001 / PESSOA DE TESTE / ADVOGADO</b><br>Selecione o usuário/lotação:
  <table>
    <tr><th>Sigla</th><th>Descrição</th></tr>
    <tr onclick="document.title = 'escolheu SP'"><td>SP000001</td><td>ADVOGADO</td></tr>
    <tr onclick="document.title = 'escolheu ES'"><td>ES000002</td><td>ADVOGADO</td></tr>
  </table>
</td></tr></table></body></html>`;

async function abrir() {
  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true }).catch(() => chromium.launch({ headless: true, channel: "chrome" }).catch(() => null));
}

describe("seleção de perfil do eproc", () => {
  it("reconhece a tela com o texto escondido no menu e clica na linha do perfil SP", async (ctx) => {
    const navegador = await abrir();
    if (!navegador) return ctx.skip();
    try {
      const pagina = await navegador.newPage();
      await pagina.setContent(TELA);
      expect(await escolherPerfilNaTela(pagina, "SP")).toBe(true);
      await pagina.waitForFunction(() => document.title.startsWith("escolheu"));
      expect(await pagina.title()).toBe("escolheu SP");
    } finally {
      await navegador.close();
    }
  }, 30_000);

  it("respeita outro prefixo e não age fora da tela", async (ctx) => {
    const navegador = await abrir();
    if (!navegador) return ctx.skip();
    try {
      const pagina = await navegador.newPage();
      await pagina.setContent(TELA);
      expect(await escolherPerfilNaTela(pagina, "ES")).toBe(true);
      await pagina.waitForFunction(() => document.title.startsWith("escolheu"));
      expect(await pagina.title()).toBe("escolheu ES");
      await pagina.setContent("<title>eproc</title><h1>Painel do advogado</h1><table><tr><td>SP000001</td><td>ADVOGADO</td></tr></table>");
      expect(await escolherPerfilNaTela(pagina, "SP")).toBe(false);
    } finally {
      await navegador.close();
    }
  }, 30_000);
});
