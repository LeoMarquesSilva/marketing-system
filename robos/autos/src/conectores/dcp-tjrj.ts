import type { Frame, Page } from "playwright";
import type { Pedido } from "../fila.ts";
import { conferirPdf } from "./comum.ts";
import {
  CONSULTA_PROCESSUAL_DCP,
  LOGIN_PORTAL_DE_SERVICOS,
  documentosDoIndiceDcp,
  documentosNovosDcp,
  ehQuadroDaConsultaDcp,
  ehVisualizadorDcp,
  QUADRO_DA_CONSULTA_DCP,
  type DocumentoDoIndiceDcp,
  ehAreaLogadaDcp,
  emSegredoDcp,
  etapaDoLoginDcp,
  instrucaoDoLoginDcp,
  migradoParaEproc,
  partesDoCnjTjrj,
  visualizadorDoBotao,
  type PartesDoCnjTjrj,
} from "./dcp-tjrj-urls.ts";
import { Mapeamento, assentar, clicarPorTexto, entrarComAPessoa, preencherPrimeiro, type OpcoesDeLogin, type PassoDoMapa } from "./mapeamento.ts";
import { FalhaDoConector, MigradoParaEproc, SegredoDeJustica, type Ambiente, type Conector, type ResultadoDoDownload } from "./tipos.ts";

/**
 * DCP do TJRJ (Portal de Serviços): o conector (ConectorDcpTjrj, no fim do arquivo) e o roteiro do
 * `npm run mapear -- dcp <CNJ>`, que serviu para conhecer as telas. O que se sabe de cada tela está em
 * dcp-tjrj-urls.ts.
 */

/** Textos do roteiro do mapa (vindos dos manuais; o conector usa os seletores vistos nas telas, mais abaixo). */
const TELA = {
  menuConsultas: /^Consultas$/i,
  consultasProcessuais: /^Consultas? Processua(l|is)$/i,
  abaPorNumero: /^Por N[úu]mero$/i,
  /** Um campo só com o número inteiro. */
  numeroInteiro: [
    "input[formcontrolname*='numeroProcesso' i]",
    "input[name*='numeroProcesso' i]",
    "input[id*='numeroProcesso' i]",
    "input[placeholder*='0000000-00' i]",
    "input[placeholder*='número do processo' i]",
  ],
  /** Dois campos em volta de ".8.19." (como a busca da página inicial do tribunal). */
  numeroInicio: ["input[formcontrolname*='numero' i]:not([formcontrolname*='origem' i])", "input[id*='numero' i]:not([id*='origem' i])", "input[name*='numero' i]:not([name*='origem' i])"],
  numeroOrigem: ["input[formcontrolname*='origem' i]", "input[id*='origem' i]", "input[name*='origem' i]"],
  pesquisar: /^(Pesquisar|Consultar|Buscar)$/i,
  alterarPerfil: /Alterar Perfil|Tipo de Usu[áa]rio/i,
  visualizador: /Processo Eletr[ôo]nico\s*[–-]\s*(Novo|Antigo) Visualizador|clique aqui para visualizar/i,
  movimentos: /^(Movimentos|Movimenta[çc][õo]es|Andamentos|Hist[óo]rico)$/i,
  exibirSelecao: /Exibir Caixa de Sele[çc][ãa]o/i,
  /** Ícone que abre a pergunta "Deseja salvar uma cópia das peças processuais?". */
  baixarProcesso: /Baixar o Processo Atual em PDF|Exportar/i,
  salvarCompleto: /^Salvar processo completo$/i,
  cancelar: /^(Cancelar|Fechar)$/i,
} as const;

const SISTEMA = "DCP do TJRJ (Portal de Serviços)";

function opcoesDeLogin(extra: Partial<OpcoesDeLogin> = {}): OpcoesDeLogin {
  return {
    sistema: SISTEMA,
    urlDeLogin: LOGIN_PORTAL_DE_SERVICOS,
    logado: ehAreaLogadaDcp,
    instrucao: (url) => instrucaoDoLoginDcp(etapaDoLoginDcp(url)),
    pedeCodigo: async (pagina) => etapaDoLoginDcp(pagina.url()) === "duplo-fator",
    ...extra,
  };
}

