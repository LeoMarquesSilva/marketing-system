import type { Page } from "playwright";
import type { Pedido } from "../fila.ts";
import { conferirPdf, visivel } from "./comum.ts";
import { migradoParaEproc } from "./dcp-tjrj-urls.ts";
import { Mapeamento, assentar, clicarPorTexto, entrarComAPessoa, preencherPrimeiro, type OpcoesDeLogin, type PassoDoMapa } from "./mapeamento.ts";
import {
  camposCnjPje,
  chaveDaPecaPje,
  downloadEmSegundoPlano,
  ehAreaLogadaPje,
  ehAutosDigitais,
  emSegredoPje,
  idDoDocumentoPje,
  idInicialDoIncremental,
  instanciaPjeTjrj,
  urlDaConsultaPje,
  urlDeLoginPje,
  type CamposCnjPje,
  type InstanciaPje,
} from "./pje-urls.ts";
import { FalhaDoConector, SegredoDeJustica, type Ambiente, type Conector, type ResultadoDoDownload } from "./tipos.ts";

/**
 * PJe do TJRJ. RASCUNHO, DESLIGADO: não está em CONECTORES (src/index.ts) nem em CONECTORES_DISPONIVEIS
 * (ORQESTRAI), e assim fica até as telas reais serem vistas com `npm run mapear -- pje <CNJ>`. O que se sabe de
 * cada tela, e de onde veio, está em pje-urls.ts.
 *
 * Desenho previsto:
 * 1. login sempre da pessoa (CPF e senha, ou certificado pelo PJe Office, mais o código do Microsoft
 *    Authenticator), na janela do robô. O PJe Office é um programa da máquina: o robô não o controla;
 * 2. "Consultar processo" com o número; o número abre os Autos Digitais em outra aba;
 * 3. processo migrado para o eproc: erro dizendo para pedir pelo eproc; segredo de justiça sem liberação: para;
 * 4. "Download autos do processo" (por Id, Período ou tudo), com "Id a partir de" = maior id já baixado + 1 para
 *    trazer só o novo. Se o PJe montar o PDF em segundo plano (aviso em vez de arquivo), o rascunho para com erro:
 *    esse caminho só será escrito depois do mapa.
 */

/** Seletores e textos. SUPOSIÇÃO em tudo que não é texto de manual: ids do PJe nacional (JSF), a conferir no mapa. */
const TELA = {
  /** Código do segundo fator (Keycloak do SSO da PDPJ ou tela do próprio PJe). */
  codigo: "#otp, input[name=otp], input[name=totp], input[autocomplete='one-time-code'], input[id*='codigo' i][maxlength='6']",
  menuProcesso: /^Processo$/i,
  consultarProcesso: /^(Consultar processo|Pesquisar processo|Consultar Processos)$/i,
  campos: {
    sequencial: ["input[id$='numeroSequencial']", "input[id*='numeroSequencial' i]"],
    digito: ["input[id$='numeroDigitoVerificador']", "input[id*='DigitoVerificador' i]"],
    ano: ["input[id$='Ano']", "input[id*='numeroAno' i]"],
    ramo: ["input[id$='ramoJustica']", "input[id*='ramoJustica' i]"],
    tribunal: ["input[id$='respectivoTribunal']", "input[id*='respectivoTribunal' i]"],
    origem: ["input[id$='NumeroOrgaoJustica']", "input[id*='OrgaoJustica' i]"],
    inteiro: ["input[id*='numeroProcesso' i]:not([id*='Sequencial' i])", "input[placeholder*='0000000-00' i]"],
  },
  pesquisar: /^Pesquisar$/i,
  /** Ícone que abre as opções de download dos autos (por Id, Período ou tudo). */
  abrirDownload: /Download autos do processo|Download do processo|Baixar (os )?autos/i,
  idInicial: ["input[id*='idDocumentoInicial' i]", "input[id*='IdInicial' i]", "input[id*='id_doc' i]"],
  botaoDownload: /^Download$/i,
} as const;

