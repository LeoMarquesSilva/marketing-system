import { writeFile } from "node:fs/promises";
import type { APIResponse, Page } from "playwright";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { Pedido } from "../fila.ts";
import { conferirPdf } from "./comum.ts";
import {
  CONSULTA_JUSBR,
  digitosDoCnj,
  documentosDaFicha,
  documentosNovosJusbr,
  ehAreaLogadaJusbr,
  ehLoginPdpj,
  motivoDaResposta,
  textoParaPdf,
  urlDaApi,
  chaveDoDocumentoJusbr,
  type DocumentoJusbr,
  type FichaJusbr,
} from "./jusbr-urls.ts";
import { entrarComAPessoa } from "./mapeamento.ts";
import { FalhaDoConector, SegredoDeJustica, type Ambiente, type Conector, type ResultadoDoDownload } from "./tipos.ts";

const SISTEMA = "Jus.br (Portal de Serviços do CNJ)";
/** Intervalo entre os documentos: o Jus.br é um serviço nacional e o robô não deve martelar. */
const INTERVALO_MS = 250;
const TENTATIVAS = 3;

/**
 * PROTÓTIPO (18/11/2026), fora da fila: um conector único pelo Jus.br, para qualquer tribunal integrado à PDPJ.
 * 1. login da pessoa no SSO da PDPJ (o mesmo do PJe), numa aba própria que fica aberta;
 * 2. a busca pela tela da consulta gera a chamada da API com o token da sessão; o robô guarda esse cabeçalho só
 *    em memória e o reaproveita para a ficha e os arquivos (renova quando a API responde 401);
 * 3. documentos novos em ordem de juntada: PDF entra inteiro; o que não é PDF entra pelo texto extraído;
 * 4. um PDF único, com as chaves "jusbr:<id>" para o próximo download trazer só o novo.
 * Teste: npm run provar -- jusbr <CNJ> (grava o PDF localmente, sem entregar ao ORQESTRAI).
 */
export class ConectorJusbr implements Conector {
  readonly chave = "jusbr:BR";
  private autorizacao: string | null = null;
  private diagnosticoFeito = false;
  private fonte: PDFFont | null = null;

  private abaDoPortal(ambiente: Ambiente): Page | null {
    return ambiente.contexto.pages().find((aba) => !aba.isClosed() && ehAreaLogadaJusbr(aba.url())) ?? null;
  }

  private opcoesDeLogin() {
    return {
      sistema: SISTEMA,
      urlDeLogin: CONSULTA_JUSBR,
      logado: ehAreaLogadaJusbr,
      instrucao: () => "Entre no Jus.br na janela do robô: CPF e senha (ou gov.br, ou certificado), e o código do aplicativo autenticador.",
    };
  }

  async entrar(ambiente: Ambiente): Promise<void> {
    if (this.abaDoPortal(ambiente)) return;
    const nova = await ambiente.contexto.newPage();
    await entrarComAPessoa({ ...ambiente, pagina: nova }, this.opcoesDeLogin());
  }

  private async portal(ambiente: Ambiente): Promise<Page> {
    await this.entrar(ambiente);
    const aba = this.abaDoPortal(ambiente);
    if (!aba) throw new FalhaDoConector(`O ${SISTEMA} não abriu depois do login.`);
    if (!aba.url().startsWith(CONSULTA_JUSBR)) await aba.goto(CONSULTA_JUSBR, { waitUntil: "domcontentloaded" });
    if (ehLoginPdpj(aba.url())) await entrarComAPessoa({ ...ambiente, pagina: aba }, this.opcoesDeLogin());
    return aba;
  }

  /**
   * Busca o número pela tela (a única forma de o app gerar a chamada autenticada) e guarda o cabeçalho de
   * autorização que ele usou. Devolve o status da busca.
   */
  private async buscarPelaTela(ambiente: Ambiente, digitos: string): Promise<number> {
    const aba = await this.portal(ambiente);
    // A navegação guiada da primeira visita cobre a tela.
    const pular = aba.getByRole("button", { name: /^\s*Pular\s*$/i });
    if (await pular.isVisible().catch(() => false)) await pular.click().catch(() => undefined);
    // O campo do número não tem type="text": acha pelo exemplo de número ("0000000-00.0000.0.00.0000").
    const campo = aba.getByPlaceholder(/0000000-00/).first();
    await campo.waitFor({ state: "visible", timeout: 30_000 });
    const resposta = aba.waitForResponse((r) => r.url().includes(`/api/v2/processos?numeroProcesso=${digitos}`), { timeout: 60_000 });
    const pedido = aba.waitForRequest((r) => r.url().includes(`/api/v2/processos?numeroProcesso=${digitos}`), { timeout: 60_000 });
    await campo.fill(digitos);
    await aba.getByRole("button", { name: /Buscar/i }).first().click();
    const cabecalho = (await pedido).headers()["authorization"];
    if (cabecalho) this.autorizacao = cabecalho;
    return (await resposta).status();
  }