/** Número na aba "Por Número": um campo só ou os dois em volta de ".8.19.". */
async function preencherNumero(pagina: Page, partes: PartesDoCnjTjrj): Promise<boolean> {
  if (await preencherPrimeiro(pagina, TELA.numeroOrigem, partes.origem)) {
    return preencherPrimeiro(pagina, TELA.numeroInicio, partes.inicio);
  }
  return preencherPrimeiro(pagina, TELA.numeroInteiro, partes.mascarado);
}

/** O link do processo no resultado, ou já os detalhes dele. */
async function abrirDetalhes(pagina: Page, partes: PartesDoCnjTjrj): Promise<boolean> {
  const texto = await pagina
    .locator("body")
    .innerText()
    .catch(() => "");
  if (TELA.visualizador.test(texto) || /Detalhes do Processo/i.test(texto)) return true;
  const link = pagina.locator("a").filter({ hasText: partes.mascarado });
  if ((await link.count().catch(() => 0)) !== 1) return false;
  await link.first().click();
  await assentar(pagina);
  return true;
}

/** Abre o visualizador (nova aba). Devolve qual abriu, ou null. */
async function abrirVisualizador(ambiente: Ambiente, pagina: Page): Promise<"novo" | "antigo" | "outro" | null> {
  const textos = await pagina
    .locator("a, button, input[type=button]")
    .evaluateAll((itens) => itens.map((item) => (item.textContent || (item as HTMLInputElement).value || item.getAttribute("title") || "").replace(/\s+/g, " ").trim()))
    .catch(() => [] as string[]);
  const tipos = textos.map(visualizadorDoBotao).filter((tipo): tipo is "novo" | "antigo" | "outro" => Boolean(tipo));
  const escolhido = tipos.includes("novo") ? "novo" : (tipos[0] ?? null);
  if (!escolhido) return null;
  const padrao = escolhido === "novo" ? /Novo Visualizador/i : escolhido === "antigo" ? /Antigo Visualizador/i : TELA.visualizador;
  const janela = ambiente.contexto.waitForEvent("page", { timeout: 25_000 }).catch(() => null);
  if (!(await clicarPorTexto(pagina, padrao))) return null;
  await janela;
  return escolhido;
}

