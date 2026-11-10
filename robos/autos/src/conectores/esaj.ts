import { open, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BrowserContext, Download, Page } from "playwright";
import type { Pedido } from "../fila.ts";
import { ESAJ_TJSP, comecaComoPdf, ehPaginaDeLogin, escolherCertificado, lerCnj, urlDaConsulta, urlDeLogin, type NumeroCnj } from "./esaj-urls.ts";
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
    numero: "#numeroProcesso",
    pasta: "#linkPasta",
    semResultado: "#mensagemRetorno",
    incidentes: "#modalIncidentes",
    escolherIncidente: "#botaoEnviarIncidente",
    lista: "a.linkProcesso",
    etiquetas: ".unj-tag, [id*='egredo']",
  },
  pasta: {
    selecionarTodos: ["#selecionarButton", "input[value*='elecionar todos' i]", "button:has-text('Selecionar todos')"],
    pedirPdf: ["#salvarButton", "input[value*='Baixar PDF' i]", "button:has-text('Baixar PDF')", "input[value*='ersão para impressão' i]"],
    arquivoUnico: ["#opcao1", "input[type=radio][value='1']", "label:has-text('Arquivo único')"],
    continuar: ["#botaoContinuar", "input[value='Continuar' i]", "button:has-text('Continuar')"],
    baixar: ["#btnDownloadDocumento", "input[value*='Salvar o documento' i]", "button:has-text('Salvar o documento')"],
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

/** Espera o download começar em qualquer aba (o PDF pode abrir na pasta digital ou numa aba nova). */
function esperarDownload(contexto: BrowserContext, limiteMs: number): { promessa: Promise<Download>; parar: () => void } {
  let parar = () => {};
  const promessa = new Promise<Download>((resolver, rejeitar) => {
    const paginas = new Set<Page>();
    const aoBaixar = (download: Download) => {
      parar();
      resolver(download);
    };
    const ouvir = (pagina: Page) => {
      paginas.add(pagina);
      pagina.on("download", aoBaixar);
    };
    const relogio = setTimeout(() => {
      parar();
      rejeitar(new FalhaDoConector("O tribunal não entregou o PDF dentro do tempo de espera."));
    }, limiteMs);
    parar = () => {
      clearTimeout(relogio);
      contexto.off("page", ouvir);
      for (const pagina of paginas) pagina.off("download", aoBaixar);
    };
    contexto.pages().forEach(ouvir);
    contexto.on("page", ouvir);
  });
  return { promessa, parar };
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
    const dentro = async () => !ehPaginaDeLogin(pagina.url());
    if (await dentro()) return;

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
    await pagina.waitForURL((url) => !ehPaginaDeLogin(url.toString()), { timeout: 20_000 }).catch(() => undefined);
    if (await dentro()) {
      registrar("Login concluído.");
      return;
    }
    if (await visivel(pagina, TELA.login.codigoDeVerificacao)) {
      await ambiente.aguardarPessoa("segundo_fator", "O e-SAJ pediu o código de verificação (segundo fator). O advogado informa o código na janela do robô.", dentro);
    } else if (await temCaptcha(pagina)) {
      await ambiente.aguardarPessoa("captcha", "O e-SAJ mostrou um CAPTCHA. Resolva o desafio e conclua o login na janela do robô.", dentro);
    } else {
      await ambiente.aguardarPessoa("login", "Conclua o login do e-SAJ na janela do robô (certificado ou CPF e senha). O robô segue sozinho depois.", dentro);
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
    // 1º grau: lista com o principal e os incidentes. Só segue se houver um único com o número exato.
    if (!(await pagina.locator(TELA.processo.numero).count())) {
      const iguais = pagina.locator(TELA.processo.lista).filter({ hasText: cnj.mascarado });
      if ((await iguais.count()) === 1) {
        await iguais.first().click();
        await pagina.waitForLoadState("domcontentloaded");
      }
    }

    const numero = await pagina.locator(TELA.processo.numero).first().textContent({ timeout: 10_000 }).catch(() => null);
    if (numero?.includes(cnj.mascarado)) return;

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
    const { contexto, config, registrar } = ambiente;
    if (await temCaptcha(pasta)) {
      await ambiente.aguardarPessoa("captcha", "A pasta digital mostrou um CAPTCHA. Resolva o desafio na janela do robô.", async () => !(await temCaptcha(pasta)));
    }
    await clicar(ambiente, pasta, TELA.pasta.selecionarTodos, "selecionar todos os documentos da pasta digital", 60_000);
    await clicar(ambiente, pasta, TELA.pasta.pedirPdf, "pedir o PDF dos autos");
    await clicar(ambiente, pasta, TELA.pasta.arquivoUnico, "escolher o PDF em arquivo único");
    const download = esperarDownload(contexto, config.geracaoPdfMs);
    try {
      let arquivo: Download | null = null;
      download.promessa.then(
        (baixado) => {
          arquivo = baixado;
        },
        () => undefined
      );
      await clicar(ambiente, pasta, TELA.pasta.continuar, "confirmar a geração do PDF");
      registrar("O tribunal está montando o PDF dos autos (pode levar alguns minutos).");
      // Quando o arquivo fica pronto, o e-SAJ mostra o botão de salvar; em alguns casos o download começa sozinho.
      const inicio = Date.now();
      let clicou = false;
      while (!arquivo && Date.now() - inicio < config.geracaoPdfMs) {
        if (!clicou) {
          for (const seletor of TELA.pasta.baixar) {
            const botao = pasta.locator(seletor).first();
            if (await botao.isVisible().catch(() => false)) {
              await botao.click();
              clicou = true;
              break;
            }
          }
        }
        await pasta.waitForTimeout(1_000);
      }
      const baixado: Download = arquivo ?? (await download.promessa);
      const falha = await baixado.failure();
      if (falha) throw new FalhaDoConector(`O download do PDF foi interrompido (${falha}).`);
      await baixado.saveAs(destino);
    } catch (erro) {
      if (erro instanceof FalhaDoConector) throw erro;
      const captura = await ambiente.diagnostico(pasta, "baixar o PDF");
      throw new FalhaDoConector(`O download dos autos falhou na pasta digital. Diagnóstico guardado em ${captura}.`);
    } finally {
      download.parar();
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
