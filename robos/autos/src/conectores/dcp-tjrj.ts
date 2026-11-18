import type { Page } from "playwright";
import type { Pedido } from "../fila.ts";
import { conferirPdf } from "./comum.ts";
import {
  LOGIN_PORTAL_DE_SERVICOS,
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
import { FalhaDoConector, SegredoDeJustica, type Ambiente, type Conector, type ResultadoDoDownload } from "./tipos.ts";

/**
 * DCP do TJRJ (Portal de Serviços). RASCUNHO, DESLIGADO: não está em CONECTORES (src/index.ts) nem em
 * CONECTORES_DISPONIVEIS (ORQESTRAI), e assim fica até as telas reais serem vistas com `npm run mapear -- dcp <CNJ>`.
 * O que se sabe de cada tela, e de onde veio, está em dcp-tjrj-urls.ts.
 *
 * Desenho previsto (igual ao do e-SAJ, que também gera um PDF único):
 * 1. login sempre da pessoa (usuário e senha do advogado com duplo fator, ou certificado), na janela do robô;
 * 2. Consultas > Consultas Processuais > Por Número, com o número; abre os detalhes do processo;
 * 3. processo já migrado para o eproc: erro dizendo para pedir pelo eproc (o ORQESTRAI deveria mandar direto);
 * 4. segredo de justiça sem liberação: para;
 * 5. "Processo Eletrônico – Novo Visualizador" > "Baixar o Processo Atual em PDF" > "Salvar processo completo".
 *    Processo volumoso só tem o Antigo Visualizador, que ainda não foi mapeado: erro, anexar à mão.
 *
 * Sem download incremental por ora: o visualizador permite salvar só documentos selecionados, mas a identidade
 * estável de cada peça no índice ainda não é conhecida.
 */

/**
 * Seletores e textos. SUPOSIÇÃO em tudo que não é texto de manual: os nomes vêm do manual VISPROCELET (2021) e
 * do manual do Portal de Serviços; ids e classes só se saberão no mapa.
 */
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

/** Rascunho do conector. Não registrado: veja o comentário do topo. */
export class ConectorDcpTjrj implements Conector {
  /** SUPOSIÇÃO: "dcp" ainda não é um SistemaTribunal do ORQESTRAI (hoje o "Próprio" do TJRJ vira "outro" e vai ao eproc). */
  readonly chave = "dcp:TJRJ";

  async entrar(ambiente: Ambiente): Promise<void> {
    await entrarComAPessoa(ambiente, opcoesDeLogin());
  }

  private async abrirProcesso(ambiente: Ambiente, partes: PartesDoCnjTjrj): Promise<Page> {
    const { pagina } = ambiente;
    const etapa = async (nome: string, feito: boolean) => {
      if (feito) return;
      const captura = await ambiente.diagnostico(pagina, `dcp ${nome}`);
      throw new FalhaDoConector(`A tela do ${SISTEMA} mudou ou não carregou: não achei como ${nome}. Diagnóstico guardado em ${captura}.`);
    };
    await etapa("abrir Consultas", await clicarPorTexto(pagina, TELA.menuConsultas));
    await pagina.waitForTimeout(1_000);
    await etapa("abrir Consultas Processuais", await clicarPorTexto(pagina, TELA.consultasProcessuais));
    await assentar(pagina);
    await clicarPorTexto(pagina, TELA.abaPorNumero);
    await etapa("preencher o número", await preencherNumero(pagina, partes));
    await etapa("pesquisar", await clicarPorTexto(pagina, TELA.pesquisar, "button, input[type=button], input[type=submit], a"));
    await assentar(pagina, 3_000);
    if (migradoParaEproc(await pagina.locator("body").innerText().catch(() => ""))) {
      throw new FalhaDoConector(`O processo ${partes.mascarado} foi migrado para o eproc: peça os autos pelo eproc do TJRJ.`);
    }
    await etapa("abrir o processo no resultado", await abrirDetalhes(pagina, partes));
    return pagina;
  }

  async baixar(ambiente: Ambiente, pedido: Pedido, destino: string): Promise<ResultadoDoDownload> {
    const partes = partesDoCnjTjrj(pedido.cnj);
    if (!partes) throw new FalhaDoConector(`Número de processo inválido para o DCP do TJRJ: ${pedido.cnj}.`);
    await this.entrar(ambiente);
    const pagina = await this.abrirProcesso(ambiente, partes);
    const detalhes = await pagina
      .locator("body")
      .innerText()
      .catch(() => "");
    if (migradoParaEproc(detalhes)) throw new FalhaDoConector(`O processo ${partes.mascarado} foi migrado para o eproc: peça os autos pelo eproc do TJRJ.`);
    if (emSegredoDcp(detalhes) && !pedido.segredoLiberado) throw new SegredoDeJustica();

    const tipo = await abrirVisualizador(ambiente, pagina);
    if (tipo !== "novo") {
      const captura = await ambiente.diagnostico(pagina, "dcp visualizador");
      throw new FalhaDoConector(
        tipo === "antigo"
          ? `O DCP só oferece o Antigo Visualizador para este processo (processo volumoso), que o robô ainda não sabe baixar. Anexe o PDF à mão. Diagnóstico em ${captura}.`
          : `Não achei o "Processo Eletrônico – Novo Visualizador" nos detalhes do processo. Diagnóstico em ${captura}.`
      );
    }
    // O visualizador abre em outra aba: é a mais recente.
    const abas = ambiente.contexto.pages().filter((aba) => !aba.isClosed());
    const visualizador = abas[abas.length - 1];
    await assentar(visualizador, 4_000);
    if (!(await clicarPorTexto(visualizador, TELA.baixarProcesso))) {
      const captura = await ambiente.diagnostico(visualizador, "dcp baixar");
      throw new FalhaDoConector(`Não achei "Baixar o Processo Atual em PDF" no visualizador do DCP. Diagnóstico em ${captura}.`);
    }
    // SUPOSIÇÃO: "Salvar processo completo" dispara o download do navegador (e não abre o PDF em outra aba).
    const botao = visualizador.getByRole("button", { name: TELA.salvarCompleto }).first();
    try {
      const [arquivo] = await Promise.all([visualizador.waitForEvent("download", { timeout: ambiente.config.geracaoPdfMs }), botao.click()]);
      const falha = await arquivo.failure();
      if (falha) throw new FalhaDoConector(`O download do PDF foi interrompido (${falha}).`);
      await arquivo.saveAs(destino);
    } catch (erro) {
      if (erro instanceof FalhaDoConector) throw erro;
      const captura = await ambiente.diagnostico(visualizador, "dcp download");
      throw new FalhaDoConector(`O download dos autos não terminou no visualizador do DCP. Diagnóstico em ${captura}.`);
    }
    await conferirPdf(destino);
    return {};
  }

  async inspecionar(ambiente: Ambiente, cnj: string): Promise<void> {
    await mapearDcp(ambiente, cnj);
  }
}