/** Roteiro do `npm run mapear -- dcp <CNJ>`. */
export async function mapearDcp(ambiente: Ambiente, numero: string): Promise<void> {
  const partes = partesDoCnjTjrj(numero);
  if (!partes) throw new FalhaDoConector(`O DCP é do TJRJ: o número precisa ser 0000000-00.0000.8.19.0000 (recebi ${numero}).`);
  const mapa = new Mapeamento(ambiente, "dcp", partes.mascarado);
  const observacoes: string[] = [];
  await mapa.iniciar();
  try {
    mapa.pagina = await entrarComAPessoa(
      ambiente,
      opcoesDeLogin({
        confirmouNoTerminal: mapa.confirmacaoNoTerminal(),
        aoVerTela: async (pagina, tela) => {
          await mapa.registrarTela(tela === "codigo" ? "login-duplo-fator" : "login", undefined, pagina);
        },
      })
    );
    mapa.loginConcluido();
    await assentar(mapa.pagina);
    const passos: PassoDoMapa[] = [
      {
        etapa: "portal-inicial",
        instrucao: 'Se o portal pedir para escolher o perfil ("Alterar Perfil", "Tipo de Usuário"), escolha o de advogado e confirme.',
        automatico: async (m) => !TELA.alterarPerfil.test(await m.texto()),
      },
      {
        etapa: "consultas",
        instrucao: 'Abra o menu "Consultas" > "Consultas Processuais" na janela do robô.',
        automatico: async (m) => {
          if (!(await clicarPorTexto(m.pagina, TELA.menuConsultas))) return false;
          await m.pagina.waitForTimeout(1_000);
          if (!(await clicarPorTexto(m.pagina, TELA.consultasProcessuais))) return false;
          await assentar(m.pagina);
          return /Por N[úu]mero/i.test(await m.texto());
        },
      },
      {
        etapa: "pesquisa-por-numero",
        instrucao: `Na aba "Por Número", digite o número ${partes.mascarado} (ainda sem pesquisar).`,
        automatico: async (m) => {
          await clicarPorTexto(m.pagina, TELA.abaPorNumero);
          await m.pagina.waitForTimeout(1_000);
          return preencherNumero(m.pagina, partes);
        },
      },
      {
        etapa: "resultado",
        instrucao: "Clique em Pesquisar e espere o resultado.",
        automatico: async (m) => {
          if (!(await clicarPorTexto(m.pagina, TELA.pesquisar, "button, input[type=button], input[type=submit], a"))) return false;
          await assentar(m.pagina, 3_000);
          return true;
        },
      },
      {
        etapa: "detalhes-do-processo",
        instrucao: `Abra o processo ${partes.mascarado} no resultado, até a tela "Detalhes do Processo".`,
        automatico: (m) => abrirDetalhes(m.pagina, partes),
      },
    ];
    for (const passo of passos) await mapa.seguir(passo);

    const detalhes = await mapa.texto();
    if (migradoParaEproc(detalhes)) {
      observacoes.push("Processo migrado para o eproc: o pedido deste processo deve ir ao conector eproc:TJRJ.");
      ambiente.registrar("O DCP diz que este processo foi migrado para o eproc: o eproc:TJRJ já baixa os autos dele. O mapa para aqui.");
      return;
    }
    observacoes.push(`Segredo de justiça pelo texto dos detalhes: ${emSegredoDcp(detalhes) ? "sim (ou ambíguo)" : "não"}.`);

    const depois: PassoDoMapa[] = [
      {
        etapa: "movimentos",
        instrucao: "Aba de movimentos ou andamentos do processo.",
        opcional: true,
        automatico: async (m) => {
          if (!(await clicarPorTexto(m.pagina, TELA.movimentos))) return false;
          await assentar(m.pagina);
          return true;
        },
      },
      {
        etapa: "visualizador",
        instrucao: 'Clique em "Processo Eletrônico – Novo Visualizador" (ou no Antigo, se só houver ele) e espere o índice de documentos aparecer.',
        automatico: async (m) => {
          const tipo = await abrirVisualizador(ambiente, m.pagina);
          if (tipo) observacoes.push(`Visualizador aberto: ${tipo}.`);
          await assentar(m.pagina, 4_000);
          return Boolean(tipo);
        },
      },
      {
        etapa: "indice-com-selecao",
        instrucao: '"Exibir Caixa de Seleção" no índice de documentos.',
        opcional: true,
        automatico: async (m) => {
          if (!(await clicarPorTexto(m.pagina, TELA.exibirSelecao))) return false;
          await m.pagina.waitForTimeout(1_500);
          return true;
        },
      },
      {
        etapa: "opcoes-de-download",
        instrucao: 'Ícone "Baixar o Processo Atual em PDF" (o robô só abre a pergunta e cancela).',
        opcional: true,
        automatico: async (m) => {
          if (!(await clicarPorTexto(m.pagina, TELA.baixarProcesso))) return false;
          await m.pagina.waitForTimeout(2_000);
          return true;
        },
        // A pergunta "Deseja salvar uma cópia…" fica registrada; o robô cancela, sem salvar.
        depois: async (m) => {
          if (!(await clicarPorTexto(m.pagina, TELA.cancelar).catch(() => false))) await m.pagina.keyboard.press("Escape").catch(() => undefined);
        },
      },
    ];
    for (const passo of depois) await mapa.seguir(passo);
  } finally {
    await mapa.concluir(observacoes);
  }
}

/** Quanto esperar o índice do visualizador e o resultado da pesquisa. */
const ESPERA_TELA_MS = 60_000;

