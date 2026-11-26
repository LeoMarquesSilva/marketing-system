import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as dormir } from "node:timers/promises";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Dialog, Page } from "playwright";
import type { Pedido } from "../fila.ts";
import { conferirPdf, controlesDaTela, temCaptcha, visivel } from "./comum.ts";
import {
  TRIBUNAIS_EPROC,
  arquivoEmbutido,
  ehAreaLogada,
  ehCapaDoProcesso,
  ehLoginSso,
  emSegredoPelaCapa,
  instanciasDoCnj,
  chaveDaPeca,
  mensagemDaPesquisa,
  ordenarDocumentos,
  pecasNovas,
  perfilDoEproc,
  tipoDoArquivo,
  type DocumentoEproc,
  type InstanciaEproc,
  type TipoDeArquivo,
  type TribunalEproc,
} from "./eproc-urls.ts";
import { lerCnj, type NumeroCnj } from "./esaj-urls.ts";
import { entrarComCodigoDoPainel } from "../segundo-fator.ts";
import { FalhaDoConector, SegredoDeJustica, type Ambiente, type Conector, type ResultadoDoDownload } from "./tipos.ts";

/**
 * Conector do eproc, um por tribunal (TJSP e TJRJ; instalações e SSO em `TRIBUNAIS_EPROC`, eproc-urls.ts). O
 * login é o SSO do tribunal: entrar numa instalação do eproc (no TJSP, 1º grau cível, execução fiscal e Fazenda
 * Pública, 2º grau; no TJRJ, 1º e 2º grau) vale para as outras do mesmo tribunal.
 *
 * No TJRJ, o eproc recebe o acervo migrado do DCP (sistema próprio) e do PJe com o mesmo número CNJ. O
 * ORQESTRAI manda para cá os processos do TJRJ cadastrados como "Próprio" ou PJe; o que ainda não migrou não
 * aparece na pesquisa e o pedido volta com erro explicando isso.
 *
 * O eproc não tem "baixar o processo inteiro": os autos são os documentos da tabela de eventos da capa.
 * O robô abre o processo pelo campo de pesquisa rápida, baixa cada documento com a sessão do advogado e
 * monta um PDF único, do evento mais antigo para o mais novo, com um índice na primeira página (evento,
 * documento e página onde começa). Documento que não é PDF nem imagem vira uma página de aviso.
 *
 * O que o conector NÃO faz, por decisão do escritório:
 * - não contorna segundo fator nem CAPTCHA: para, avisa e espera a pessoa;
 * - processo em segredo de justiça: desde 24/11/2026 o robô baixa sem esperar a liberação na ficha (o login é do
 *   advogado; SEGREDO_JUSTICA=esperar volta a exigir a liberação registrada no pedido);
 * - não usa "Acesso à íntegra do processo": é a declaração de interesse do advogado (Res. CNJ 121/2010), com
 *   CAPTCHA. Se o advogado não representa uma das partes, o pedido volta com erro.
 */

/**
 * Tela do código de 2 fatores. O formulário do SSO conta para reconhecer a tela, mas não é onde se digita:
 * ele vem antes do campo no HTML, e um seletor único com os dois fazia o robô "preencher" o formulário (24/11).
 */
export const CODIGO_2FA_EPROC = {
  tela: "#txtAcessoCodigo, #otp, input[name=otp], input[name=totp], #kc-otp-login-form",
  campo:
    "#txtAcessoCodigo, #otp, input[name=otp], input[name=totp], #kc-otp-login-form input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button])",
  // Tela do eproc: #btnValidar; SSO: o envio do formulário do código. Sem eles, Enter no campo.
  validar: "#btnValidar, #kc-otp-login-form [type=submit]",
} as const;

/**
 * Tela "Seleção de perfil" do eproc (advogado com mais de uma inscrição, ex.: SP e ES), depois do 2FA. O título da
 * aba é o sinal firme: o texto também aparece escondido no menu, e o primeiro achado escondido fazia o robô não
 * reconhecer a tela (24/11). No eproc do TJSP (24/11) cada perfil é um botão da lista #tblPerfis, com a sigla e o
 * tipo em data-descricao ("SP… / ADVOGADO") e o clique em acaoLogar(…), sem tabela. Reservas, para outra versão da
 * tela: linhas de tabela (só as de dentro) e, por último, o texto da sigla.
 */
export const PERFIL_EPROC = {
  titulo: /Sele[çc][ãa]o de perfil/i,
  perfis: "#tblPerfis [data-descricao], [onclick*='acaoLogar'][data-descricao]",
  linhas: "tr:has(td):not(:has(tr))",
} as const;

export type EscolhaDoPerfil = "escolhido" | "sem_perfil" | "fora";

async function naTelaDePerfil(pagina: Page): Promise<boolean> {
  if (PERFIL_EPROC.titulo.test(await pagina.title().catch(() => ""))) return true;
  for (const quadro of pagina.frames()) {
    if ((await quadro.getByText(PERFIL_EPROC.titulo).filter({ visible: true }).count().catch(() => 0)) > 0) return true;
  }
  return false;
}

