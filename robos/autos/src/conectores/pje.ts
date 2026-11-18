import { writeFile } from "node:fs/promises";
import type { Frame, Page } from "playwright";
import type { Pedido } from "../fila.ts";
import { conferirPdf, visivel } from "./comum.ts";
import { migradoParaEproc } from "./dcp-tjrj-urls.ts";
import { Mapeamento, assentar, clicarPorTexto, entrarComAPessoa, preencherPrimeiro, type OpcoesDeLogin, type PassoDoMapa } from "./mapeamento.ts";
import {
  camposCnjPje,
  chaveDaPecaPje,
  ehAreaLogadaPje,
  ehAutosDigitais,
  ehQuadroDaAreaDeDownload,
  emSegredoPje,
  idDoRotuloPje,
  idInicialDoIncremental,
  urlDaAreaDeDownloadPje,
  instanciaPjeTjrj,
  urlDaConsultaPje,
  urlDeLoginPje,
  type CamposCnjPje,
  type InstanciaPje,
} from "./pje-urls.ts";
import { FalhaDoConector, SegredoDeJustica, type Ambiente, type Conector, type ResultadoDoDownload } from "./tipos.ts";

/**
 * PJe do TJRJ (1º grau): o conector (ConectorPjeTjrj, no fim do arquivo) e o roteiro do
 * `npm run mapear -- pje <CNJ>`. O que se sabe de cada tela está em pje-urls.ts.
 */

