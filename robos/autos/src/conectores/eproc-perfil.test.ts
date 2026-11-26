import { describe, expect, it } from "vitest";
import { escolherPerfilNaTela } from "./eproc";

// Imita a "Seleção de perfil" do eproc do TJSP depois do 2FA (24/11/2026): o texto escondido no menu antes do título
// e cada perfil como um botão da lista #tblPerfis, com data-descricao e onclick, sem tabela. Só dados fictícios.
const TELA_TJSP = `<!doctype html><html><head><title>:: eproc - Seleção de perfil ::</title></head><body>
<nav style="display:none"><a href="#">Seleção de perfil</a></nav>
<h1>Seleção de perfil</h1>
<form id="frmEscolherUsuario"><div class="mt-2">SP000001 / PESSOA DE TESTE / ADVOGADO</div>
<a href="#" onclick="document.title = 'padrão'; return false;">Definir usuário padrão</a>
<fieldset><div id="tblPerfis" class="list-group">
  <div class="list-group-item"><div>Sigla</div><div>Descrição</div></div>
  <button type="button" id="tr0" class="list-group-item" onclick="document.title = 'escolheu SP'" data-descricao="SP000001 / ADVOGADO">
    <div>SP000001</div><div>ADVOGADO</div><div class="d-none" style="display:none">padrão</div></button>
  <button type="button" id="tr1" class="list-group-item" onclick="document.title = 'escolheu ES'" data-descricao="ES000002 / ADVOGADO">
    <div>ES000002</div><div>ADVOGADO</div></button>
</div></fieldset></form></body></html>`;

// Outra forma possível: tabela dentro de tabela (a linha de fora traz o texto todo).
const TELA_TABELA = `<!doctype html><html><head><title>:: eproc - Seleção de perfil ::</title></head><body>
<table><tr><td><b>SP000001 / PESSOA DE TESTE / ADVOGADO</b>
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

async function escolher(html: string, prefixo: string) {
  const navegador = await abrir();
  if (!navegador) return null;
  try {
    const pagina = await navegador.newPage();
    await pagina.setContent(html);
    const escolha = await escolherPerfilNaTela(pagina, prefixo);
    if (escolha === "escolhido") await pagina.waitForFunction(() => document.title.startsWith("escolheu"), undefined, { timeout: 5_000 }).catch(() => undefined);
    return { escolha, titulo: await pagina.title() };
  } finally {
    await navegador.close();
  }
}

describe("seleção de perfil do eproc", () => {
  it("TJSP: clica no botão do perfil SP da lista", async (ctx) => {
    const resultado = await escolher(TELA_TJSP, "SP");
    if (!resultado) return ctx.skip();
    expect(resultado).toEqual({ escolha: "escolhido", titulo: "escolheu SP" });
  }, 30_000);

  it("TJSP: respeita outro prefixo", async (ctx) => {
    const resultado = await escolher(TELA_TJSP, "ES");
    if (!resultado) return ctx.skip();
    expect(resultado).toEqual({ escolha: "escolhido", titulo: "escolheu ES" });
  }, 30_000);

  it("tabela dentro de tabela: a linha de dentro", async (ctx) => {
    const resultado = await escolher(TELA_TABELA, "SP");
    if (!resultado) return ctx.skip();
    expect(resultado).toEqual({ escolha: "escolhido", titulo: "escolheu SP" });
  }, 30_000);

  it("fora da tela não age; na tela sem o perfil, avisa", async (ctx) => {
    const fora = await escolher("<title>eproc</title><h1>Painel</h1><button data-descricao='SP000001 / ADVOGADO'>SP000001</button>", "SP");
    if (!fora) return ctx.skip();
    expect(fora.escolha).toBe("fora");
    const semPerfil = await escolher("<title>:: eproc - Seleção de perfil ::</title><h1>Seleção de perfil</h1><p>Nenhum perfil.</p>", "SP");
    expect(semPerfil?.escolha).toBe("sem_perfil");
  }, 30_000);
});