/**
 * Escolhe o perfil cuja sigla começa pelo prefixo (padrão SP). Procura a tela na página do robô e nas outras abas do
 * mesmo navegador, em cada quadro (iframe). "sem_perfil": está na tela, mas nada pôde ser escolhido.
 */
export async function escolherPerfilNaTela(pagina: Page, prefixo: string): Promise<EscolhaDoPerfil> {
  const paginas = [pagina, ...pagina.context().pages().filter((outra) => outra !== pagina)];
  let viuATela = false;
  for (const aba of paginas) {
    if (!(await naTelaDePerfil(aba))) continue;
    viuATela = true;
    for (const quadro of aba.frames()) {
      const perfis = quadro.locator(PERFIL_EPROC.perfis).filter({ visible: true });
      const descricoes = await perfis.evaluateAll((itens) => itens.map((item) => item.getAttribute("data-descricao") ?? "")).catch(() => [] as string[]);
      const escolhido = perfilDoEproc(descricoes, prefixo);
      if (escolhido >= 0) {
        await perfis.nth(escolhido).click().catch(() => undefined);
        return "escolhido";
      }
    }
    for (const quadro of aba.frames()) {
      const linhas = quadro.locator(PERFIL_EPROC.linhas).filter({ visible: true });
      const indice = perfilDoEproc(await linhas.allInnerTexts().catch(() => [] as string[]), prefixo);
      if (indice >= 0) {
        const linha = linhas.nth(indice);
        const link = linha.locator("a").first();
        await ((await link.count().catch(() => 0)) ? link : linha.locator("td").first()).click().catch(() => undefined);
        return "escolhido";
      }
    }
    // Sem linhas de tabela: o texto da sigla (ex.: "SP000001"), visível, em qualquer quadro.
    const sigla = new RegExp(`^\\s*${prefixo.replace(/[^a-z]/gi, "")}\\d+\\s*$`, "i");
    for (const quadro of aba.frames()) {
      const celula = quadro.getByText(sigla).filter({ visible: true }).first();
      if (await celula.count().catch(() => 0)) {
        await celula.click().catch(() => undefined);
        return "escolhido";
      }
    }
  }
  return viuATela ? "sem_perfil" : "fora";
}

const TELA = {
  login: {
    usuario: "#username",
    senha: "#password",
    entrar: "#kc-login",
    certificado: "#kc-login-certificate",
    // Tela do código do aplicativo de autenticação: no SSO (Keycloak) ou na tela do próprio eproc, depois do certificado.
    codigo: CODIGO_2FA_EPROC.tela,
    campoCodigo: CODIGO_2FA_EPROC.campo,
    validar: CODIGO_2FA_EPROC.validar,
  },
  pesquisa: "#txtNumProcessoPesquisaRapida",
  /** Área da capa: o sigilo é lido só aqui, não no menu nem na tabela de eventos. */
  capa: "#fldCapa, #divCapaProcesso, fieldset[id*='Capa' i]",
  mensagem: "#divInfraMsg0, .infraMensagem, #divInfraExcecao, .alert-danger, .alert-warning",
  documentos: "a[href*='acao=acessar_documento']",
} as const;

const TEXTO = {
  acessoIntegra: /acesso\s+(a\s+|à\s+)?[íi]ntegra/i,
  todosEventos: /(listar|exibir|mostrar|carregar|ver)\s+todos(\s+os)?\s+eventos/i,
  arvore: /^\s*[áa]rvore\s*$/i,
};

const PAUSA_ENTRE_DOCUMENTOS_MS = 300;

/** Só caracteres que a fonte padrão do PDF escreve (Latin-1). */
function paraPdf(texto: string): string {
  return texto.replace(/[–—]/g, "-").replace(/[^\x20-\x7E -ÿ]/g, "?");
}

/** Clica no controle visível cujo texto, título ou valor casa com `padrao`. Devolve se achou. */
async function clicarPorTexto(pagina: Page, padrao: RegExp): Promise<boolean> {
  const marcado = await pagina.evaluate(
    ({ fonte, flags }) => {
      const regra = new RegExp(fonte, flags);
      const candidatos = [...document.querySelectorAll<HTMLElement>("a, button, input[type=button], input[type=submit]")];
      const alvo = candidatos.find(
        (item) => item.offsetParent !== null && [item.textContent, item.title, (item as HTMLInputElement).value, item.getAttribute("aria-label")].some((texto) => texto && regra.test(texto.trim()))
      );
      if (!alvo) return false;
      alvo.setAttribute("data-robo-alvo", "1");
      return true;
    },
    { fonte: padrao.source, flags: padrao.flags }
  );
  if (!marcado) return false;
  const alvo = pagina.locator("[data-robo-alvo='1']").first();
  await alvo.click();
  await alvo.evaluate((item) => item.removeAttribute("data-robo-alvo")).catch(() => undefined);
  return true;
}