/** Seletores e textos do roteiro do mapa (o conector usa os ids vistos nas telas, mais abaixo). */
const TELA = {
  /** Botão "CERTIFICADO DIGITAL" do SSO da PDPJ (chama o PJe Office). */
  certificadoPdpj: "#kc-pje-office",
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

/**
 * Login do conector (o mapear usa o de cima, que não digita nada): no 1º grau, que passa pelo SSO da PDPJ, o código
 * do Microsoft Authenticator sai do segredo "pdpj" do painel de robôs, se houver. CPF e senha continuam com a pessoa.
 */
function loginDoConector(instancia: InstanciaPje, pjeOffice: boolean): OpcoesDeLogin {
  if (!instancia.sso) return opcoesDeLogin(instancia);
  return opcoesDeLogin(instancia, {
    // Com o PJe Office do robô (servidor, A1 do painel), o próprio robô clica em "CERTIFICADO DIGITAL".
    ...(pjeOffice && {
      entrarSozinho: async (pagina: Page) => {
        const botao = pagina.locator(TELA.certificadoPdpj).first();
        if (!(await botao.isVisible().catch(() => false))) return false;
        await botao.click().catch(() => undefined);
        return true;
      },
    }),
    sistema2fa: "pdpj",
    digitarCodigo: async (pagina, codigo) => {
      const campo = pagina.locator(TELA.codigo).first();
      await campo.fill(codigo);
      await campo.press("Enter");
    },
  });
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
    observacoes.push(`Autos digitais no endereço esperado: ${ehAutosDigitais(mapa.pagina.url()) ? "sim" : "não"}.`);
    observacoes.push(`Segredo de justiça pelo cabeçalho: ${emSegredoPje(autos) ? "sim (ou ambíguo)" : "não"}.`);
    const rotulos = await mapa.pagina
      .locator("a")
      .evaluateAll((links) => links.map((link) => (link.textContent ?? "").replace(/\s+/g, " ").trim()))
      .catch(() => [] as string[]);
    const comId = rotulos.map(idDoRotuloPje).filter((id): id is number => id !== null);
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

/**
 * Links de PDF que o PJe abre com window.open na aba dos autos quando termina de montar o download (no TJRJ, um
 * link assinado do armazenamento de documentos, com o número do processo no nome do arquivo).
 */
async function linksDoPdf(autos: Page, mascarado: string): Promise<string[]> {
  const html = await autos.content().catch(() => "");
  return [...html.matchAll(/window\.open\(\s*['"](https:\/\/[^'"]+?\.pdf(?:\?[^'"]*)?)['"]/gi)].map((achado) => achado[1].replace(/&amp;/g, "&")).filter((link) => link.includes(mascarado));
}

/** Ids vistos nas telas do 1º grau do TJRJ em 18/11/2026. */
const PJE = {
  campo: (nome: "numeroSequencial" | "numeroDigitoVerificador" | "Ano" | "NumeroOrgaoJustica") => `[id="fPP:numeroProcesso:${nome}"]`,
  pesquisar: '[id="fPP:searchProcessos"]',
  abrirDownload: 'a[title="Download autos do processo"]',
  idDe: '[id="navbar:idDe"]',
  botaoDownload: 'input[type="button"][value="Download"]',
} as const;

/** Quanto esperar a pesquisa e a montagem do PDF na Área de download (entre uma olhada e outra). */
const ESPERA_TELA_MS = 60_000;
const INTERVALO_AREA_MS = 10_000;

/**
 * PJe do TJRJ (1º grau), com as telas vistas no mapa:
 * 1. login sempre da pessoa (SSO da PDPJ: CPF e senha com o código do Microsoft Authenticator, PJe Office ou gov.br),
 *    numa aba própria do robô, que fica aberta para os pedidos seguintes;
 * 2. consulta por número (campos separados); a situação na lista já diz se o processo migrou para o eproc, e aí o
 *    pedido segue pelo eproc:TJRJ, como no DCP;
 * 3. o número abre os autos em outra aba; a linha do tempo mostra os documentos com o Id ("273922481 - Certidão");
 * 4. "Download autos do processo" com "ID a partir de" = maior Id já baixado + 1 (o filtro respeita a faixa). O PJe
 *    monta o PDF e o abre com window.open (que o Chrome barra como popup): o robô pega o link na aba dos autos.
 *    Às vezes o PDF vai para a Área de download; aí o robô baixa de lá quando fica "Concluído", reconhecendo a
 *    linha nova pelas que já existiam antes de pedir.
 */
export class ConectorPjeTjrj implements Conector {
  readonly chave = "pje:TJRJ";

  constructor(
    /** O eproc do TJRJ, para os processos que o PJe diz terem migrado. */
    private readonly eproc?: Conector,
    private readonly instancia: InstanciaPje = instanciaPjeTjrj("1g")
  ) {}

  /** A aba do PJe já logada (fora dos autos, que são uma aba por processo), se houver. */
  private abaDoPje(ambiente: Ambiente): Page | null {
    return ambiente.contexto.pages().find((aba) => !aba.isClosed() && ehAreaLogadaPje(aba.url(), this.instancia) && !ehAutosDigitais(aba.url())) ?? null;
  }

  async entrar(ambiente: Ambiente): Promise<void> {
    if (this.abaDoPje(ambiente)) return;
    await this.aba(ambiente);
  }

  /** Aba do PJe logada. Sem ela, abre uma aba nova no login e espera a pessoa (a aba do DCP e a do robô ficam). */
  private async aba(ambiente: Ambiente): Promise<Page> {
    const aberta = this.abaDoPje(ambiente);
    if (aberta) return aberta;
    const nova = await ambiente.contexto.newPage();
    return entrarComAPessoa({ ...ambiente, pagina: nova }, loginDoConector(this.instancia, ambiente.config.pjeOffice));
  }

  private falha(ambiente: Ambiente, alvo: Page, oQue: string): Promise<never> {
    return ambiente.diagnostico(alvo, "pje").then((captura) => {
      throw new FalhaDoConector(`${oQue} Diagnóstico guardado em ${captura}.`);
    });
  }

  /** Pesquisa o número; devolve a aba e o texto da linha do processo no resultado. Com a sessão vencida, login uma vez. */
  private async pesquisar(ambiente: Ambiente, campos: CamposCnjPje): Promise<{ pagina: Page; linha: string }> {
    let pagina = await this.aba(ambiente);
    await pagina.goto(urlDaConsultaPje(this.instancia), { waitUntil: "domcontentloaded" }).catch(() => undefined);
    if (!ehAreaLogadaPje(pagina.url(), this.instancia)) {
      // Sessão vencida: o PJe mandou para o SSO. A pessoa entra de novo nesta aba.
      pagina = await entrarComAPessoa({ ...ambiente, pagina }, loginDoConector(this.instancia, ambiente.config.pjeOffice));
      await pagina.goto(urlDaConsultaPje(this.instancia), { waitUntil: "domcontentloaded" }).catch(() => undefined);
    }
    const sequencial = pagina.locator(PJE.campo("numeroSequencial"));
    try {
      await sequencial.waitFor({ state: "visible", timeout: ESPERA_TELA_MS });
    } catch {
      return this.falha(ambiente, pagina, `A consulta de processos do ${sistemaDe(this.instancia)} não abriu.`);
    }
    await sequencial.fill(campos.sequencial);
    await pagina.locator(PJE.campo("numeroDigitoVerificador")).fill(campos.digito);
    await pagina.locator(PJE.campo("Ano")).fill(campos.ano);
    await pagina.locator(PJE.campo("NumeroOrgaoJustica")).fill(campos.origem);
    await pagina.locator(PJE.pesquisar).click();
    const limite = Date.now() + ESPERA_TELA_MS;
    while (Date.now() < limite) {
      await pagina.waitForTimeout(1_000);
      const linhas = await pagina.locator("tbody tr").evaluateAll((itens) => itens.map((item) => (item as HTMLElement).innerText.replace(/\s+/g, " ").trim()));
      const linha = linhas.find((texto) => texto.includes(campos.mascarado));
      if (linha) return { pagina, linha };
      const corpo = await pagina.locator("body").innerText().catch(() => "");
      if (/nenhum (registro|processo|resultado) encontrado|n[ãa]o foram encontrad/i.test(corpo)) {
        throw new FalhaDoConector(`O processo ${campos.mascarado} não foi encontrado no ${sistemaDe(this.instancia)} (o advogado pode não ter acesso a ele).`);
      }
    }
    return this.falha(ambiente, pagina, `A pesquisa de ${campos.mascarado} não trouxe resultado no ${sistemaDe(this.instancia)}.`);
  }

  /** Clica no número do processo no resultado: os autos abrem em outra aba. */
  private async abrirAutos(ambiente: Ambiente, pagina: Page, campos: CamposCnjPje): Promise<Page> {
    const link = pagina.locator("tbody tr").filter({ hasText: campos.mascarado }).locator(`a[title="${campos.mascarado}"]`).first();
    // O PJe abre os autos numa janela com nome fixo: se sobrou uma aberta, ele a reaproveita em vez de abrir outra.
    for (const aba of ambiente.contexto.pages()) if (ehAutosDigitais(aba.url())) await aba.close().catch(() => undefined);
    const janela = ambiente.contexto.waitForEvent("page", { timeout: 30_000 }).catch(() => null);
    await link.click();
    const autos = await janela;
    if (!autos) return this.falha(ambiente, pagina, `Os autos de ${campos.mascarado} não abriram no ${sistemaDe(this.instancia)}.`);
    await autos.waitForURL((url) => ehAutosDigitais(url.toString()), { timeout: 30_000 }).catch(() => undefined);
    try {
      await autos.locator(PJE.abrirDownload).waitFor({ state: "attached", timeout: ESPERA_TELA_MS });
    } catch {
      return this.falha(ambiente, autos, `Os autos de ${campos.mascarado} abriram sem o ícone de download no ${sistemaDe(this.instancia)}.`);
    }
    // A linha do tempo carrega depois do cabeçalho.
    await autos.waitForTimeout(2_000);
    return autos;
  }

  /** Ids dos documentos na linha do tempo ("273922481 - Certidão de Migração"). */
  private async idsDosAutos(autos: Page): Promise<number[]> {
    const rotulos = await autos.locator("a").evaluateAll((links) => links.map((link) => (link.textContent ?? "").replace(/\s+/g, " ").trim()));
    return [...new Set(rotulos.map(idDoRotuloPje).filter((id): id is number => id !== null))];
  }

  /** O iframe da Área de download, na aba do PJe. */
  private async areaDeDownload(pagina: Page): Promise<Frame | null> {
    await pagina.goto(urlDaAreaDeDownloadPje(this.instancia), { waitUntil: "domcontentloaded" }).catch(() => undefined);
    for (let tentativa = 0; tentativa < 40; tentativa += 1) {
      const quadro = pagina.frames().find((item) => ehQuadroDaAreaDeDownload(item.url()));
      // A tabela (mesmo vazia) tem cabeçalho com "Processo".
      if (quadro && (await quadro.locator("table").count().catch(() => 0))) return quadro;
      await pagina.waitForTimeout(500);
    }
    return null;
  }

  /** As linhas da Área de download (texto e posição na tabela) deste processo. */
  private async linhasDaArea(quadro: Frame, mascarado: string): Promise<{ texto: string; posicao: number }[]> {
    return quadro
      .locator("tbody tr")
      .evaluateAll(
        (linhas, numero) =>
          linhas.map((linha, posicao) => ({ texto: (linha as HTMLElement).innerText.replace(/\s+/g, " ").trim(), posicao })).filter((linha) => linha.texto.includes(numero)),
        mascarado
      )
      .catch(() => [] as { texto: string; posicao: number }[]);
  }

  async baixar(ambiente: Ambiente, pedido: Pedido, destino: string): Promise<ResultadoDoDownload> {
    const campos = camposCnjPje(pedido.cnj);
    if (!campos) throw new FalhaDoConector(`Número de processo inválido para o PJe do TJRJ: ${pedido.cnj}.`);
    const { pagina, linha } = await this.pesquisar(ambiente, campos);
    if (migradoParaEproc(linha)) {
      if (!this.eproc) throw new FalhaDoConector(`O processo ${campos.mascarado} foi migrado para o eproc: peça os autos pelo eproc do TJRJ.`);
      ambiente.registrar(`O PJe diz que ${campos.mascarado} foi migrado para o eproc. Seguindo pelo eproc do TJRJ.`);
      const doEproc = await this.eproc.baixar(ambiente, pedido, destino);
      return { ...(doEproc ?? {}), sistema: "eproc" };
    }

    const autos = await this.abrirAutos(ambiente, pagina, campos);
    let pecas: string[];
    let aPartirDe: number | null;
    try {
      // O cabeçalho (classe, número, partes) vem antes da linha do tempo: o segredo é decidido por ele, não pelos
      // nomes dos documentos.
      const cabecalho = (await autos.locator("body").innerText().catch(() => "")).slice(0, 600);
      if (emSegredoPje(cabecalho) && !pedido.segredoLiberado) throw new SegredoDeJustica();
      const ids = await this.idsDosAutos(autos);
      aPartirDe = idInicialDoIncremental(pedido.pecasBaixadas);
      const novos = aPartirDe === null ? ids : ids.filter((id) => id >= aPartirDe!);
      if (aPartirDe !== null && ids.length && !novos.length) {
        ambiente.registrar(`${ids.length} documentos nos autos do PJe, nenhum depois do último download: nada novo.`);
        return { semNovidades: true };
      }
      pecas = novos.map(chaveDaPecaPje);
      if (aPartirDe !== null) ambiente.registrar(`${novos.length} documentos novos no PJe (Id a partir de ${aPartirDe}). Baixando só os novos.`);
    } catch (erro) {
      await autos.close().catch(() => undefined);
      throw erro;
    }

    // As linhas que já estavam na Área de download, para reconhecer a que este pedido vai criar.
    const quadroAntes = await this.areaDeDownload(pagina);
    const antes = new Set(quadroAntes ? (await this.linhasDaArea(quadroAntes, campos.mascarado)).map((linha) => linha.texto) : []);
    // E os links de PDF que a aba dos autos já tinha (de um pedido anterior nesta aba).
    const linksAntes = new Set(await linksDoPdf(autos, campos.mascarado));

    try {
      try {
        await autos.bringToFront().catch(() => undefined);
        await autos.locator(PJE.abrirDownload).click();
        const idDe = autos.locator(PJE.idDe);
        await idDe.waitFor({ state: "visible", timeout: 15_000 });
        await idDe.fill(aPartirDe === null ? "" : String(aPartirDe));
        await autos.locator(PJE.botaoDownload).first().click();
      } catch {
        return await this.falha(ambiente, autos, `Não consegui pedir o download dos autos de ${campos.mascarado} no ${sistemaDe(this.instancia)}.`);
      }
      ambiente.registrar("O PJe está montando o PDF dos autos (pode levar alguns minutos).");

      // O PJe monta o PDF e o abre com window.open (link assinado e temporário) na aba dos autos; o Chrome barra
      // esse popup, mas o link fica na página. Em alguns casos o PDF vai também (ou só) para a Área de download.
      // A aba dos autos fica aberta até o fim: fechada cedo, o pedido pode não terminar.
      const limite = Date.now() + ambiente.config.geracaoPdfMs;
      let proximaOlhadaNaArea = Date.now() + INTERVALO_AREA_MS;
      while (Date.now() < limite) {
        await autos.waitForTimeout(2_000);
        const link = (await linksDoPdf(autos, campos.mascarado)).find((item) => !linksAntes.has(item));
        if (link) {
          const resposta = await ambiente.contexto.request.get(link, { timeout: 180_000 }).catch(() => null);
          if (!resposta?.ok()) return await this.falha(ambiente, autos, `O PDF de ${campos.mascarado} ficou pronto, mas o download pelo link do PJe falhou (${resposta?.status() ?? "sem resposta"}).`);
          await writeFile(destino, await resposta.body());
          await conferirPdf(destino);
          return { pecas };
        }
        if (Date.now() < proximaOlhadaNaArea) continue;
        proximaOlhadaNaArea = Date.now() + INTERVALO_AREA_MS;
        const quadro = await this.areaDeDownload(pagina);
        const nova = quadro ? (await this.linhasDaArea(quadro, campos.mascarado)).find((linha) => !antes.has(linha.texto)) : undefined;
        if (quadro && nova && /conclu[íi]do/i.test(nova.texto)) {
          const botao = quadro.locator("tbody tr").nth(nova.posicao).locator("button").first();
          try {
            const [arquivo] = await Promise.all([pagina.waitForEvent("download", { timeout: 120_000 }), botao.click()]);
            const falha = await arquivo.failure();
            if (falha) throw new FalhaDoConector(`O download do PDF foi interrompido (${falha}).`);
            await arquivo.saveAs(destino);
            await arquivo.delete().catch(() => undefined);
          } catch (erro) {
            if (erro instanceof FalhaDoConector) throw erro;
            return await this.falha(ambiente, pagina, `O PDF de ${campos.mascarado} ficou pronto na Área de download, mas o download não terminou.`);
          }
          await conferirPdf(destino);
          return { pecas };
        }
        if (nova && /erro|falha/i.test(nova.texto)) return await this.falha(ambiente, pagina, `O PJe não conseguiu montar o PDF de ${campos.mascarado} (Área de download: ${nova.texto.slice(0, 120)}).`);
      }
      return await this.falha(ambiente, autos, `O PDF de ${campos.mascarado} não ficou pronto no ${sistemaDe(this.instancia)} a tempo.`);
    } finally {
      await autos.close().catch(() => undefined);
    }
  }

  /** npm run inspecionar -- pje <CNJ>: pesquisa, autos e Ids, sem baixar. */
  async inspecionar(ambiente: Ambiente, cnj: string): Promise<void> {
    const campos = camposCnjPje(cnj);
    if (!campos) throw new FalhaDoConector(`O PJe aqui é o do TJRJ: o número precisa ser 0000000-00.0000.8.19.0000 (recebi ${cnj}).`);
    const { pagina, linha } = await this.pesquisar(ambiente, campos);
    ambiente.registrar(`Resultado: ${linha.slice(0, 200)}`);
    if (migradoParaEproc(linha)) {
      ambiente.registrar(`${campos.mascarado}: migrado para o eproc (os autos vêm pelo eproc do TJRJ).`);
      return;
    }
    const autos = await this.abrirAutos(ambiente, pagina, campos);
    try {
      const ids = await this.idsDosAutos(autos);
      ambiente.registrar(`${ids.length} documentos com Id na linha do tempo (do ${Math.min(...ids)} ao ${Math.max(...ids)}).`);
      ambiente.registrar(`Captura: ${await ambiente.diagnostico(autos, "pje inspecionar")}`);
    } finally {
      await autos.close().catch(() => undefined);
    }
  }
}
