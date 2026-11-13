import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import type { Pedido } from "../fila.ts";
import { clicar, conferirPdf, temCaptcha, visivel } from "./comum.ts";
import { TRIBUNAIS_ESAJ, ehPaginaDeLogin, ehPaginaDoProcesso, escolherCertificado, lerCnj, urlDaConsulta, urlDeLogin, type NumeroCnj, type TribunalEsaj } from "./esaj-urls.ts";
import { FalhaDoConector, SegredoDeJustica, type Ambiente, type Conector } from "./tipos.ts";

/**
 * Conector do e-SAJ (Softplan), um por tribunal: TJSP, TJCE, TJAL e TJMS (ver TRIBUNAIS_ESAJ). O login é
 * por tribunal: cada um tem a própria sessão, e o robô entra em cada um na primeira vez que precisar.
 *
 * O caminho é o de um advogado no portal: entra, consulta o processo pelo número, abre "Visualizar autos"
 * (pasta digital), marca todos os documentos e pede o PDF em arquivo único.
 *
 * O que o conector NÃO faz, por decisão do escritório:
 * - não contorna segundo fator nem CAPTCHA: para, avisa e espera a pessoa;
 * - não baixa processo em segredo de justiça sem a liberação registrada no pedido;
 * - não tenta senha de processo: se o advogado não tem acesso aos autos, o pedido volta com erro.
 */