  private async get(ambiente: Ambiente, digitos: string, url: string, semSeguir = false): Promise<APIResponse> {
    for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa += 1) {
      if (!this.autorizacao) await this.buscarPelaTela(ambiente, digitos);
      const resposta = await ambiente.contexto.request.get(url, { headers: { authorization: this.autorizacao ?? "" }, timeout: 120_000, ...(semSeguir ? { maxRedirects: 0 } : {}) });
      if (resposta.status() === 401) {
        this.autorizacao = null;
        continue;
      }
      if (resposta.status() >= 500 && tentativa < TENTATIVAS) {
        await new Promise((r) => setTimeout(r, 3_000 * tentativa));
        continue;
      }
      return resposta;
    }
    throw new FalhaDoConector(`O ${SISTEMA} não respondeu depois de ${TENTATIVAS} tentativas.`);
  }

  private async ficha(ambiente: Ambiente, cnj: string): Promise<{ digitos: string; fichas: FichaJusbr[] }> {
    const digitos = digitosDoCnj(cnj);
    if (!digitos) throw new FalhaDoConector(`Número de processo inválido: ${cnj}.`);
    let busca = 0;
    for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa += 1) {
      busca = await this.buscarPelaTela(ambiente, digitos);
      if (busca < 500) break;
      await new Promise((r) => setTimeout(r, 3_000 * tentativa));
    }
    const motivoBusca = motivoDaResposta(busca);
    if (motivoBusca) throw new FalhaDoConector(`${cnj}: ${motivoBusca}.`);
    const resposta = await this.get(ambiente, digitos, `${CONSULTA_JUSBR.replace(/\/consulta$/, "")}/api/v2/processos/${digitos}`);
    const motivo = motivoDaResposta(resposta.status());
    if (motivo) throw new FalhaDoConector(`${cnj}: ${motivo}.`);
    const corpo = (await resposta.json()) as FichaJusbr[] | FichaJusbr;
    return { digitos, fichas: Array.isArray(corpo) ? corpo : [corpo] };
  }

  /** O arquivo original, se for PDF. Qualquer falha (resposta malformada, link vencido) devolve null: vale o texto. */
  private async arquivoEmPdf(ambiente: Ambiente, digitos: string, documento: DocumentoJusbr): Promise<Buffer | null> {
    if (!documento.hrefBinario) return null;
    try {
      // O arquivo pode responder com redirecionamento para um endereço temporário do armazenamento (link assinado):
      // esse segundo pedido vai sem o token da PDPJ, que o armazenamento não aceita junto da assinatura.
      let resposta = await this.get(ambiente, digitos, urlDaApi(documento.hrefBinario), true);
      const destinoDoArquivo = resposta.status() >= 300 && resposta.status() < 400 ? resposta.headers()["location"] : undefined;
      if (destinoDoArquivo) resposta = await ambiente.contexto.request.get(destinoDoArquivo, { timeout: 180_000 });
      const corpo = resposta.ok() ? await resposta.body() : null;
      // O cabeçalho "%PDF-" pode vir depois de alguns bytes (o padrão admite até 1 KB antes dele).
      const inicio = corpo ? corpo.subarray(0, 1024).indexOf("%PDF-") : -1;
      if (corpo && inicio >= 0) return inicio ? corpo.subarray(inicio) : corpo;
      if (!this.diagnosticoFeito) {
        this.diagnosticoFeito = true;
        ambiente.registrar(`Jus.br: o arquivo de "${documento.nome ?? "documento"}" não veio em PDF (status ${resposta.status()}, ${resposta.headers()["content-type"] ?? "sem tipo"}); usa o texto.`);
      }
      return null;
    } catch (erro) {
      ambiente.registrar(`Jus.br: o arquivo de "${documento.nome ?? "documento"}" falhou (${erro instanceof Error ? erro.message.split("\n")[0].slice(0, 80) : "erro"}); usa o texto.`);
      return null;
    }
  }

  /** Acrescenta o documento ao PDF: o próprio PDF, ou o texto extraído (o que não é PDF, como HTML ou vídeo). */
  private async acrescentar(ambiente: Ambiente, digitos: string, saida: PDFDocument, documento: DocumentoJusbr): Promise<"pdf" | "texto" | "falhou"> {
    const pdf = await this.arquivoEmPdf(ambiente, digitos, documento);
    if (pdf) {
      try {
        const origem = await PDFDocument.load(pdf, { ignoreEncryption: true });
        const paginas = await saida.copyPages(origem, origem.getPageIndices());
        for (const pagina of paginas) saida.addPage(pagina);
        return "pdf";
      } catch {
        // PDF corrompido: cai para o texto.
      }
    }
    if (!documento.hrefTexto) return "falhou";
    let texto: string;
    try {
      const resposta = await this.get(ambiente, digitos, urlDaApi(documento.hrefTexto));
      if (!resposta.ok()) return "falhou";
      texto = textoParaPdf(await resposta.text());
    } catch {
      return "falhou";
    }
    if (!texto.trim()) return "falhou";
    this.fonte ??= await saida.embedFont(StandardFonts.Helvetica);
    const titulo = textoParaPdf(`${documento.sequencia ?? ""} - ${documento.nome ?? documento.tipo?.nome ?? "Documento"} (${(documento.dataHoraJuntada ?? "").slice(0, 10)})`);
    const linhas = [titulo, "", ...texto.split("\n").flatMap((linha) => linha.match(/.{1,95}(\s|$)|\S+/g) ?? [""])];
    for (let i = 0; i < linhas.length; i += 55) {
      const pagina = saida.addPage([595, 842]);
      linhas.slice(i, i + 55).forEach((linha, n) => pagina.drawText(linha, { x: 40, y: 800 - n * 13.5, size: 10, font: this.fonte!, color: rgb(0, 0, 0) }));
    }
    return "texto";
  }

  async baixar(ambiente: Ambiente, pedido: Pedido, destino: string): Promise<ResultadoDoDownload> {
    const { digitos, fichas } = await this.ficha(ambiente, pedido.cnj);
    if (fichas.some((ficha) => (ficha.nivelSigilo ?? 0) > 0) && !pedido.segredoLiberado) throw new SegredoDeJustica();
    const documentos = documentosDaFicha(fichas);
    if (!documentos.length) throw new FalhaDoConector(`${pedido.cnj}: o Jus.br não trouxe documentos deste processo (integração incompleta do tribunal).`);
    const novos = documentosNovosJusbr(documentos, pedido.pecasBaixadas);
    if (!novos.length) {
      ambiente.registrar(`${documentos.length} documentos no Jus.br, todos já baixados antes: nada novo.`);
      return { semNovidades: true };
    }
    ambiente.registrar(`${novos.length} documentos ${novos.length < documentos.length ? `novos de ${documentos.length} ` : ""}no Jus.br (${fichas.map((f) => f.siglaTribunal).join(", ")}). Baixando um a um.`);
    const saida = await PDFDocument.create();
    this.fonte = null;
    const vieram: string[] = [];
    const contagem = { pdf: 0, texto: 0, falhou: 0 };
    for (const documento of novos) {
      const como = await this.acrescentar(ambiente, digitos, saida, documento);
      contagem[como] += 1;
      if (como !== "falhou") vieram.push(chaveDoDocumentoJusbr(documento) ?? "");
      await new Promise((r) => setTimeout(r, INTERVALO_MS));
    }
    if (!saida.getPageCount()) throw new FalhaDoConector(`${pedido.cnj}: nenhum documento do Jus.br pôde ser baixado.`);
    await writeFile(destino, await saida.save());
    await conferirPdf(destino);
    ambiente.registrar(`Jus.br: ${contagem.pdf} em PDF, ${contagem.texto} pelo texto, ${contagem.falhou} sem arquivo; ${saida.getPageCount()} páginas.`);
    return { pecas: vieram.filter(Boolean) };
  }

  async inspecionar(ambiente: Ambiente, cnj: string): Promise<void> {
    const { fichas } = await this.ficha(ambiente, cnj);
    const documentos = documentosDaFicha(fichas);
    ambiente.registrar(`${cnj}: ${fichas.map((f) => `${f.siglaTribunal} (sigilo ${f.nivelSigilo ?? 0})`).join(", ")}; ${documentos.length} documentos com arquivo ou texto.`);
    if (documentos.length) {
      const primeiro = documentos[0];
      const ultimo = documentos[documentos.length - 1];
      ambiente.registrar(`Primeiro: ${primeiro.nome} (${primeiro.dataHoraJuntada?.slice(0, 10)}). Último: ${ultimo.nome} (${ultimo.dataHoraJuntada?.slice(0, 10)}).`);
    }
  }
}