/** Seletores vistos no mapa de 18/11/2026 (detalhes em dcp-tjrj-urls.ts). */
const CONSULTA = {
  abaPorNumero: "#nav-porNumero",
  numeracaoUnica: "#numeracaoUnica",
  numero: 'input[name="numeroProcesso"]',
  sufixo: "#inputSufixoUnica3",
  pesquisar: "#botaoPesquisarProcesso",
  visualizador: /Processo Eletr[ôo]nico/i,
} as const;

const VISUALIZADOR = {
  caixa: "mat-checkbox[aria-roledescription]",
  marcada: "mat-checkbox-checked",
  clicavel: ".mat-checkbox-inner-container",
  exibirSelecao: "Exibir caixa de seleção",
  baixar: "Baixar o processo atual em PDF",
  salvarSelecionados: /^\s*Salvar Documentos Selecionados\s*$/i,
} as const;

/**
 * DCP do TJRJ (Portal de Serviços), com as telas vistas no mapa. O "Próprio" do TJRJ no cadastro chega aqui.
 * 1. login sempre da pessoa (usuário e senha com duplo fator, ou certificado), na janela do robô; o portal logado
 *    abre numa janela própria, que o robô reaproveita nos pedidos seguintes;
 * 2. consulta por número no iframe da consulta processual, até "Detalhes do Processo";
 * 3. processo migrado para o eproc: segue no conector eproc:TJRJ, no mesmo pedido, e avisa o ORQESTRAI;
 * 4. segredo de justiça sem liberação: para;
 * 5. visualizador (aba nova): marca no índice só as peças novas (ou o processo inteiro, no primeiro download) e
 *    usa "Salvar Documentos Selecionados".
 */
export class ConectorDcpTjrj implements Conector {
  readonly chave = "dcp:TJRJ";

  /** O eproc do TJRJ, para os processos que o DCP diz terem migrado. */
  constructor(private readonly eproc?: Conector) {}

  /** A aba do portal já logada, se houver. */
  private abaDoPortal(ambiente: Ambiente): Page | null {
    return ambiente.contexto.pages().find((aba) => !aba.isClosed() && ehAreaLogadaDcp(aba.url())) ?? null;
  }

  async entrar(ambiente: Ambiente): Promise<void> {
    if (this.abaDoPortal(ambiente)) return;
    await entrarComAPessoa(ambiente, opcoesDeLogin());
  }