const TELA = {
  login: {
    abaCertificado: "#linkAbaCertificado",
    certificados: "#certificados",
    recarregarCertificados: "#certificadosRecarregar",
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
    // 1º grau: #linkPasta, com o endereço da pasta no href. 2º grau (cposg): #pbVisualizarAutos, com href "#"; um
    // script confere o acesso e abre a pasta em outra janela.
    pasta: "#linkPasta, #pbVisualizarAutos, a.linkPasta",
    // 2º grau, advogado sem habilitação: em vez da pasta, o e-SAJ abre o pedido da senha do processo.
    pedeSenha: "#popupSenhaProcesso, #senhaProcesso",
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
  readonly chave: string;
  private readonly base: string;
  private readonly tribunal: string;

  constructor(private readonly esaj: TribunalEsaj) {
    this.chave = `esaj:${esaj.sigla}`;
    this.base = esaj.base;
    this.tribunal = esaj.sigla;
  }

  /* ------------------------------------------------------------------ login */

  /**
   * Se o certificado de ESAJ_CERTIFICADO já está na lista do Web Signer, escolhe e clica em Entrar.
   * Devolve quantos certificados a lista mostra e se clicou. Opção sem valor é aviso ("Carregando…",
   * "Selecione…") e fica vazia para não ser escolhida, mantendo o índice.
   */
  private async escolherNaLista(ambiente: Ambiente): Promise<{ certificados: number; clicou: boolean }> {
    const { pagina, config } = ambiente;
    const lidas = await pagina
      .locator(`${TELA.login.certificados} option`)
      .evaluateAll((itens) => itens.map((item) => ({ texto: item.textContent ?? "", valor: (item as HTMLOptionElement).value })))
      .catch(() => [] as { texto: string; valor: string }[]);
    const opcoes = lidas.map((item) => (item.valor ? item.texto : ""));
    const certificados = opcoes.filter(Boolean).length;
    const escolhido = escolherCertificado(opcoes, config.esaj.certificado);
    if (escolhido < 0) return { certificados, clicou: false };
    await pagina.locator(TELA.login.certificados).selectOption({ index: escolhido });
    const entrar = pagina.locator(TELA.login.entrarComCertificado);
    await entrar.waitFor({ state: "visible", timeout: 10_000 });
    await pagina.waitForFunction((seletor) => !(document.querySelector(seletor) as HTMLInputElement | null)?.disabled, TELA.login.entrarComCertificado, { timeout: 10_000 }).catch(() => undefined);
    await entrar.click();
    return { certificados, clicou: true };
  }

  private async iniciarComCertificado(ambiente: Ambiente): Promise<void> {
    const { pagina, registrar } = ambiente;
    await pagina.locator(TELA.login.abaCertificado).click();
    if (await visivel(pagina, TELA.login.semWebSigner)) {
      registrar("O e-SAJ não encontrou o Web Signer neste navegador. Instale a extensão Web Signer nesta janela (o próprio e-SAJ oferece o botão) e recarregue a página.");
      return;
    }
    // O Web Signer preenche a lista alguns segundos depois de a aba abrir; na primeira vez num tribunal
    // pode levar quase um minuto (ou pedir para autorizar o site). Espera o certificado aparecer e pede a
    // lista de novo uma vez, se demorar.
    let resultado = { certificados: 0, clicou: false };
    let recarregou = false;
    const inicio = Date.now();
    while (Date.now() - inicio < 60_000) {
      resultado = await this.escolherNaLista(ambiente);
      if (resultado.clicou) {
        registrar("Certificado escolhido. Se o sistema pedir permissão para usar a chave do certificado, autorize na janela.");
        return;
      }
      if (!recarregou && Date.now() - inicio > 20_000 && (await visivel(pagina, TELA.login.recarregarCertificados))) {
        await pagina.locator(TELA.login.recarregarCertificados).click();
        recarregou = true;
      }
      await pagina.waitForTimeout(1_000);
    }
    registrar(
      resultado.certificados
        ? `O Web Signer mostrou ${resultado.certificados} certificado${resultado.certificados === 1 ? "" : "s"}, nenhum (ou mais de um) com o nome de ESAJ_CERTIFICADO: escolha o certificado na janela e clique em Entrar.`
        : "A lista de certificados ainda está vazia: se o Web Signer pedir para autorizar o site, autorize na janela. O robô escolhe o certificado assim que ele aparecer."
    );
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
      // No modo certificado o robô segue tentando enquanto espera: se a pessoa só autorizar o Web Signer
      // no site, ele mesmo escolhe o certificado quando a lista aparecer (no máximo uma vez a cada 15 s).
      let ultimaTentativa = Date.now();
      const resolvido = async () => {
        if (await dentro()) return true;
        if (config.esaj.login === "certificado" && ehPaginaDeLogin(pagina.url()) && Date.now() - ultimaTentativa > 15_000) {
          ultimaTentativa = Date.now();
          const { clicou } = await this.escolherNaLista(ambiente).catch(() => ({ certificados: 0, clicou: false }));
          if (clicou) registrar("O certificado apareceu na lista: escolhido.");
        }
        return false;
      };
      await ambiente.aguardarPessoa(
        "login",
        "Conclua o login do e-SAJ na janela do robô (certificado ou CPF e senha). Se o Web Signer pedir para autorizar o site, autorize; se o e-SAJ pedir a extensão, instale nessa janela e volte à página de login. O robô segue sozinho depois.",
        resolvido
      );
    }
    registrar("Login concluído.");
  }

  /* --------------------------------------------------------------- consulta */

  private async abrirProcesso(ambiente: Ambiente, cnj: NumeroCnj): Promise<void> {
    const { pagina } = ambiente;
    const consulta = urlDaConsulta(this.esaj, cnj);
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
    const semAcesso = "O e-SAJ pede a senha do processo para abrir os autos: o advogado do certificado não está habilitado neste processo. Anexe o PDF à mão.";
    const destino = (await link.getAttribute("href")) ?? "";
    if (/senha/i.test(destino)) {
      if (!(await sessaoAberta(pagina, this.base))) throw new FalhaDoConector("A sessão do e-SAJ caiu no meio do pedido. O robô faz o login de novo na próxima tentativa.");
      throw new FalhaDoConector(semAcesso);
    }
    const janela = contexto.waitForEvent("page", { timeout: 25_000 }).catch(() => null);
    await link.click();
    // No 2º grau a resposta ao clique é a janela da pasta ou o pedido de senha: vale o que aparecer primeiro.
    const pediuSenha = pagina
      .locator(TELA.processo.pedeSenha)
      .first()
      .waitFor({ state: "visible", timeout: 25_000 })
      .then(
        () => true,
        () => false
      );
    const primeiro = await Promise.race([janela.then((aberta) => (aberta ? "janela" : "nada")), pediuSenha.then((pediu) => (pediu ? "senha" : "nada"))]);
    if (primeiro === "senha") throw new FalhaDoConector(semAcesso);
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
      await clicar(ambiente, pasta, TELA.pasta.selecionarTodos, "selecionar todos os documentos da pasta digital", "e-SAJ", 60_000);
      await pasta.locator(TELA.pasta.marcados).first().waitFor({ state: "attached", timeout: 30_000 });
      await pasta.waitForTimeout(1_000);
      await clicar(ambiente, pasta, TELA.pasta.pedirPdf, "pedir o PDF dos autos", "e-SAJ");
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

/** Um conector por tribunal do e-SAJ, na ordem de TRIBUNAIS_ESAJ. */
export const conectoresEsaj: Conector[] = TRIBUNAIS_ESAJ.map((tribunal) => new ConectorEsaj(tribunal));
