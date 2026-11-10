import { open, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import type { Pedido } from "../fila.ts";
import { ESAJ_TJSP, comecaComoPdf, ehPaginaDeLogin, ehPaginaDoProcesso, escolherCertificado, lerCnj, urlDaConsulta, urlDeLogin, type NumeroCnj } from "./esaj-urls.ts";
import { FalhaDoConector, SegredoDeJustica, type Ambiente, type Conector } from "./tipos.ts";

/**
 * Conector do e-SAJ (Softplan). Primeiro tribunal: TJSP.
 *
 * O caminho é o de um advogado no portal: entra, consulta o processo pelo número, abre "Visualizar autos"
 * (pasta digital), marca todos os documentos e pede o PDF em arquivo único.
 *
 * O que o conector NÃO faz, por decisão do escritório:
 * - não contorna segundo fator nem CAPTCHA: para, avisa e espera a pessoa;
 * - não baixa processo em segredo de justiça sem a liberação registrada no pedido;
 * - não tenta senha de processo: se o advogado não tem acesso aos autos, o pedido volta com erro.
 */

const TAMANHO_MAXIMO = 200 * 1024 * 1024;

const TELA = {
  login: {
    abaCertificado: "#linkAbaCertificado",
    certificados: "#certificados",
    entrarComCertificado: "#submitCertificado",
    semWebSigner: "#webSignerNaoInstalado, #webSignerNaoSuportado",
    abaCpf: "#linkAbaCpf",
    usuario: "#usernameForm",
    senha: "#passwordForm",
    entrar: "#pbEntrar",
    codigoDeVerificacao: "#modalTokenDuploFator",
  },
  processo: {
    cabecalho: "#numeroProcesso, #containerDadosPrincipaisProcesso",
    pasta: "#linkPasta",
    semResultado: "#mensagemRetorno",
    incidentes: "#modalIncidentes",
    escolherIncidente: "#botaoEnviarIncidente",
    lista: "a.linkProcesso",
    etiquetas: ".unj-tag, [id*='egredo']",
  },
  pasta: {
    selecionarTodos: ["#selecionarButton", "input[aria-label='Selecionar todas']"],
    /** Documentos marcados na árvore da pasta digital. */
    marcados: ".jstree-checked",
    pedirPdf: ["#salvarButton", "input[aria-label='Versão para impressão']"],
    arquivoUnico: "#opcao1",
    continuar: ["#botaoContinuar"],
    // Só este: enquanto o PDF é montado há outro botão "Salvar o documento", desabilitado (#btnAguardarProcessamento).
    baixar: "#btnDownloadDocumento",
  },
} as const;

/** Desafio visível na tela (reCAPTCHA, hCaptcha, Turnstile ou imagem). O robô só detecta: quem resolve é a pessoa. */
async function temCaptcha(pagina: Page): Promise<boolean> {
  const desafio = pagina.locator(
    "iframe[src*='recaptcha'][src*='bframe'], iframe[src*='recaptcha'][src*='anchor'], iframe[src*='hcaptcha'], iframe[src*='challenges.cloudflare'], img[src*='captcha' i], input[name*='captcha' i]:not([type=hidden])"
  );
  const total = await desafio.count().catch(() => 0);
  for (let i = 0; i < total; i += 1) {
    if (await desafio.nth(i).isVisible().catch(() => false)) return true;
  }
  return false;
}

async function visivel(pagina: Page, seletor: string): Promise<boolean> {
  return pagina.locator(seletor).first().isVisible().catch(() => false);
}

/** Clica no primeiro candidato que existir na tela; sem nenhum, guarda o diagnóstico e explica em que etapa parou. */
async function clicar(ambiente: Ambiente, pagina: Page, candidatos: readonly string[], etapa: string, espera = 20_000): Promise<void> {
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
  throw new FalhaDoConector(`A tela do e-SAJ mudou ou não carregou: não achei como ${etapa}. Diagnóstico guardado em ${captura}.`);
}

async function conferirPdf(arquivo: string): Promise<void> {
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

/**
 * Há sessão aberta no e-SAJ? Não basta a página ter saído do login (a pessoa pode ter ido instalar a
 * extensão, por exemplo), e nem toda página do portal mostra o nome do usuário: vale o cookie de sessão
 * do login central (CAS), que só existe depois de o tribunal aceitar o login.
 */
async function sessaoAberta(pagina: Page, base: string): Promise<boolean> {
  if (ehPaginaDeLogin(pagina.url())) return false;
  const cookies = await pagina.context().cookies(base).catch(() => []);
  return cookies.some((cookie) => cookie.name === "CASTGC" && cookie.value.length > 0);
}

class ConectorEsaj implements Conector {
  constructor(
    readonly chave: string,
    private readonly base: string,
    private readonly tribunal: string
  ) {}

  /* ------------------------------------------------------------------ login */

  private async iniciarComCertificado(ambiente: Ambiente): Promise<void> {
    const { pagina, config, registrar } = ambiente;
    await pagina.locator(TELA.login.abaCertificado).click();
    if (await visivel(pagina, TELA.login.semWebSigner)) {
      registrar("O e-SAJ não encontrou o Web Signer neste navegador. Instale a extensão Web Signer nesta janela (o próprio e-SAJ oferece o botão) e recarregue a página.");
      return;
    }
    // O Web Signer preenche a lista de certificados alguns segundos depois de a aba abrir.
    await pagina.waitForFunction((seletor) => (document.querySelector(seletor) as HTMLSelectElement | null)?.options.length, TELA.login.certificados, { timeout: 30_000 }).catch(() => undefined);
    const opcoes = await pagina.locator(`${TELA.login.certificados} option`).allTextContents();
    const escolhido = escolherCertificado(opcoes, config.esaj.certificado);
    if (escolhido < 0) {
      registrar(opcoes.length ? "Há mais de um certificado na lista (ou nenhum com o nome de ESAJ_CERTIFICADO): escolha o certificado na janela e clique em Entrar." : "A lista de certificados veio vazia: confira o Web Signer e o certificado nesta máquina.");
      return;
    }
    await pagina.locator(TELA.login.certificados).selectOption({ index: escolhido });
    const entrar = pagina.locator(TELA.login.entrarComCertificado);
    await entrar.waitFor({ state: "visible", timeout: 10_000 });
    await pagina.waitForFunction((seletor) => !(document.querySelector(seletor) as HTMLInputElement | null)?.disabled, TELA.login.entrarComCertificado, { timeout: 10_000 }).catch(() => undefined);
    await entrar.click();
    registrar("Certificado escolhido. Se o sistema pedir permissão para usar a chave do certificado, autorize na janela.");
  }

  private async iniciarComSenha(ambiente: Ambiente): Promise<void> {
    const { pagina, config } = ambiente;
    try {
      if (await visivel(pagina, TELA.login.abaCpf)) await pagina.locator(TELA.login.abaCpf).click();
      await pagina.locator(TELA.login.usuario).fill(config.esaj.usuario);
      await pagina.locator(TELA.login.senha).fill(config.esaj.senha);
      await pagina.locator(TELA.login.entrar).click();
    } catch {
      // A mensagem original do Playwright pode citar o que foi digitado: não vai para log nem para a ficha.
      throw new FalhaDoConector("Não consegui preencher o login do e-SAJ (a tela mudou?). Faça o login na janela do robô.");
    }
  }

  async entrar(ambiente: Ambiente): Promise<void> {
    const { pagina, config, registrar } = ambiente;
    await pagina.goto(urlDeLogin(this.base), { waitUntil: "domcontentloaded" });
    await pagina.waitForLoadState("load").catch(() => undefined);
    const dentro = () => sessaoAberta(pagina, this.base);
    if (await dentro()) return;
    // Com a sessão válida o tribunal redireciona para o portal; se ficou no login (ou em outro lugar), volta a ele.
    if (!ehPaginaDeLogin(pagina.url())) await pagina.goto(urlDeLogin(this.base), { waitUntil: "domcontentloaded" });

    registrar(`Sessão do e-SAJ do ${this.tribunal} fechada: iniciando o login (${config.esaj.login}).`);
    if (await temCaptcha(pagina)) {
      await ambiente.aguardarPessoa("captcha", "O e-SAJ mostrou um CAPTCHA no login. Resolva o desafio e conclua o login na janela do robô.", dentro);
      return;
    }
    try {
      if (config.esaj.login === "certificado") await this.iniciarComCertificado(ambiente);
      else if (config.esaj.login === "senha") await this.iniciarComSenha(ambiente);
    } catch (erro) {
      registrar(erro instanceof FalhaDoConector ? erro.message : "Não consegui iniciar o login sozinho; fica com a pessoa.");
    }
    // Dá tempo de o tribunal responder antes de chamar alguém.
    if (config.esaj.login !== "manual") await pagina.waitForURL((url) => !ehPaginaDeLogin(url.toString()), { timeout: 20_000 }).catch(() => undefined);
    if (await dentro()) {
      registrar("Login concluído.");
      return;
    }
    if (await visivel(pagina, TELA.login.codigoDeVerificacao)) {
      await ambiente.aguardarPessoa("segundo_fator", "O e-SAJ pediu o código de verificação (segundo fator). O advogado informa o código na janela do robô.", dentro);
    } else if (await temCaptcha(pagina)) {
      await ambiente.aguardarPessoa("captcha", "O e-SAJ mostrou um CAPTCHA. Resolva o desafio e conclua o login na janela do robô.", dentro);
    } else {
      await ambiente.aguardarPessoa(
        "login",
        "Conclua o login do e-SAJ na janela do robô (certificado ou CPF e senha). Se o e-SAJ pedir, instale a extensão Web Signer nessa janela e volte à página de login. O robô segue sozinho depois.",
        dentro
      );
    }
    registrar("Login concluído.");
  }

  /* --------------------------------------------------------------- consulta */

  private async abrirProcesso(ambiente: Ambiente, cnj: NumeroCnj): Promise<void> {
    const { pagina } = ambiente;
    const consulta = urlDaConsulta(this.base, cnj);
    await pagina.goto(consulta, { waitUntil: "domcontentloaded" });
    if (ehPaginaDeLogin(pagina.url())) {
      await this.entrar(ambiente);
      await pagina.goto(consulta, { waitUntil: "domcontentloaded" });
    }
    if (await temCaptcha(pagina)) {
      await ambiente.aguardarPessoa("captcha", "A consulta do e-SAJ mostrou um CAPTCHA. Resolva o desafio na janela do robô.", async () => !(await temCaptcha(pagina)));
    }

    // 2º grau: quando o número tem incidentes, o e-SAJ pergunta qual abrir. O primeiro é o processo principal.
    if (await visivel(pagina, TELA.processo.incidentes)) {
      await pagina.locator(`${TELA.processo.incidentes} input[type=radio]`).first().check();
      await pagina.locator(TELA.processo.escolherIncidente).click();
      await pagina.waitForLoadState("domcontentloaded");
    }
    const chegou = async () => ehPaginaDoProcesso(pagina.url(), (await pagina.locator(TELA.processo.cabecalho).allTextContents().catch(() => [])).join(" "), cnj);
    // 1º grau: lista com o principal e os incidentes. Só segue se houver um único com o número exato.
    if (!(await chegou())) {
      const iguais = pagina.locator(TELA.processo.lista).filter({ hasText: cnj.mascarado });
      if ((await iguais.count()) === 1) {
        await iguais.first().click();
        await pagina.waitForLoadState("domcontentloaded");
      }
    }
    if (await chegou()) return;

    const aviso = (await pagina.locator(TELA.processo.semResultado).first().textContent().catch(() => null))?.replace(/\s+/g, " ").trim();
    if (aviso) {
      throw new FalhaDoConector(`O e-SAJ do ${this.tribunal} não mostrou o processo ${cnj.mascarado}: "${aviso.slice(0, 200)}". Pode ser número de outro sistema (eproc), processo em segredo de justiça sem acesso do advogado, ou mais de um processo com o mesmo número.`);
    }
    const captura = await ambiente.diagnostico(pagina, "consulta");
    throw new FalhaDoConector(`Não reconheci a página de consulta do e-SAJ para o processo ${cnj.mascarado}. Diagnóstico guardado em ${captura}.`);
  }

  private async emSegredo(pagina: Page): Promise<boolean> {
    return (await pagina.locator(TELA.processo.etiquetas).filter({ hasText: /segredo\s+de\s+justi[çc]a/i }).count()) > 0;
  }

  private async abrirPasta(ambiente: Ambiente): Promise<{ pasta: Page; novaJanela: boolean }> {
    const { pagina, contexto } = ambiente;
    const link = pagina.locator(TELA.processo.pasta).first();
    if (!(await link.count())) throw new FalhaDoConector("O processo não tem pasta digital no e-SAJ (processo físico ou sem autos disponíveis).");
    const destino = (await link.getAttribute("href")) ?? "";
    if (/senha/i.test(destino)) {
      if (!(await sessaoAberta(pagina, this.base))) throw new FalhaDoConector("A sessão do e-SAJ caiu no meio do pedido. O robô faz o login de novo na próxima tentativa.");
      throw new FalhaDoConector("O e-SAJ pede a senha do processo para abrir os autos: o advogado do certificado não está habilitado neste processo. Anexe o PDF à mão.");
    }
    const janela = contexto.waitForEvent("page", { timeout: 25_000 }).catch(() => null);
    await link.click();
    const nova = await janela;
    const pasta = nova ?? pagina;
    await pasta.waitForURL(/pastadigital/i, { timeout: 60_000 }).catch(async () => {
      const captura = await ambiente.diagnostico(pasta, "abrir a pasta digital");
      throw new FalhaDoConector(`A pasta digital não abriu. Diagnóstico guardado em ${captura}.`);
    });
    await pasta.waitForLoadState("load").catch(() => undefined);
    return { pasta, novaJanela: Boolean(nova) };
  }

  /* --------------------------------------------------------------- download */

  private async baixarDaPasta(ambiente: Ambiente, pasta: Page, destino: string): Promise<void> {
    const { config, registrar } = ambiente;
    if (await temCaptcha(pasta)) {
      await ambiente.aguardarPessoa("captcha", "A pasta digital mostrou um CAPTCHA. Resolva o desafio na janela do robô.", async () => !(await temCaptcha(pasta)));
    }
    try {
      // Cada etapa espera a tela reagir à anterior: clicar em sequência, sem esperar, deixa a pasta digital no meio do caminho.
      await clicar(ambiente, pasta, TELA.pasta.selecionarTodos, "selecionar todos os documentos da pasta digital", 60_000);
      await pasta.locator(TELA.pasta.marcados).first().waitFor({ state: "attached", timeout: 30_000 });
      await pasta.waitForTimeout(1_000);
      await clicar(ambiente, pasta, TELA.pasta.pedirPdf, "pedir o PDF dos autos");
      const continuar = pasta.locator(TELA.pasta.continuar[0]);
      await continuar.waitFor({ state: "visible", timeout: 30_000 });
      await pasta.locator(TELA.pasta.arquivoUnico).check();
      await pasta.waitForTimeout(500);
      await continuar.click();
      registrar("O tribunal está montando o PDF dos autos (pode levar alguns minutos).");
      const baixar = pasta.locator(TELA.pasta.baixar);
      await baixar.waitFor({ state: "visible", timeout: config.geracaoPdfMs });
      await pasta.waitForTimeout(500);
      // O e-SAJ devolve o PDF como anexo na própria pasta digital.
      const [arquivo] = await Promise.all([pasta.waitForEvent("download", { timeout: 120_000 }), baixar.click()]);
      const falha = await arquivo.failure();
      if (falha) throw new FalhaDoConector(`O download do PDF foi interrompido (${falha}).`);
      await arquivo.saveAs(destino);
    } catch (erro) {
      if (erro instanceof FalhaDoConector) throw erro;
      const captura = await ambiente.diagnostico(pasta, "baixar o PDF");
      throw new FalhaDoConector(`O download dos autos não terminou na pasta digital. Diagnóstico guardado em ${captura}.`);
    }
    await conferirPdf(destino);
  }

  async baixar(ambiente: Ambiente, pedido: Pedido, destino: string): Promise<void> {
    const cnj = lerCnj(pedido.cnj);
    if (!cnj) throw new FalhaDoConector(`Número de processo inválido: ${pedido.cnj}.`);
    await this.entrar(ambiente);
    await this.abrirProcesso(ambiente, cnj);
    if ((await this.emSegredo(ambiente.pagina)) && !pedido.segredoLiberado) throw new SegredoDeJustica();
    const { pasta, novaJanela } = await this.abrirPasta(ambiente);
    try {
      await this.baixarDaPasta(ambiente, pasta, destino);
    } finally {
      if (novaJanela) await pasta.close().catch(() => undefined);
    }
  }

  /** Abre o processo e a pasta digital e descreve os controles da tela, sem pedir o PDF. Serve para ajustar o conector. */
  async inspecionar(ambiente: Ambiente, numero: string): Promise<void> {
    const { registrar, config } = ambiente;
    const cnj = lerCnj(numero);
    if (!cnj) throw new FalhaDoConector(`Número de processo inválido: ${numero}.`);
    await this.entrar(ambiente);
    await this.abrirProcesso(ambiente, cnj);
    registrar(`Processo aberto. Segredo de justiça: ${(await this.emSegredo(ambiente.pagina)) ? "sim" : "não"}.`);
    registrar(`Página do processo: ${await ambiente.diagnostico(ambiente.pagina, "inspecao-processo")}`);
    const { pasta, novaJanela } = await this.abrirPasta(ambiente);
    try {
      await pasta.waitForTimeout(5_000);
      const controles = await pasta.evaluate(() =>
        [...document.querySelectorAll("button, input[type=button], input[type=submit], input[type=radio], input[type=checkbox], a[id]")].slice(0, 200).map((elemento) => {
          const item = elemento as HTMLInputElement;
          return { tag: item.tagName.toLowerCase(), id: item.id, tipo: item.type ?? "", valor: (item.value ?? "").slice(0, 60), texto: (item.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60), titulo: item.title ?? "", visivel: item.offsetParent !== null };
        })
      );
      const relatorio = join(config.pastas.diagnostico, "inspecao-pasta-controles.json");
      await writeFile(relatorio, JSON.stringify({ url: pasta.url().replace(/([?&]ticket=)[^&]+/i, "$1…"), quadros: pasta.frames().length, controles }, null, 2));
      registrar(`Pasta digital aberta. Controles da tela em ${relatorio}`);
      registrar(`Pasta digital: ${await ambiente.diagnostico(pasta, "inspecao-pasta")}`);
    } finally {
      if (novaJanela) await pasta.close().catch(() => undefined);
    }
  }
}

export const esajTjsp: Conector = new ConectorEsaj("esaj:TJSP", ESAJ_TJSP, "TJSP");