  /** Abre a consulta processual na aba do portal e devolve o iframe dela. Com a sessão vencida, chama a pessoa uma vez. */
  private async consulta(ambiente: Ambiente): Promise<{ portal: Page; quadro: Frame }> {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const portal = this.abaDoPortal(ambiente) ?? (await entrarComAPessoa(ambiente, opcoesDeLogin()));
      await portal.goto(CONSULTA_PROCESSUAL_DCP, { waitUntil: "domcontentloaded" }).catch(() => undefined);
      const limite = Date.now() + ESPERA_TELA_MS;
      let voltouABusca = false;
      while (Date.now() < limite && ehAreaLogadaDcp(portal.url())) {
        const quadro = portal.frames().find((item) => ehQuadroDaConsultaDcp(item.url()));
        if (quadro && (await quadro.locator(CONSULTA.abaPorNumero).count().catch(() => 0))) return { portal, quadro };
        // O iframe ficou em outra tela (os detalhes do processo anterior): volta para a busca.
        if (quadro && !voltouABusca && !/\/consultaportal/i.test(quadro.url())) {
          voltouABusca = true;
          await quadro.goto(QUADRO_DA_CONSULTA_DCP, { waitUntil: "domcontentloaded" }).catch(() => undefined);
        }
        await portal.waitForTimeout(500);
      }
      // Saiu do portal (sessão vencida volta para a página inicial do tribunal): login de novo, uma vez.
      if (ehAreaLogadaDcp(portal.url())) break;
    }
    const aba = this.abaDoPortal(ambiente) ?? ambiente.pagina;
    const captura = await ambiente.diagnostico(aba, "dcp consulta");
    throw new FalhaDoConector(`A consulta processual do ${SISTEMA} não abriu. Diagnóstico guardado em ${captura}.`);
  }

  /** Pesquisa pelo número e espera "Detalhes do Processo". Devolve o texto dos detalhes. */
  private async pesquisar(ambiente: Ambiente, portal: Page, quadro: Frame, partes: PartesDoCnjTjrj): Promise<string> {
    const falhar = async (oQue: string): Promise<never> => {
      const captura = await ambiente.diagnostico(portal, "dcp pesquisa");
      throw new FalhaDoConector(`${oQue} Diagnóstico guardado em ${captura}.`);
    };
    // A página do portal cobre o iframe para o mouse: tudo vai por foco, teclado e evento de clique.
    await quadro.locator(CONSULTA.abaPorNumero).dispatchEvent("click");
    await quadro.locator(CONSULTA.numeracaoUnica).dispatchEvent("click");
    await portal.waitForTimeout(500);
    const numero = quadro.locator(CONSULTA.numero).locator("visible=true").first();
    const sufixo = quadro.locator(CONSULTA.sufixo).locator("visible=true").first();
    await numero.fill("");
    await sufixo.fill("");
    await numero.focus();
    // O campo pula sozinho para o sufixo ao completar os 13 dígitos.
    await numero.pressSequentially(partes.inicio.replace(/\D/g, ""), { delay: 30 });
    if ((await sufixo.inputValue()) !== partes.origem) {
      await sufixo.fill("");
      await sufixo.focus();
      await sufixo.pressSequentially(partes.origem, { delay: 30 });
    }
    if ((await numero.inputValue()) !== partes.inicio || (await sufixo.inputValue()) !== partes.origem) await falhar(`Não consegui digitar o número ${partes.mascarado} na consulta do ${SISTEMA}.`);
    await quadro.locator(CONSULTA.pesquisar).locator("visible=true").first().dispatchEvent("click");

    const limite = Date.now() + ESPERA_TELA_MS;
    while (Date.now() < limite) {
      await portal.waitForTimeout(700);
      const texto = await quadro.locator("body").innerText().catch(() => "");
      if (migradoParaEproc(texto)) return texto;
      if (/detalhes-processo/i.test(quadro.url()) && texto.includes(partes.mascarado)) return texto;
      if (/n[ãa]o (foi )?encontrad|nenhum processo/i.test(texto)) await falhar(`O processo ${partes.mascarado} não foi encontrado no ${SISTEMA}.`);
      // Mais de um resultado (instâncias): abre o do número.
      const link = quadro.locator("a").filter({ hasText: partes.mascarado });
      if (!/detalhes-processo/i.test(quadro.url()) && (await link.count().catch(() => 0)) > 0) await link.first().dispatchEvent("click");
    }
    return falhar(`A pesquisa do processo ${partes.mascarado} não chegou aos Detalhes do Processo no ${SISTEMA}.`);
  }

  /** Abre o visualizador (aba nova) e espera o índice. */
  private async abrirVisualizador(ambiente: Ambiente, portal: Page, quadro: Frame): Promise<Page> {
    const botao = quadro.getByRole("button", { name: CONSULTA.visualizador }).first();
    if (!(await botao.count().catch(() => 0))) {
      const captura = await ambiente.diagnostico(portal, "dcp visualizador");
      throw new FalhaDoConector(`Os Detalhes do Processo no ${SISTEMA} não têm o botão do processo eletrônico (processo físico ou só no antigo visualizador): anexe o PDF à mão. Diagnóstico em ${captura}.`);
    }
    const rotulo = (await botao.innerText().catch(() => "")).replace(/\s+/g, " ");
    if (visualizadorDoBotao(rotulo) === "antigo") {
      throw new FalhaDoConector(`O ${SISTEMA} só oferece o Antigo Visualizador para este processo (processo volumoso), que o robô ainda não sabe baixar: anexe o PDF à mão.`);
    }
    const nova = ambiente.contexto.waitForEvent("page", { predicate: (aba) => ehVisualizadorDcp(aba.url()) || aba.url() === "about:blank", timeout: 30_000 }).catch(() => null);
    await botao.dispatchEvent("click");
    const aba = (await nova) ?? ambiente.contexto.pages().find((item) => !item.isClosed() && ehVisualizadorDcp(item.url())) ?? null;
    if (!aba) {
      const captura = await ambiente.diagnostico(portal, "dcp visualizador");
      throw new FalhaDoConector(`O visualizador de autos do ${SISTEMA} não abriu. Diagnóstico em ${captura}.`);
    }
    await aba.waitForURL((url) => ehVisualizadorDcp(url.toString()), { timeout: 30_000 }).catch(() => undefined);
    try {
      await aba.locator("mat-nested-tree-node").first().waitFor({ state: "attached", timeout: ESPERA_TELA_MS });
    } catch {
      const captura = await ambiente.diagnostico(aba, "dcp indice");
      await aba.close().catch(() => undefined);
      throw new FalhaDoConector(`O índice de documentos do visualizador do ${SISTEMA} não carregou. Diagnóstico em ${captura}.`);
    }
    // As caixas de seleção só existem com "Exibir caixa de seleção" ligado.
    if (!(await aba.locator(VISUALIZADOR.caixa).count())) {
      await aba.getByRole("button", { name: VISUALIZADOR.exibirSelecao }).click();
      await aba.locator(VISUALIZADOR.caixa).first().waitFor({ state: "attached", timeout: 15_000 });
    }
    return aba;
  }

  private async rotulosDoIndice(visualizador: Page): Promise<string[]> {
    return visualizador.locator(VISUALIZADOR.caixa).evaluateAll((caixas) => caixas.map((caixa) => caixa.getAttribute("aria-roledescription") ?? ""));
  }

  private async marcada(visualizador: Page, indice: number): Promise<boolean> {
    return ((await visualizador.locator(VISUALIZADOR.caixa).nth(indice).getAttribute("class")) ?? "").includes(VISUALIZADOR.marcada);
  }

  /**
   * Marca as peças pedidas, na ordem do índice. Marcar um item com filhos marca os filhos junto (a árvore é de
   * seleção em cascata): quem já ficou marcado não é clicado de novo. Devolve se todas ficaram marcadas.
   */
  private async marcar(visualizador: Page, documentos: DocumentoDoIndiceDcp[]): Promise<boolean> {
    for (const documento of documentos) {
      if (await this.marcada(visualizador, documento.indice)) continue;
      await visualizador.locator(VISUALIZADOR.caixa).nth(documento.indice).locator(VISUALIZADOR.clicavel).first().click();
      await visualizador.waitForTimeout(150);
    }
    for (const documento of documentos) if (!(await this.marcada(visualizador, documento.indice))) return false;
    return true;
  }

  async baixar(ambiente: Ambiente, pedido: Pedido, destino: string): Promise<ResultadoDoDownload> {
    const partes = partesDoCnjTjrj(pedido.cnj);
    if (!partes) throw new FalhaDoConector(`Número de processo inválido para o DCP do TJRJ: ${pedido.cnj}.`);
    const { portal, quadro } = await this.consulta(ambiente);
    const detalhes = await this.pesquisar(ambiente, portal, quadro, partes);
    if (migradoParaEproc(detalhes)) {
      if (!this.eproc) throw new MigradoParaEproc("eproc:TJRJ", `O processo ${partes.mascarado} foi migrado para o eproc: os autos vêm pelo eproc do TJRJ.`);
      ambiente.registrar(`O ${SISTEMA} diz que ${partes.mascarado} foi migrado para o eproc. Seguindo pelo eproc do TJRJ.`);
      const doEproc = await this.eproc.baixar(ambiente, pedido, destino);
      return { ...(doEproc ?? {}), sistema: "eproc" };
    }
    if (emSegredoDcp(detalhes) && !pedido.segredoLiberado) throw new SegredoDeJustica();

    const visualizador = await this.abrirVisualizador(ambiente, portal, quadro);
    try {
      const documentos = documentosDoIndiceDcp(await this.rotulosDoIndice(visualizador));
      if (!documentos.length) {
        const captura = await ambiente.diagnostico(visualizador, "dcp indice");
        throw new FalhaDoConector(`O índice do visualizador do ${SISTEMA} veio sem peças numeradas. Diagnóstico em ${captura}.`);
      }
      const novos = documentosNovosDcp(documentos, pedido.pecasBaixadas);
      if (!novos.length) {
        ambiente.registrar(`${documentos.length} peças no visualizador do DCP, todas já baixadas antes: nada novo.`);
        return { semNovidades: true };
      }
      if (novos.length < documentos.length) ambiente.registrar(`${novos.length} peças novas de ${documentos.length} no DCP. Baixando só as novas.`);
      if (!(await this.marcar(visualizador, novos))) {
        const captura = await ambiente.diagnostico(visualizador, "dcp selecao");
        throw new FalhaDoConector(`Não consegui marcar as peças no índice do visualizador do ${SISTEMA}. Diagnóstico em ${captura}.`);
      }
      await visualizador.getByRole("button", { name: VISUALIZADOR.baixar }).click();
      const salvar = visualizador.locator("mat-dialog-container").getByRole("button", { name: VISUALIZADOR.salvarSelecionados });
      await salvar.waitFor({ state: "visible", timeout: 15_000 });
      try {
        const [arquivo] = await Promise.all([visualizador.waitForEvent("download", { timeout: ambiente.config.geracaoPdfMs }), salvar.click()]);
        const falha = await arquivo.failure();
        if (falha) throw new FalhaDoConector(`O download do PDF foi interrompido (${falha}).`);
        await arquivo.saveAs(destino);
        await arquivo.delete().catch(() => undefined);
      } catch (erro) {
        if (erro instanceof FalhaDoConector) throw erro;
        const captura = await ambiente.diagnostico(visualizador, "dcp download");
        throw new FalhaDoConector(`O download dos autos não terminou no visualizador do ${SISTEMA}. Diagnóstico em ${captura}.`);
      }
      await conferirPdf(destino);
      return { pecas: novos.map((documento) => documento.chave) };
    } finally {
      // O visualizador é uma aba por processo: fecha. A aba do portal fica, com a sessão.
      await visualizador.close().catch(() => undefined);
    }
  }

  /** npm run inspecionar -- dcp <CNJ>: consulta, detalhes e índice do visualizador, sem baixar. */
  async inspecionar(ambiente: Ambiente, cnj: string): Promise<void> {
    const partes = partesDoCnjTjrj(cnj);
    if (!partes) throw new FalhaDoConector(`O DCP é do TJRJ: o número precisa ser 0000000-00.0000.8.19.0000 (recebi ${cnj}).`);
    const { portal, quadro } = await this.consulta(ambiente);
    const detalhes = await this.pesquisar(ambiente, portal, quadro, partes);
    if (migradoParaEproc(detalhes)) {
      ambiente.registrar(`${partes.mascarado}: migrado para o eproc (os autos vêm pelo eproc do TJRJ).`);
      return;
    }
    ambiente.registrar(`${partes.mascarado}: detalhes abertos. Segredo de justiça pelo texto: ${emSegredoDcp(detalhes) ? "sim (ou ambíguo)" : "não"}.`);
    const visualizador = await this.abrirVisualizador(ambiente, portal, quadro);
    try {
      const documentos = documentosDoIndiceDcp(await this.rotulosDoIndice(visualizador));
      ambiente.registrar(`${documentos.length} peças numeradas no índice. Primeiras: ${documentos.slice(0, 3).map((item) => item.rotulo).join(" | ")}. Últimas: ${documentos.slice(-3).map((item) => item.rotulo).join(" | ")}.`);
      ambiente.registrar(`Captura: ${await ambiente.diagnostico(visualizador, "dcp inspecionar")}`);
    } finally {
      await visualizador.close().catch(() => undefined);
    }
  }
}