function sistemaDe(instancia: InstanciaPje): string {
  return `PJe do TJRJ (${instancia.rotulo})`;
}

function opcoesDeLogin(instancia: InstanciaPje, extra: Partial<OpcoesDeLogin> = {}): OpcoesDeLogin {
  return {
    sistema: sistemaDe(instancia),
    urlDeLogin: urlDeLoginPje(instancia),
    logado: (url) => ehAreaLogadaPje(url, instancia),
    instrucao: () =>
      instancia.sso
        ? `Entre no ${sistemaDe(instancia)} na janela do robô: CPF e senha do advogado, ou "CERTIFICADO DIGITAL" (com o PJe Office aberto nesta máquina). Depois, o código do Microsoft Authenticator, se pedir.`
        : `Entre no ${sistemaDe(instancia)} na janela do robô (login próprio do 2º grau: CPF e senha, ou certificado pelo PJe Office).`,
    pedeCodigo: (pagina) => visivel(pagina, TELA.codigo),
    ...extra,
  };
}

/** Número na consulta: os campos separados do PJe, ou um campo só. */
async function preencherNumero(pagina: Page, campos: CamposCnjPje): Promise<boolean> {
  if (await preencherPrimeiro(pagina, TELA.campos.sequencial, campos.sequencial)) {
    await preencherPrimeiro(pagina, TELA.campos.digito, campos.digito);
    await preencherPrimeiro(pagina, TELA.campos.ano, campos.ano);
    // Ramo e tribunal costumam vir preenchidos (8 e 19); se estiverem editáveis, vão de novo.
    await preencherPrimeiro(pagina, TELA.campos.ramo, campos.ramo);
    await preencherPrimeiro(pagina, TELA.campos.tribunal, campos.tribunal);
    return preencherPrimeiro(pagina, TELA.campos.origem, campos.origem);
  }
  return preencherPrimeiro(pagina, TELA.campos.inteiro, campos.mascarado);
}

/** Abre a consulta pelo endereço; sem ela, pelo menu "Processo". */
async function abrirConsulta(pagina: Page, instancia: InstanciaPje): Promise<boolean> {
  await pagina.goto(urlDaConsultaPje(instancia), { waitUntil: "domcontentloaded" }).catch(() => undefined);
  await assentar(pagina);
  if (await visivel(pagina, [...TELA.campos.sequencial, ...TELA.campos.inteiro].join(", "))) return true;
  if (!(await clicarPorTexto(pagina, TELA.menuProcesso))) return false;
  await pagina.waitForTimeout(800);
  if (!(await clicarPorTexto(pagina, TELA.consultarProcesso))) return false;
  await assentar(pagina);
  return visivel(pagina, [...TELA.campos.sequencial, ...TELA.campos.inteiro].join(", "));
}

/** Clica no número do processo no resultado; os autos digitais abrem em outra aba. Devolve a aba deles. */
async function abrirAutos(ambiente: Ambiente, pagina: Page, mascarado: string): Promise<Page | null> {
  const link = pagina.locator("a").filter({ hasText: mascarado });
  if ((await link.count().catch(() => 0)) < 1) return null;
  const janela = ambiente.contexto.waitForEvent("page", { timeout: 25_000 }).catch(() => null);
  await link.first().click();
  const aba = (await janela) ?? pagina;
  await assentar(aba, 3_000);
  return aba;
}