async function existeTexto(pagina: Page, padrao: RegExp): Promise<boolean> {
  return pagina.evaluate(
    ({ fonte, flags }) => {
      const regra = new RegExp(fonte, flags);
      return [...document.querySelectorAll<HTMLElement>("a, button, input[type=button], input[type=submit]")].some(
        (item) => item.offsetParent !== null && [item.textContent, item.title, (item as HTMLInputElement).value].some((texto) => texto && regra.test(texto.trim()))
      );
    },
    { fonte: padrao.source, flags: padrao.flags }
  );
}

interface Arquivo {
  tipo: TipoDeArquivo;
  corpo: Buffer;
}

/** O certificado vem de arquivo (modo playwright), e não da lista do Chrome? */
function certificadoEmArquivo(config: Ambiente["config"]): boolean {
  return Boolean(config.certificado.pfx || config.certificado.pasta);
}

/** Login do advogado no eproc daquele tribunal: cada tribunal tem cadastro e senha próprios. */
function credenciais(config: Ambiente["config"], sigla: string): Ambiente["config"]["eprocTjrj"] {
  return sigla === "TJRJ" ? config.eprocTjrj : config.eproc;
}

class ConectorEproc implements Conector {
  readonly chave: string;
  /** "eproc do TJSP", nas mensagens. */
  private readonly sistema: string;

  constructor(private readonly tribunal: TribunalEproc) {
    this.chave = `eproc:${tribunal.sigla}`;
    this.sistema = `eproc do ${tribunal.sigla}`;
  }

  private ehLogin(url: string): boolean {
    return ehLoginSso(url, this.tribunal);
  }

  /* ------------------------------------------------------------------ login */

