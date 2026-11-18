import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface, type Interface } from "node:readline";
import type { CDPSession, Dialog, Page } from "playwright";
import type { Config } from "../config.ts";
import { temCaptcha } from "./comum.ts";
import { migradoParaEproc } from "./dcp-tjrj-urls.ts";
import { ehAcaoFinalDeDownload, ehControleDeDownload, nomeDaEtapa, urlSemSegredos } from "./mapeamento-urls.ts";
import type { Ambiente } from "./tipos.ts";
import { entrarComCodigoDoPainel } from "../segundo-fator.ts";

/**
 * Modo "mapear" (npm run mapear -- <dcp|pje> <CNJ>): para conhecer um sistema de tribunal antes de escrever o
 * conector. O robô abre o login no Chrome dele (o mesmo perfil), espera a pessoa entrar e percorre a consulta do
 * processo. Em cada tela guarda, em diagnostico/, a captura, o HTML e um JSON com os controles (botões, links,
 * campos, tabelas), como o --inspecionar do eproc.
 *
 * O que o mapear NÃO faz:
 * - não digita senha nem código: o login é sempre da pessoa, na janela do robô;
 * - não resolve CAPTCHA: para e chama a pessoa (aguardarPessoa "captcha");
 * - não baixa nem envia PDF: o download do navegador fica bloqueado durante o mapa, e ele nunca clica no botão que
 *   conclui o download ("Download", "Salvar processo completo"…). No máximo abre a janela de opções para descrevê-la;
 * - não confirma diálogo do tribunal (declaração de interesse, alerta de acesso): registra a mensagem e cancela.
 *
 * Quando não acha o caminho sozinho, pede à pessoa que faça aquele passo na janela e aperte Enter no terminal; a
 * tela é registrada do mesmo jeito. Assim o mapa sai completo mesmo com seletores errados.
 */

/** O Chrome do robô já está aberto (o robô está rodando em outro terminal)? O mapear não divide o navegador com ele. */
export async function navegadorDoRoboAberto(config: Config): Promise<boolean> {
  if (config.navegadorModo !== "comum") return false;
  const porta = (await readFile(join(config.pastas.perfil, "DevToolsActivePort"), "utf8").catch(() => "")).split("\n")[0]?.trim() ?? "";
  if (!/^\d+$/.test(porta)) return false;
  return fetch(`http://127.0.0.1:${porta}/json/version`, { signal: AbortSignal.timeout(2_000) }).then(
    (resposta) => resposta.ok,
    () => false
  );
}

/**
 * Confirmação da pessoa pelo terminal (Enter). Em modo de linha (terminal: false), para o Ctrl+C continuar
 * chegando ao processo como sinal e encerrar o robô normalmente.
 */
class Terminal {
  private leitor: Interface | null = null;
  private linhas: string[] = [];

  ouvir(): void {
    if (this.leitor) return;
    this.leitor = createInterface({ input: process.stdin, terminal: false });
    this.leitor.on("line", (linha) => this.linhas.push(linha.trim().toLowerCase()));
  }

  /** Começa a esperar um Enter: devolve a função que diz se ele veio (e o que foi digitado). */
  esperar(): () => string | null {
    this.linhas = [];
    return () => (this.linhas.length ? this.linhas[this.linhas.length - 1] : null);
  }

  fechar(): void {
    this.leitor?.close();
    this.leitor = null;
    process.stdin.pause();
  }
}

export interface OpcoesDeLogin {
  /** "DCP do TJRJ", "PJe do TJRJ (1º grau)", nas mensagens. */
  sistema: string;
  urlDeLogin: string;
  /** Critério observável de "logado": o endereço da aba saiu do login e está na área do sistema. */
  logado: (url: string) => boolean;
  /** O que dizer à pessoa, pela tela em que o login está. */
  instrucao: (url: string) => string;
  /** O sistema está pedindo o código do segundo fator? */
  pedeCodigo?: (pagina: Page) => Promise<boolean>;
  /**
   * Sistema do segredo do TOTP no painel de robôs (ex.: "pdpj"). Com ele e `digitarCodigo`, o robô gera e digita o
   * código antes de chamar a pessoa (src/segundo-fator.ts). O login (CPF e senha) continua com a pessoa.
   */
  sistema2fa?: string;
  /** Digita o código na tela do segundo fator e confirma. */
  digitarCodigo?: (pagina: Page, codigo: string) => Promise<void>;
  /** Chamado uma vez em cada tela nova do login (o mapear registra a tela). */
  aoVerTela?: (pagina: Page, tela: "login" | "codigo") => Promise<void>;
  /** Confirmação manual (Enter no terminal), para quando o critério observável falhar. */
  confirmouNoTerminal?: () => boolean;
}