/** Roteiro do `npm run mapear -- pje <CNJ> [2g]`. */
export async function mapearPje(ambiente: Ambiente, numero: string, grau: "1g" | "2g" = "1g"): Promise<void> {
  const campos = camposCnjPje(numero);
  if (!campos) throw new FalhaDoConector(`Por ora o mapear do PJe é do TJRJ: o número precisa ser 0000000-00.0000.8.19.0000 (recebi ${numero}).`);
  const instancia = instanciaPjeTjrj(grau);
  const mapa = new Mapeamento(ambiente, `pje-${grau}`, campos.mascarado);
  const observacoes: string[] = [];
  await mapa.iniciar();
  try {
    mapa.pagina = await entrarComAPessoa(
      ambiente,
      opcoesDeLogin(instancia, {
        confirmouNoTerminal: mapa.confirmacaoNoTerminal(),
        aoVerTela: async (pagina, tela) => {
          await mapa.registrarTela(tela === "codigo" ? "login-codigo" : "login", undefined, pagina);
        },
      })
    );
    mapa.loginConcluido();
    await assentar(mapa.pagina);
    const passos: PassoDoMapa[] = [
      {
        etapa: "painel",
        instrucao: "Se o PJe pedir para escolher o perfil ou a localização, escolha o de advogado.",
        automatico: async () => true,
      },
      {
        etapa: "consulta",
        instrucao: 'Abra a consulta de processos ("Processo" > "Consultar processo", ou a aba "Consultar Processos").',
        automatico: (m) => abrirConsulta(m.pagina, instancia),
      },
      {
        etapa: "pesquisa-por-numero",
        instrucao: `Digite o número ${campos.mascarado} na consulta (ainda sem pesquisar).`,
        automatico: (m) => preencherNumero(m.pagina, campos),
      },
      {
        etapa: "resultado",
        instrucao: "Clique em Pesquisar e espere o resultado.",
        automatico: async (m) => {
          if (!(await clicarPorTexto(m.pagina, TELA.pesquisar, "button, input[type=button], input[type=submit], a"))) return false;
          await assentar(m.pagina, 3_000);
          return (await m.texto()).includes(campos.mascarado);
        },
      },
      {
        etapa: "autos-digitais",
        instrucao: `Clique no número ${campos.mascarado} para abrir os Autos Digitais (abre outra aba) e espere carregar.`,
        automatico: async (m) => {
          const aba = await abrirAutos(ambiente, m.pagina, campos.mascarado);
          return Boolean(aba && ehAutosDigitais(aba.url()));
        },
      },
    ];
    for (const passo of passos) await mapa.seguir(passo);

    const autos = await mapa.texto();
    if (migradoParaEproc(autos)) {
      observacoes.push("Processo migrado para o eproc: o pedido deste processo deve ir ao conector eproc:TJRJ.");
      ambiente.registrar("O PJe diz que este processo foi migrado para o eproc: o eproc:TJRJ já baixa os autos dele. O mapa para aqui.");
      return;
    }
    observacoes.push(`Autos digitais no endereço esperado (listAutosDigitais.seam): ${ehAutosDigitais(mapa.pagina.url()) ? "sim" : "não"}.`);
    observacoes.push(`Segredo de justiça pelo cabeçalho: ${emSegredoPje(autos) ? "sim (ou ambíguo)" : "não"}.`);
    const ids = await mapa.pagina
      .locator("a[href]")
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))
      .catch(() => [] as string[]);
    const comId = ids.map(idDoDocumentoPje).filter((id): id is number => id !== null);
    observacoes.push(`Links com id de documento reconhecido: ${comId.length}${comId.length ? ` (menor ${Math.min(...comId)}, maior ${Math.max(...comId)})` : ""}.`);

    await mapa.seguir({
      etapa: "opcoes-de-download",
      instrucao: 'Ícone "Download autos do processo" nos Autos Digitais (o robô só abre as opções e fecha; não clica em Download).',
      opcional: true,
      automatico: async (m) => {
        if (!(await clicarPorTexto(m.pagina, TELA.abrirDownload))) return false;
        await m.pagina.waitForTimeout(2_000);
        return true;
      },
      depois: async (m) => {
        await m.pagina.keyboard.press("Escape").catch(() => undefined);
      },
    });
  } finally {
    await mapa.concluir(observacoes);
  }
}

/** Rascunho do conector, um por instância. Não registrado: veja o comentário do topo. */
export class ConectorPjeTjrj implements Conector {
  readonly chave = "pje:TJRJ";
  constructor(private readonly instancia: InstanciaPje = instanciaPjeTjrj("1g")) {}