  /** Abre a instalação e espera o SSO decidir: área logada (sessão válida) ou tela de login. */
  private async irPara(pagina: Page, instancia: InstanciaEproc): Promise<void> {
    // Depois do primeiro login por certificado, o SSO vai direto ao certificado e o Chrome pode ficar parado na
    // escolha do certificado: a navegação não termina, e quem resolve é a pessoa (o login trata isso adiante).
    await pagina.goto(`${instancia.base}/`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    const limite = Date.now() + 45_000;
    while (Date.now() < limite) {
      if (ehAreaLogada(pagina.url()) || this.ehLogin(pagina.url()) || (await visivel(pagina, TELA.login.codigo))) break;
      await pagina.waitForTimeout(1_000);
    }
    await pagina.waitForLoadState("load").catch(() => undefined);
  }

  /**
   * O código de 2 fatores, nesta ordem: (1) gerado pelo próprio robô com o segredo do TOTP cadastrado no painel de
   * robôs (src/segundo-fator.ts); (2) buscado na fonte configurada (ROBO_2FA_WEBHOOK_URL, ex.: um webhook do n8n
   * que gera o TOTP); (3) digitado pela pessoa na janela. O segredo e o código não vão para log.
   */
  private async aguardarCodigo(ambiente: Ambiente, dentro: () => Promise<boolean>): Promise<void> {
    const { config, registrar } = ambiente;
    const digitar = (codigo: string) => this.digitarCodigo(ambiente, codigo, dentro);
    if (await entrarComCodigoDoPainel({ config: config.segundoFator, sistema: this.tribunal.sistema2fa, digitar, registrar })) return;
    if (await dentro()) {
      registrar("Login concluído.");
      return;
    }
    if (config.webhook2fa.url) {
      // Cada código vale ~30 s; algumas tentativas cobrem um código que chegou no fim da janela.
      for (let tentativa = 0; tentativa < 3 && !(await dentro()); tentativa += 1) {
        const codigo = await this.codigoDoWebhook(config);
        if (codigo && (await this.digitarCodigo(ambiente, codigo, dentro))) {
          registrar("Código de 2 fatores obtido da fonte configurada e aceito. Login concluído.");
          return;
        }
        await ambiente.pagina.waitForTimeout(3_000);
      }
      if (await dentro()) {
        registrar("Login concluído.");
        return;
      }
      registrar("A fonte automática do código de 2 fatores não resolveu; passo para a pessoa.");
    }
    await ambiente.aguardarPessoa(
      "segundo_fator",
      `O ${this.sistema} pediu o código de 6 dígitos do aplicativo de autenticação (2FA). O advogado digita o código na janela do robô e clica em Validar. O robô segue sozinho depois.`,
      dentro
    );
    registrar("Login concluído.");
  }

  /** Busca o código do momento na fonte configurada (ex.: webhook do n8n), pelo sistema. Devolve só 6 a 8 dígitos; o código não vai para log. */
  private async codigoDoWebhook(config: Ambiente["config"]): Promise<string | null> {
    const fonte = config.webhook2fa;
    if (!fonte.url) return null;
    try {
      const url = `${fonte.url}${fonte.url.includes("?") ? "&" : "?"}sistema=${encodeURIComponent(this.tribunal.sistema2fa)}`;
      const resposta = await fetch(url, { headers: fonte.token ? { [fonte.header]: fonte.token } : {}, signal: AbortSignal.timeout(15_000) });
      if (!resposta.ok) return null;
      const dados = (await resposta.json().catch(() => null)) as { codigo?: unknown; code?: unknown; token?: unknown } | null;
      const codigo = String(dados?.codigo ?? dados?.code ?? dados?.token ?? "").replace(/\D/g, "");
      return /^\d{6,8}$/.test(codigo) ? codigo : null;
    } catch {
      return null;
    }
  }

  /** Digita o código na tela do 2FA e confirma. Devolve se o login entrou. */
  private async digitarCodigo(ambiente: Ambiente, codigo: string, dentro: () => Promise<boolean>): Promise<boolean> {
    const { pagina } = ambiente;
    const campo = pagina.locator(TELA.login.campoCodigo).first();
    if (!(await campo.isVisible().catch(() => false))) return dentro();
    await campo.fill("").catch(() => undefined);
    await campo.fill(codigo).catch(() => undefined);
    const validar = pagina.locator(TELA.login.validar).first();
    if (await validar.isVisible().catch(() => false)) await validar.click().catch(() => undefined);
    else await campo.press("Enter").catch(() => undefined);
    await pagina
      .waitForURL((url) => ehAreaLogada(url.toString()) || /externo_controlador\.php\?acao=entrar_sso/i.test(url.toString()), { timeout: 20_000 })
      .catch(() => undefined);
    if (await dentro()) return true;
    // Código recusado: sai do campo, para não aparecer em captura de diagnóstico nem na tela remota.
    await campo.fill("").catch(() => undefined);
    // Onde a tela ficou (título e endereço sem a consulta, nunca o código): separa "recusado" de "tela que o robô não conhece".
    const onde = (() => {
      try {
        const url = new URL(pagina.url());
        return `${url.host}${url.pathname}`;
      } catch {
        return "endereço desconhecido";
      }
    })();
    ambiente.registrar(`Depois do código, o ${this.sistema} ficou em "${(await pagina.title().catch(() => "")).slice(0, 80)}" (${onde}).`);
    return false;
  }

  /** Já avisou (com diagnóstico) que está na Seleção de perfil sem conseguir escolher: avisa uma vez por login. */
  private perfilSemEscolhaAvisado = false;

  /** Na tela "Seleção de perfil", escolhe o perfil configurado (EPROC_PERFIL, padrão SP). Devolve se escolheu. */
  private async escolherPerfil(ambiente: Ambiente): Promise<boolean> {
    const { pagina, config, registrar } = ambiente;
    const escolha = await escolherPerfilNaTela(pagina, config.eproc.perfil);
    if (escolha === "escolhido") {
      registrar(`Perfil do ${this.sistema} escolhido: o da inscrição ${config.eproc.perfil}.`);
      this.perfilSemEscolhaAvisado = false;
      return true;
    }
    if (escolha === "sem_perfil" && !this.perfilSemEscolhaAvisado) {
      this.perfilSemEscolhaAvisado = true;
      registrar(`O ${this.sistema} está na Seleção de perfil, mas o robô não achou o perfil ${config.eproc.perfil} (diagnóstico em ${await ambiente.diagnostico(pagina, "perfil eproc")}).`);
    }
    return false;
  }

  async entrar(ambiente: Ambiente, instancia: InstanciaEproc = this.tribunal.instancias[0]): Promise<void> {
    const { pagina, config, registrar } = ambiente;
    const login = credenciais(config, this.tribunal.sigla);
    if (!ehAreaLogada(pagina.url()) || !pagina.url().startsWith(instancia.base)) await this.irPara(pagina, instancia);
    // Área logada do eproc deste tribunal (com dois tribunais no mesmo navegador, a do outro não conta).
    const dentro = async () => {
      // Com mais de um perfil (ex.: inscrições SP e ES), o eproc para na "Seleção de perfil" depois do 2FA.
      if (await this.escolherPerfil(ambiente)) await pagina.waitForURL((url) => ehAreaLogada(url.toString()), { timeout: 20_000 }).catch(() => undefined);
      return ehAreaLogada(pagina.url()) && this.tribunal.instancias.some((item) => pagina.url().startsWith(item.base));
    };
    if (await dentro()) return;
    // O certificado já passou e o eproc pede o código do aplicativo de autenticação (2FA): quem informa é a pessoa.
    if (await visivel(pagina, TELA.login.codigo)) {
      await this.aguardarCodigo(ambiente, dentro);
      return;
    }
    if (!this.ehLogin(pagina.url())) {
      registrar(`O ${this.sistema} abriu uma tela de login fora do padrão (diagnóstico em ${await ambiente.diagnostico(pagina, "login eproc")}).`);
      await ambiente.aguardarPessoa("login", `Conclua o login do ${this.sistema} na janela do robô. O robô segue sozinho depois.`, dentro);
      return;
    }

    registrar(`Sessão do ${this.sistema} fechada: iniciando o login (${login.login}).`);
    if (await temCaptcha(pagina)) {
      await ambiente.aguardarPessoa("captcha", `O ${this.sistema} mostrou um CAPTCHA no login. Resolva o desafio e conclua o login na janela do robô.`, dentro);
      return;
    }
    try {
      if (login.login === "certificado") {
        await pagina.locator(TELA.login.certificado).click();
        registrar(
          certificadoEmArquivo(config)
            ? "Login por certificado em arquivo: o robô apresenta o certificado ao tribunal sozinho."
            : "Login por certificado: o Chrome mostra a lista de certificados. Se ele já lembrar a escolha, o login segue sozinho."
        );
      } else if (login.login === "senha") {
        await pagina.locator(TELA.login.usuario).fill(login.usuario);
        await pagina.locator(TELA.login.senha).fill(login.senha);
        await pagina.locator(TELA.login.entrar).click();
      }
    } catch {
      // A mensagem original do Playwright pode citar o que foi digitado: não vai para log nem para a ficha.
      registrar(`Não consegui iniciar o login do ${this.sistema} sozinho; fica com a pessoa.`);
    }
    if (login.login !== "manual") await pagina.waitForURL((url) => ehAreaLogada(url.toString()), { timeout: 20_000 }).catch(() => undefined);
    if (await dentro()) {
      registrar("Login concluído.");
      return;
    }
    if (await visivel(pagina, TELA.login.codigo)) {
      await this.aguardarCodigo(ambiente, dentro);
      return;
    } else if (await temCaptcha(pagina)) {
      await ambiente.aguardarPessoa("captcha", `O ${this.sistema} mostrou um CAPTCHA. Resolva o desafio e conclua o login na janela do robô.`, dentro);
    } else {
      await ambiente.aguardarPessoa(
        "login",
        login.login === "certificado" && certificadoEmArquivo(config)
          ? `Login do ${this.sistema} pelo certificado em arquivo não concluiu (certificado vencido, senha trocada ou tela diferente). Conclua o login na janela do robô; confira o certificado no painel de robôs.`
          : login.login === "certificado"
          ? `Login do ${this.sistema}: escolha o certificado do advogado na lista que o Chrome do robô mostra e clique em OK (se o macOS pedir permissão para usar a chave, autorize). O robô segue sozinho depois.`
          : `Conclua o login do ${this.sistema} na janela do robô (certificado, ou usuário e senha). O robô segue sozinho depois.`,
        dentro
      );
    }
    registrar("Login concluído.");
  }

  /* --------------------------------------------------------------- consulta */

  /** Procura o processo numa instalação. Devolve null quando ele está ali, ou o motivo de não estar. */
  private async procurarEm(ambiente: Ambiente, instancia: InstanciaEproc, cnj: NumeroCnj): Promise<string | null> {
    const { pagina } = ambiente;
    await this.irPara(pagina, instancia);
    if (this.ehLogin(pagina.url())) await this.entrar(ambiente, instancia);
    const campo = pagina.locator(TELA.pesquisa).first();
    if (!(await campo.isVisible().catch(() => false))) {
      // Depois do login o eproc pode pedir o perfil (advogado, procurador…): quem escolhe é a pessoa.
      await campo.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
      if (!(await campo.isVisible().catch(() => false)) && (await this.escolherPerfil(ambiente))) {
        await campo.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
      }
      if (!(await campo.isVisible().catch(() => false))) {
        await ambiente.aguardarPessoa("login", `O ${this.sistema} (${instancia.rotulo}) não mostrou a pesquisa de processo: se pediu para escolher o perfil, escolha o de advogado na janela do robô.`, () => campo.isVisible());
      }
    }

    const avisos: string[] = [];
    const ouvir = (dialogo: Dialog) => {
      avisos.push(dialogo.message());
      void dialogo.accept().catch(() => undefined);
    };
    pagina.on("dialog", ouvir);
    try {
      await campo.fill(cnj.mascarado);
      await campo.press("Enter");
      const limite = Date.now() + 45_000;
      while (Date.now() < limite) {
        await pagina.waitForLoadState("domcontentloaded").catch(() => undefined);
        if (this.ehLogin(pagina.url())) throw new FalhaDoConector(`A sessão do ${this.sistema} caiu no meio do pedido. O robô faz o login de novo na próxima tentativa.`);
        const texto = await pagina
          .locator(TELA.capa)
          .first()
          .innerText({ timeout: 2_000 })
          .catch(() =>
            pagina
              .locator("body")
              .innerText()
              .catch(() => "")
          );
        if (ehCapaDoProcesso(pagina.url(), texto, cnj)) return null;
        // O alerta também pode ser só a faixa "Usuário logado como…": essa não é resposta da pesquisa.
        const alerta = mensagemDaPesquisa(avisos);
        if (alerta) return alerta;
        // Resultado em lista (o número aparece em mais de um lugar): só segue se houver um único com o número exato.
        const iguais = pagina.locator("a").filter({ hasText: cnj.mascarado });
        if (!/acao=processo_selecionar/i.test(pagina.url()) && (await iguais.count().catch(() => 0)) === 1) {
          await iguais.first().click();
          continue;
        }
        // A faixa "Usuário logado como …" usa a mesma classe dos avisos e fica na tela o tempo todo: não é resposta.
        const mensagem = mensagemDaPesquisa(await pagina.locator(TELA.mensagem).allInnerTexts().catch(() => []));
        if (mensagem) return mensagem;
        await pagina.waitForTimeout(1_000);
      }
      const captura = await ambiente.diagnostico(pagina, "consulta eproc");
      return `a pesquisa não chegou à capa (diagnóstico em ${captura})`;
    } finally {
      pagina.off("dialog", ouvir);
    }
  }

  private async abrirProcesso(ambiente: Ambiente, cnj: NumeroCnj): Promise<InstanciaEproc> {
    const motivos: string[] = [];
    for (const instancia of instanciasDoCnj(cnj, this.tribunal.instancias)) {
      const motivo = await this.procurarEm(ambiente, instancia, cnj);
      if (!motivo) {
        ambiente.registrar(`Processo aberto no ${this.sistema}, ${instancia.rotulo}.`);
        return instancia;
      }
      motivos.push(`${instancia.rotulo}: "${motivo}"`);
    }
    throw new FalhaDoConector(`O ${this.sistema} não mostrou o processo ${cnj.mascarado} (${motivos.join("; ")}). ${this.tribunal.foraDoEproc}`);
  }

  private async emSegredo(pagina: Page): Promise<boolean> {
    const capa = await pagina
      .locator(TELA.capa)
      .first()
      .innerText({ timeout: 5_000 })
      .catch(() => "");
    return emSegredoPelaCapa(capa);
  }

  /** Documentos da tabela de eventos, do evento mais antigo para o mais novo. */
  private async documentos(ambiente: Ambiente): Promise<DocumentoEproc[]> {
    const { pagina, registrar } = ambiente;
    // Processos longos: a capa pode mostrar só os últimos eventos, com um link para listar todos.
    if (await clicarPorTexto(pagina, TEXTO.todosEventos)) {
      registrar("Listando todos os eventos do processo.");
      await pagina.waitForLoadState("load").catch(() => undefined);
      await pagina.waitForTimeout(2_000);
    }
    const lidos = await pagina.locator(TELA.documentos).evaluateAll((links) =>
      links.map((link, indice) => {
        const linha = link.closest("tr");
        const celulas = linha ? [...linha.querySelectorAll("td")] : [];
        return {
          evento: Number((celulas[0]?.textContent ?? "").replace(/\D/g, "").slice(0, 6)) || 0,
          ordem: indice,
          nome: (link.textContent ?? "").replace(/\s+/g, " ").trim() || "documento",
          data: (celulas[1]?.textContent ?? "").replace(/\s+/g, " ").trim(),
          url: (link as HTMLAnchorElement).href,
        };
      })
    );
    return ordenarDocumentos(lidos.filter((documento) => /^https:/i.test(documento.url)));
  }

  /* --------------------------------------------------------------- download */

  /** Baixa um documento com a sessão do navegador. A página que embute o arquivo é seguida (até duas vezes). */
  private async baixarDocumento(ambiente: Ambiente, url: string, profundidade = 0): Promise<Arquivo> {
    const resposta = await ambiente.contexto.request.get(url, { timeout: 180_000, maxRedirects: 5 });
    if (this.ehLogin(resposta.url())) throw new FalhaDoConector(`A sessão do ${this.sistema} caiu no meio do download. O robô faz o login de novo na próxima tentativa.`);
    const corpo = await resposta.body();
    if (!resposta.ok()) return { tipo: "outro", corpo: Buffer.alloc(0) };
    const tipo = tipoDoArquivo(resposta.headers()["content-type"] ?? "", new Uint8Array(corpo.subarray(0, 8)));
    if (tipo === "html" && profundidade < 2) {
      const embutido = arquivoEmbutido(corpo.toString("latin1"), resposta.url());
      if (embutido) return this.baixarDocumento(ambiente, embutido, profundidade + 1);
    }
    return { tipo, corpo };
  }

  private async montarPdf(ambiente: Ambiente, cnj: NumeroCnj, documentos: DocumentoEproc[], destino: string, parcial = false): Promise<void> {
    const { registrar } = ambiente;
    const final = await PDFDocument.create();
    const fonte = await final.embedFont(StandardFonts.Helvetica);
    const negrito = await final.embedFont(StandardFonts.HelveticaBold);
    const LINHAS_POR_PAGINA = 40;
    const paginasDoIndice = Math.max(1, Math.ceil(documentos.length / LINHAS_POR_PAGINA));
    const indice: { documento: DocumentoEproc; pagina: number; nota: string }[] = [];
    let aproveitados = 0;

    const aviso = (documento: DocumentoEproc, motivo: string) => {
      const pagina = final.addPage([595, 842]);
      escrever(pagina, negrito, `Evento ${documento.evento} - ${documento.nome}`, 50, 780, 13);
      escrever(pagina, fonte, motivo, 50, 755, 11);
      escrever(pagina, fonte, "Consulte este documento no eproc.", 50, 738, 11);
    };

    for (const [posicao, documento] of documentos.entries()) {
      const inicio = paginasDoIndice + final.getPageCount() + 1;
      let nota = "";
      try {
        const arquivo = await this.baixarDocumento(ambiente, documento.url);
        if (arquivo.tipo === "pdf") {
          const origem = await PDFDocument.load(arquivo.corpo, { ignoreEncryption: true });
          for (const pagina of await final.copyPages(origem, origem.getPageIndices())) final.addPage(pagina);
          aproveitados += 1;
        } else if (arquivo.tipo === "imagem-png" || arquivo.tipo === "imagem-jpg") {
          const imagem = arquivo.tipo === "imagem-png" ? await final.embedPng(arquivo.corpo) : await final.embedJpg(arquivo.corpo);
          const escala = Math.min(1, 545 / imagem.width, 792 / imagem.height);
          const pagina = final.addPage([595, 842]);
          pagina.drawImage(imagem, { x: 25, y: 842 - 25 - imagem.height * escala, width: imagem.width * escala, height: imagem.height * escala });
          aproveitados += 1;
        } else {
          nota = arquivo.tipo === "html" ? "página do eproc, não incluída" : "arquivo que não é PDF, não incluído";
          aviso(documento, `Este documento não é PDF nem imagem (${nota}).`);
        }
      } catch (erro) {
        if (erro instanceof FalhaDoConector) throw erro;
        nota = "não foi possível ler";
        aviso(documento, "O robô não conseguiu ler este documento.");
      }
      indice.push({ documento, pagina: inicio, nota });
      if ((posicao + 1) % 25 === 0) registrar(`Documentos baixados: ${posicao + 1} de ${documentos.length}.`);
      await dormir(PAUSA_ENTRE_DOCUMENTOS_MS);
    }
    if (!aproveitados) {
      const captura = await ambiente.diagnostico(ambiente.pagina, "documentos eproc");
      throw new FalhaDoConector(`Nenhum documento do processo veio como PDF do ${this.sistema} (o advogado pode não ter acesso aos autos). Diagnóstico guardado em ${captura}.`);
    }

    // Índice na frente: evento, documento, data e página onde começa no PDF.
    for (let parte = 0; parte < paginasDoIndice; parte += 1) {
      const pagina = final.insertPage(parte, [595, 842]);
      let y = 790;
      if (parte === 0) {
        escrever(pagina, negrito, `Autos do processo ${cnj.mascarado} (${this.sistema})`, 50, y, 14);
        y -= 18;
        escrever(
          pagina,
          fonte,
          parcial
            ? `Montado pelo robô do ORQESTRAI em ${new Date().toLocaleString("pt-BR")}: só as ${documentos.length} peças novas desde o download anterior (a partir do evento ${documentos[0]?.evento ?? "?"}).`
            : `Montado pelo robô do ORQESTRAI em ${new Date().toLocaleString("pt-BR")}: ${documentos.length} documentos, do evento mais antigo para o mais novo.`,
          50,
          y,
          9
        );
        y -= 24;
      }
      for (const linha of indice.slice(parte * LINHAS_POR_PAGINA, (parte + 1) * LINHAS_POR_PAGINA)) {
        const texto = `Evento ${linha.documento.evento}  ${linha.documento.nome}  ${linha.documento.data}${linha.nota ? `  (${linha.nota})` : ""}`;
        escrever(pagina, fonte, texto.slice(0, 95), 50, y, 9);
        escrever(pagina, fonte, `p. ${linha.pagina}`, 500, y, 9);
        y -= 17;
      }
    }
    await writeFile(destino, await final.save());
    registrar(`PDF montado: ${documentos.length} documentos, ${final.getPageCount()} páginas.`);
    await conferirPdf(destino);
  }

  async baixar(ambiente: Ambiente, pedido: Pedido, destino: string): Promise<ResultadoDoDownload> {
    const cnj = lerCnj(pedido.cnj);
    if (!cnj) throw new FalhaDoConector(`Número de processo inválido: ${pedido.cnj}.`);
    await this.entrar(ambiente);
    await this.abrirProcesso(ambiente, cnj);
    if ((await this.emSegredo(ambiente.pagina)) && !pedido.segredoLiberado) throw new SegredoDeJustica();
    const documentos = await this.documentos(ambiente);
    if (!documentos.length) {
      if (await existeTexto(ambiente.pagina, TEXTO.acessoIntegra)) {
        throw new FalhaDoConector(
          `O ${this.sistema} só mostra os documentos com "Acesso à íntegra do processo", que é a declaração de interesse do advogado (com CAPTCHA): o advogado do certificado não representa as partes. O robô não declara interesse; anexe o PDF à mão.`
        );
      }
      const captura = await ambiente.diagnostico(ambiente.pagina, "capa eproc");
      throw new FalhaDoConector(`O processo não tem documentos na tabela de eventos do ${this.sistema}. Diagnóstico guardado em ${captura}.`);
    }
    // Download incremental: só as peças que ainda não vieram em pedidos anteriores deste processo.
    const novos = pecasNovas(documentos, pedido.pecasBaixadas);
    if (!novos.length) {
      ambiente.registrar(`${documentos.length} documentos na tabela de eventos, todos já baixados antes: nada novo.`);
      return { semNovidades: true };
    }
    const parcial = novos.length < documentos.length;
    ambiente.registrar(parcial ? `${novos.length} peças novas de ${documentos.length} na tabela de eventos. Baixando só as novas.` : `${documentos.length} documentos na tabela de eventos. Baixando um por um.`);
    await this.montarPdf(ambiente, cnj, novos, destino, parcial);
    return { pecas: novos.map(chaveDaPeca) };
  }

  /** Abre o processo, descreve a capa e a árvore e confere o primeiro documento, sem montar o PDF. */
  async inspecionar(ambiente: Ambiente, numero: string): Promise<void> {
    const { registrar, config, pagina, contexto } = ambiente;
    const cnj = lerCnj(numero);
    if (!cnj) throw new FalhaDoConector(`Número de processo inválido: ${numero}.`);
    await this.entrar(ambiente);
    await this.abrirProcesso(ambiente, cnj);
    registrar(`Segredo de justiça pela capa: ${(await this.emSegredo(pagina)) ? "sim" : "não"}. Área da capa encontrada: ${(await pagina.locator(TELA.capa).count()) ? "sim" : "não"}.`);
    registrar(`Capa: ${await ambiente.diagnostico(pagina, `inspecao-capa-${this.chave.replace(":", "-")}`)}`);
    const relatorio = join(config.pastas.diagnostico, `inspecao-${this.chave.replace(":", "-")}-controles.json`);
    const documentos = await this.documentos(ambiente);
    const resumo: Record<string, unknown> = {
      url: pagina.url().replace(/([?&](hash|key)=)[^&]+/gi, "$1…"),
      acessoIntegra: await existeTexto(pagina, TEXTO.acessoIntegra),
      documentos: documentos.length,
      primeiros: documentos.slice(0, 5).map((documento) => ({ evento: documento.evento, nome: documento.nome, acao: /acao=([^&]+)/.exec(documento.url)?.[1] ?? "" })),
      controlesDaCapa: await controlesDaTela(pagina),
    };
    registrar(`Documentos na tabela de eventos: ${documentos.length}. Acesso à íntegra na tela: ${resumo.acessoIntegra ? "sim" : "não"}.`);
    if (documentos[0]) {
      const arquivo = await this.baixarDocumento(ambiente, documentos[0].url).catch((erro: unknown) => ({ tipo: `falhou: ${erro instanceof Error ? erro.message.split("\n")[0] : String(erro)}`, corpo: Buffer.alloc(0) }));
      resumo.primeiroDocumento = { tipo: arquivo.tipo, bytes: arquivo.corpo.length };
      registrar(`Primeiro documento: ${arquivo.tipo}, ${arquivo.corpo.length} bytes.`);
    }
    // A árvore do processo abre em outra aba: guarda os controles dela também (pode ter um download do processo inteiro).
    const janela = contexto.waitForEvent("page", { timeout: 20_000 }).catch(() => null);
    if (await clicarPorTexto(pagina, TEXTO.arvore)) {
      const arvore = await janela;
      if (arvore) {
        await arvore.waitForLoadState("load").catch(() => undefined);
        await arvore.waitForTimeout(3_000);
        resumo.controlesDaArvore = await controlesDaTela(arvore);
        registrar(`Árvore: ${await ambiente.diagnostico(arvore, `inspecao-arvore-${this.chave.replace(":", "-")}`)}`);
        await arvore.close().catch(() => undefined);
      }
    }
    await writeFile(relatorio, JSON.stringify(resumo, null, 2));
    registrar(`Controles da capa e da árvore em ${relatorio}`);
  }
}

function escrever(pagina: PDFPage, fonte: PDFFont, texto: string, x: number, y: number, tamanho: number): void {
  pagina.drawText(paraPdf(texto), { x, y, size: tamanho, font: fonte, color: rgb(0.1, 0.1, 0.1), maxWidth: 545 - (x - 25) });
}

export const conectoresEproc: Conector[] = TRIBUNAIS_EPROC.map((tribunal) => new ConectorEproc(tribunal));