/**
 * Login feito pela pessoa, na janela do robô: abre a tela, espera e só observa. Volta quando alguma aba do robô
 * estiver na área logada (ou a pessoa confirmar no terminal). Devolve a aba logada. Não digita nada.
 */
export async function entrarComAPessoa(ambiente: Ambiente, opcoes: OpcoesDeLogin): Promise<Page> {
  const { contexto, registrar } = ambiente;
  let pagina = ambiente.pagina;
  const abaLogada = () => contexto.pages().find((aba) => !aba.isClosed() && opcoes.logado(aba.url())) ?? null;
  if (!opcoes.logado(pagina.url())) {
    await pagina.goto(opcoes.urlDeLogin, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    // Telas de login em Angular (IdServerJus) e redirecionamentos do SSO: um respiro antes de decidir.
    await pagina.waitForTimeout(3_000);
  }
  const dentro = async () => Boolean(abaLogada()) || Boolean(opcoes.confirmouNoTerminal?.());
  if (await dentro()) {
    registrar(`Sessão do ${opcoes.sistema} já aberta no perfil do robô.`);
    return abaLogada() ?? pagina;
  }

  await opcoes.aoVerTela?.(pagina, "login");
  let codigoVisto = false;
  let tentouPainel = false;
  while (!(await dentro())) {
    // O login pode abrir outra aba (certificado, gov.br): acompanha a mais recente.
    const abertas = contexto.pages().filter((aba) => !aba.isClosed());
    pagina = abertas[abertas.length - 1] ?? pagina;
    if (await temCaptcha(pagina)) {
      await ambiente.aguardarPessoa(
        "captcha",
        `O ${opcoes.sistema} mostrou um CAPTCHA no login. Resolva o desafio e conclua o login na janela do robô (o robô não resolve CAPTCHA).`,
        async () => (await dentro()) || !(await temCaptcha(pagina))
      );
      continue;
    }
    if (opcoes.pedeCodigo && (await opcoes.pedeCodigo(pagina).catch(() => false))) {
      if (!codigoVisto) await opcoes.aoVerTela?.(pagina, "codigo");
      codigoVisto = true;
      if (opcoes.sistema2fa && opcoes.digitarCodigo && !tentouPainel) {
        tentouPainel = true;
        const aba = pagina;
        const digitar = async (codigo: string) => {
          await opcoes.digitarCodigo!(aba, codigo);
          // Saiu da tela do código (ou já está logado): aceito. Ainda nela depois de 20 s: recusado.
          await aba.waitForTimeout(2_000).catch(() => undefined);
          for (const limite = Date.now() + 20_000; Date.now() < limite; ) {
            if ((await dentro()) || !(await opcoes.pedeCodigo!(aba).catch(() => false))) return true;
            await aba.waitForTimeout(1_000).catch(() => undefined);
          }
          return false;
        };
        if (await entrarComCodigoDoPainel({ config: ambiente.config.segundoFator, sistema: opcoes.sistema2fa, digitar, registrar })) continue;
      }
      await ambiente.aguardarPessoa(
        "segundo_fator",
        `O ${opcoes.sistema} pediu o código do segundo fator. O advogado digita o código na janela do robô e confirma. O robô segue sozinho depois.`,
        async () => (await dentro()) || !(await opcoes.pedeCodigo!(pagina).catch(() => false))
      );
      continue;
    }
    await ambiente.aguardarPessoa(
      "login",
      `${opcoes.instrucao(pagina.url())} O robô não digita senha. Ele segue sozinho quando a tela sair do login; se não perceber, aperte Enter aqui no terminal depois de entrar.`,
      async () => (await dentro()) || (await temCaptcha(pagina)) || Boolean(opcoes.pedeCodigo && (await opcoes.pedeCodigo(pagina).catch(() => false)))
    );
  }
  const logada = abaLogada();
  registrar(logada ? `Login no ${opcoes.sistema} concluído.` : `A pessoa confirmou no terminal o login no ${opcoes.sistema} (o endereço da área logada não era o esperado: ${urlSemSegredos(pagina.url())}).`);
  return logada ?? pagina;
}

/** Um controle da tela, só o que o identifica. Nunca o valor de campo (pode ser a senha). */
interface Controle {
  tag: string;
  id: string;
  nome: string;
  tipo: string;
  classe: string;
  texto: string;
  titulo: string;
  placeholder: string;
  href: string;
  onclick: string;
  visivel: boolean;
  download?: boolean;
}

interface Tela {
  url: string;
  titulo: string;
  quadros: { url: string; nome: string; controles: Controle[]; tabelas: { id: string; colunas: string[]; linhas: number }[]; formularios: { id: string; nome: string; acao: string }[] }[];
  controlesDeDownload: Controle[];
  migradoParaEproc: boolean;
  captcha: boolean;
  /** Começo do texto visível da página principal (fica só nesta máquina, como o HTML). */
  texto: string;
}

/** Descreve a página e os quadros (frames) dela. */
async function descreverTela(pagina: Page): Promise<Tela> {
  const quadros: Tela["quadros"] = [];
  for (const quadro of pagina.frames()) {
    const dados = await quadro
      .evaluate(() => {
        const seletor =
          "a, button, input, select, textarea, [role=button], [role=tab], [role=menuitem], [role=treeitem], [onclick], img[title], i[title], span[title], div[title]";
        const controles = [...document.querySelectorAll<HTMLElement>(seletor)].slice(0, 400).map((elemento) => {
          const item = elemento as HTMLInputElement & HTMLAnchorElement;
          return {
            tag: item.tagName.toLowerCase(),
            id: item.id,
            nome: item.getAttribute("name") ?? item.getAttribute("formcontrolname") ?? "",
            tipo: item.getAttribute("type") ?? item.getAttribute("role") ?? "",
            classe: (item.getAttribute("class") ?? "").slice(0, 80),
            // Texto do controle; campo de digitação não tem texto, e o valor dele nunca é lido.
            texto: /^(input|textarea|select)$/i.test(item.tagName) && !/^(button|submit|reset)$/i.test(item.type) ? "" : (item.textContent || item.value || "").replace(/\s+/g, " ").trim().slice(0, 80),
            titulo: (item.getAttribute("title") || item.getAttribute("aria-label") || item.getAttribute("alt") || "").slice(0, 100),
            placeholder: (item.getAttribute("placeholder") ?? "").slice(0, 60),
            href: (item.getAttribute("href") ?? "").slice(0, 300),
            onclick: (item.getAttribute("onclick") ?? "").slice(0, 200),
            visivel: item.offsetParent !== null || item.getClientRects().length > 0,
          };
        });
        const tabelas = [...document.querySelectorAll("table")].slice(0, 30).map((tabela) => ({
          id: tabela.id,
          colunas: [...tabela.querySelectorAll("th")].slice(0, 12).map((celula) => (celula.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40)),
          linhas: tabela.querySelectorAll("tr").length,
        }));
        const formularios = [...document.querySelectorAll("form")].slice(0, 20).map((formulario) => ({ id: formulario.id, nome: formulario.getAttribute("name") ?? "", acao: formulario.getAttribute("action") ?? "" }));
        return { controles, tabelas, formularios };
      })
      .catch(() => ({ controles: [], tabelas: [], formularios: [] }));
    quadros.push({
      url: urlSemSegredos(quadro.url()),
      nome: quadro.name(),
      controles: dados.controles.map((controle) => ({
        ...controle,
        href: urlSemSegredos(controle.href),
        onclick: urlSemSegredos(controle.onclick),
        download: ehControleDeDownload(`${controle.texto} ${controle.titulo} ${controle.href} ${controle.onclick}`) || undefined,
      })),
      tabelas: dados.tabelas,
      formularios: dados.formularios.map((formulario) => ({ ...formulario, acao: urlSemSegredos(formulario.acao) })),
    });
  }
  const texto = await pagina
    .locator("body")
    .innerText({ timeout: 5_000 })
    .catch(() => "");
  return {
    url: urlSemSegredos(pagina.url()),
    titulo: await pagina.title().catch(() => ""),
    quadros,
    controlesDeDownload: quadros.flatMap((quadro) => quadro.controles.filter((controle) => controle.download)),
    migradoParaEproc: migradoParaEproc(texto),
    captcha: await temCaptcha(pagina),
    texto: texto.replace(/\s+/g, " ").trim().slice(0, 1_500),
  };
}

export interface PassoDoMapa {
  etapa: string;
  /** O que a pessoa faz na janela se o robô não chegar lá sozinho. */
  instrucao: string;
  /**
   * Tenta chegar sozinho; devolve se chegou. Pode digitar o número do processo e clicar em menus e botões de
   * navegação; nunca digita senha nem clica em ação final de download.
   */
  automatico?: (mapa: Mapeamento) => Promise<boolean>;
  /** Passo que pode não existir no sistema: sem o automático, só anota e segue (não chama a pessoa). */
  opcional?: boolean;
  /** Depois de registrar a tela (ex.: fechar a janela de opções do download). */
  depois?: (mapa: Mapeamento) => Promise<void>;
}

/** Percorre o sistema registrando cada tela. Um por execução do mapear. */
export class Mapeamento {
  /** A aba em foco: muda quando o sistema abre outra (autos digitais, visualizador). */
  pagina: Page;
  private ordem = 0;
  private readonly passos: Record<string, unknown>[] = [];
  private readonly terminal = new Terminal();
  private readonly conhecidas = new Set<Page>();
  private downloadsBarrados = 0;
  private readonly dialogos: string[] = [];
  private bloqueio: CDPSession | null = null;
  /** Durante o login, diálogo (aviso de senha errada, sessão anterior…) é da pessoa: o robô não responde. */
  private dialogosDaPessoa = true;
  readonly inicio = new Date();

  constructor(
    readonly ambiente: Ambiente,
    /** "dcp", "pje"… (nome dos arquivos). */
    readonly sistema: string,
    readonly cnj: string
  ) {
    this.pagina = ambiente.pagina;
  }

  get registrar(): (mensagem: string) => void {
    return this.ambiente.registrar;
  }

  /** Bloqueia downloads e diálogos, e passa a ouvir o terminal. */
  async iniciar(): Promise<void> {
    this.terminal.ouvir();
    const { contexto } = this.ambiente;
    // Navegador comum (CDP): o download fica negado no navegador inteiro enquanto o mapa roda.
    try {
      const navegador = contexto.browser();
      if (navegador) {
        this.bloqueio = await navegador.newBrowserCDPSession();
        await this.bloqueio.send("Browser.setDownloadBehavior", { behavior: "deny" });
      }
    } catch {
      this.bloqueio = null;
    }
    for (const aba of contexto.pages()) this.vigiar(aba);
    contexto.on("page", (aba) => this.vigiar(aba));
    this.registrar(`Mapeando o ${this.sistema.toUpperCase()} com o processo ${this.cnj}. Downloads bloqueados durante o mapa; capturas em ${this.ambiente.config.pastas.diagnostico}.`);
  }

  /** Cada aba: download cancelado na hora e diálogo do tribunal registrado e cancelado (nunca confirmado). */
  private vigiar(aba: Page): void {
    if (this.conhecidas.has(aba)) return;
    this.conhecidas.add(aba);
    aba.on("download", (download) => {
      this.downloadsBarrados += 1;
      this.registrar(`Download barrado pelo mapear (${download.suggestedFilename()}): o mapa não baixa autos.`);
      void download.cancel().catch(() => undefined);
    });
    aba.on("dialog", (dialogo: Dialog) => {
      const mensagem = dialogo.message().replace(/\s+/g, " ").slice(0, 300);
      this.dialogos.push(mensagem);
      if (this.dialogosDaPessoa) {
        this.registrar(`O tribunal abriu um diálogo no login ("${mensagem}"). Responda na janela do robô.`);
        return;
      }
      this.registrar(`O tribunal abriu um diálogo ("${mensagem}"). O mapear não confirma: cancelou.`);
      void dialogo.dismiss().catch(() => undefined);
    });
    // Sem a sessão do navegador (modo playwright), o bloqueio vai por aba.
    if (!this.bloqueio) {
      void this.ambiente.contexto
        .newCDPSession(aba)
        .then((sessao) => sessao.send("Page.setDownloadBehavior", { behavior: "deny" }))
        .catch(() => undefined);
    }
  }

  /** A pessoa entrou: daqui em diante o mapear cancela os diálogos (nunca confirma declaração ou alerta de acesso). */
  loginConcluido(): void {
    this.dialogosDaPessoa = false;
  }

  /** O sistema abriu outra aba durante o passo (autos digitais, visualizador)? Passa a trabalhar nela. */
  private async adotarAbaNova(antes: Set<Page>): Promise<void> {
    const abertas = this.ambiente.contexto.pages().filter((aba) => !aba.isClosed());
    const nova = abertas.filter((aba) => !antes.has(aba)).pop();
    if (nova) {
      this.pagina = nova;
      await nova.bringToFront().catch(() => undefined);
      await nova.waitForLoadState("load", { timeout: 20_000 }).catch(() => undefined);
      this.registrar(`O sistema abriu outra aba (${urlSemSegredos(nova.url()).slice(0, 120)}); o mapa segue nela.`);
    } else if (this.pagina.isClosed() && abertas.length) {
      this.pagina = abertas[abertas.length - 1];
    }
  }

  /** CAPTCHA na tela: quem resolve é a pessoa. */
  async resolverCaptcha(): Promise<void> {
    const pagina = this.pagina;
    if (!(await temCaptcha(pagina))) return;
    await this.ambiente.aguardarPessoa("captcha", `O ${this.sistema.toUpperCase()} mostrou um CAPTCHA. Resolva o desafio na janela do robô (o robô não resolve CAPTCHA).`, async () => !(await temCaptcha(pagina)));
  }

  /** Confirmação pelo terminal, para o login (critério observável que pode falhar). */
  confirmacaoNoTerminal(): () => boolean {
    const veio = this.terminal.esperar();
    return () => veio() !== null;
  }

  /** Pede à pessoa que faça o passo na janela. Devolve true com Enter, false com "pular" ou no fim da espera. */
  async pedirPessoa(instrucao: string): Promise<boolean> {
    this.registrar(`>>> MAPEAMENTO: ${instrucao} Quando a tela estiver pronta, aperte Enter aqui no terminal (ou digite "pular" e Enter).`);
    process.stdout.write("\u0007");
    const veio = this.terminal.esperar();
    const limite = Date.now() + this.ambiente.config.esperaPessoaMs;
    while (Date.now() < limite) {
      const resposta = veio();
      if (resposta !== null) return resposta !== "pular";
      await new Promise((resolver) => setTimeout(resolver, 500));
    }
    this.registrar("Ninguém respondeu a tempo; o mapa registra a tela como está.");
    return false;
  }

  /** Guarda captura, HTML e o JSON da tela em diagnostico/. */
  async registrarTela(etapa: string, nota?: string, pagina: Page = this.pagina): Promise<Tela> {
    this.ordem += 1;
    const nome = nomeDaEtapa(this.sistema, this.ordem, etapa);
    await pagina.waitForLoadState("domcontentloaded").catch(() => undefined);
    const captura = await this.ambiente.diagnostico(pagina, nome);
    const tela = await descreverTela(pagina);
    const arquivo = captura.replace(/\.png$/, ".json");
    await writeFile(arquivo, JSON.stringify({ sistema: this.sistema, ordem: this.ordem, etapa, nota: nota ?? null, ...tela }, null, 2));
    const controles = tela.quadros.reduce((total, quadro) => total + quadro.controles.length, 0);
    this.passos.push({
      ordem: this.ordem,
      etapa,
      nota: nota ?? null,
      url: tela.url,
      titulo: tela.titulo,
      captura,
      descricao: arquivo,
      controles,
      quadros: tela.quadros.length,
      controlesDeDownload: tela.controlesDeDownload.map((controle) => controle.titulo || controle.texto || controle.id).slice(0, 20),
      migradoParaEproc: tela.migradoParaEproc,
    });
    this.registrar(`Tela ${this.ordem} (${etapa}): ${controles} controles${tela.controlesDeDownload.length ? `, ${tela.controlesDeDownload.length} de download` : ""}. ${arquivo}`);
    return tela;
  }

  /** Um passo do roteiro: tenta sozinho, chama a pessoa se precisar e registra a tela. Devolve se chegou. */
  async seguir(passo: PassoDoMapa): Promise<boolean> {
    await this.resolverCaptcha();
    const antes = new Set(this.ambiente.contexto.pages());
    let chegou = false;
    if (passo.automatico) {
      try {
        chegou = await passo.automatico(this);
      } catch (erro) {
        this.registrar(`Passo "${passo.etapa}": não consegui sozinho (${erro instanceof Error ? erro.message.split("\n")[0].slice(0, 160) : String(erro)}).`);
      }
    }
    await this.adotarAbaNova(antes);
    if (!chegou && passo.opcional) {
      this.registrar(`Passo "${passo.etapa}": não achei na tela; segue sem ele. (${passo.instrucao})`);
      this.passos.push({ ordem: null, etapa: passo.etapa, nota: "não encontrado (opcional)" });
      return false;
    }
    if (!chegou) {
      chegou = await this.pedirPessoa(passo.instrucao);
      await this.adotarAbaNova(antes);
    }
    await this.resolverCaptcha();
    await this.registrarTela(passo.etapa, chegou ? undefined : "a pessoa pulou ou não confirmou; a tela foi registrada como estava");
    await passo.depois?.(this).catch(() => undefined);
    return chegou;
  }

  /** Texto visível da aba em foco. */
  async texto(): Promise<string> {
    return this.pagina
      .locator("body")
      .innerText({ timeout: 5_000 })
      .catch(() => "");
  }

  /** Grava o resumo do mapa e devolve o caminho. Desfaz o bloqueio de downloads. */
  async concluir(observacoes: string[] = []): Promise<string> {
    this.terminal.fechar();
    await this.bloqueio?.send("Browser.setDownloadBehavior", { behavior: "default" }).catch(() => undefined);
    const arquivo = join(this.ambiente.config.pastas.diagnostico, `${nomeDaEtapa(this.sistema, 0, "resumo")}-${this.inicio.toISOString().replace(/[:.]/g, "-")}.json`);
    const resumo = {
      sistema: this.sistema,
      cnj: this.cnj,
      inicio: this.inicio.toISOString(),
      fim: new Date().toISOString(),
      passos: this.passos,
      downloadsBarrados: this.downloadsBarrados,
      dialogos: this.dialogos,
      observacoes,
    };
    await writeFile(arquivo, JSON.stringify(resumo, null, 2));
    this.registrar(`Mapa concluído: ${this.passos.length} passos, resumo em ${arquivo}. Nenhum PDF foi baixado nem enviado.`);
    return arquivo;
  }
}

/* ------------------------------------------------------------------ ajudas para os roteiros e os rascunhos */

/**
 * Clica no primeiro controle visível (em qualquer quadro) cujo texto, título ou rótulo casa com `padrao`. Recusa
 * ação final de download. Devolve se clicou.
 */
export async function clicarPorTexto(pagina: Page, padrao: RegExp, seletor = "a, button, input[type=button], input[type=submit], [role=button], [role=tab], [role=menuitem], [title]"): Promise<boolean> {
  for (const quadro of pagina.frames()) {
    const marcado = await quadro
      .evaluate(
        ({ fonte, flags, seletor: alvoSeletor }) => {
          const regra = new RegExp(fonte, flags);
          const candidatos = [...document.querySelectorAll<HTMLElement>(alvoSeletor)];
          const alvo = candidatos.find((item) => {
            const visivel = item.offsetParent !== null || item.getClientRects().length > 0;
            const textos = [item.textContent, item.title, (item as HTMLInputElement).value, item.getAttribute("aria-label")];
            return visivel && textos.some((texto) => texto && regra.test(texto.replace(/\s+/g, " ").trim()));
          });
          if (!alvo) return null;
          alvo.setAttribute("data-robo-alvo", "1");
          return [alvo.textContent, alvo.title, (alvo as HTMLInputElement).value].map((texto) => (texto ?? "").replace(/\s+/g, " ").trim()).find(Boolean) ?? "";
        },
        { fonte: padrao.source, flags: padrao.flags, seletor }
      )
      .catch(() => null);
    if (marcado === null) continue;
    const alvo = quadro.locator("[data-robo-alvo='1']").first();
    if (ehAcaoFinalDeDownload(marcado)) {
      await alvo.evaluate((item) => item.removeAttribute("data-robo-alvo")).catch(() => undefined);
      throw new Error(`recusei clicar em "${marcado}": conclui um download`);
    }
    await alvo.click({ timeout: 10_000 });
    await alvo.evaluate((item) => item.removeAttribute("data-robo-alvo")).catch(() => undefined);
    return true;
  }
  return false;
}

/** Preenche o primeiro campo visível da lista. Só para o número do processo, nunca senha ou código. */
export async function preencherPrimeiro(pagina: Page, seletores: readonly string[], valor: string): Promise<boolean> {
  for (const quadro of pagina.frames()) {
    for (const seletor of seletores) {
      const campo = quadro.locator(seletor).first();
      if (!(await campo.isVisible().catch(() => false))) continue;
      if (/password/i.test((await campo.getAttribute("type").catch(() => "")) ?? "")) continue;
      await campo.fill(valor);
      return true;
    }
  }
  return false;
}

/** Espera a página assentar depois de um clique (navegação, requisição Ajax ou nova aba). */
export async function assentar(pagina: Page, ms = 2_000): Promise<void> {
  await pagina.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
  await pagina.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await pagina.waitForTimeout(ms);
}