  async entrar(ambiente: Ambiente): Promise<void> {
    await entrarComAPessoa(ambiente, opcoesDeLogin(this.instancia));
  }

  async baixar(ambiente: Ambiente, pedido: Pedido, destino: string): Promise<ResultadoDoDownload> {
    const campos = camposCnjPje(pedido.cnj);
    if (!campos) throw new FalhaDoConector(`Número de processo inválido para o PJe do TJRJ: ${pedido.cnj}.`);
    await this.entrar(ambiente);
    const { pagina } = ambiente;
    const falhar = async (alvo: Page, etapa: string): Promise<never> => {
      const captura = await ambiente.diagnostico(alvo, `pje ${etapa}`);
      throw new FalhaDoConector(`A tela do ${sistemaDe(this.instancia)} mudou ou não carregou: não achei como ${etapa}. Diagnóstico guardado em ${captura}.`);
    };
    if (!(await abrirConsulta(pagina, this.instancia))) await falhar(pagina, "abrir a consulta");
    if (!(await preencherNumero(pagina, campos))) await falhar(pagina, "preencher o número");
    if (!(await clicarPorTexto(pagina, TELA.pesquisar, "button, input[type=button], input[type=submit], a"))) await falhar(pagina, "pesquisar");
    await assentar(pagina, 3_000);
    const autos = (await abrirAutos(ambiente, pagina, campos.mascarado)) ?? (await falhar(pagina, "abrir os autos digitais"));
    const texto = await autos
      .locator("body")
      .innerText()
      .catch(() => "");
    if (migradoParaEproc(texto)) throw new FalhaDoConector(`O processo ${campos.mascarado} foi migrado para o eproc: peça os autos pelo eproc do TJRJ.`);
    if (emSegredoPje(texto) && !pedido.segredoLiberado) throw new SegredoDeJustica();

    const ids = (
      await autos
        .locator("a[href]")
        .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))
        .catch(() => [] as string[])
    )
      .map(idDoDocumentoPje)
      .filter((id): id is number => id !== null);
    const aPartirDe = idInicialDoIncremental(pedido.pecasBaixadas);
    if (aPartirDe !== null && ids.length && Math.max(...ids) < aPartirDe) return { semNovidades: true };

    if (!(await clicarPorTexto(autos, TELA.abrirDownload))) await falhar(autos, 'abrir "Download autos do processo"');
    await autos.waitForTimeout(1_500);
    if (aPartirDe !== null) await preencherPrimeiro(autos, TELA.idInicial, String(aPartirDe));
    const botao = autos.getByRole("button", { name: TELA.botaoDownload }).first();
    try {
      const [arquivo] = await Promise.all([autos.waitForEvent("download", { timeout: ambiente.config.geracaoPdfMs }), botao.click()]);
      const falha = await arquivo.failure();
      if (falha) throw new FalhaDoConector(`O download do PDF foi interrompido (${falha}).`);
      await arquivo.saveAs(destino);
    } catch (erro) {
      if (erro instanceof FalhaDoConector) throw erro;
      const aviso = await autos
        .locator("body")
        .innerText()
        .catch(() => "");
      const captura = await ambiente.diagnostico(autos, "pje download");
      throw new FalhaDoConector(
        downloadEmSegundoPlano(aviso)
          ? `O PJe vai montar o PDF em segundo plano; o robô ainda não sabe buscá-lo depois. Diagnóstico em ${captura}.`
          : `O download dos autos não terminou no PJe. Diagnóstico em ${captura}.`
      );
    }
    await conferirPdf(destino);
    return { pecas: ids.filter((id) => aPartirDe === null || id >= aPartirDe).map(chaveDaPecaPje) };
  }

  async inspecionar(ambiente: Ambiente, cnj: string): Promise<void> {
    await mapearPje(ambiente, cnj, this.instancia.grau);
  }
}
