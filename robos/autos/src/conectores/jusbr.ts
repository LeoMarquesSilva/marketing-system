import { writeFile } from "node:fs/promises";
import type { APIResponse, Page } from "playwright";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { Pedido } from "../fila.ts";
import { conferirPdf } from "./comum.ts";
import {
  CONSULTA_JUSBR,
  capaDaFicha,
  digitosDoCnj,
  documentosDaFicha,
  documentosNovosJusbr,
  ehAreaLogadaJusbr,
  JUSBR_LOTE_PADRAO,
  loteJusbr,
  ehLoginPdpj,
  desistirDoJusbr,
  desistirDosOriginais,
  motivoDaResposta,
  textoParaPdf,
  urlDaApi,
  type DocumentoJusbr,
  type FichaJusbr,
} from "./jusbr-urls.ts";
import { entrarComAPessoa, type OpcoesDeLogin } from "./mapeamento.ts";
import { loginAutomaticoPdpj } from "./pje.ts";
import { FalhaDoConector, SegredoDeJustica, type Ambiente, type Conector, type ResultadoDoDownload } from "./tipos.ts";

const SISTEMA = "Jus.br (Portal de Serviços do CNJ)";
/** Intervalo entre os documentos: o Jus.br é um serviço nacional e o robô não deve martelar. */
const INTERVALO_MS = 250;
const TENTATIVAS = 3;
/** Conteúdo de origem por parte do PDF (o arquivo final fica abaixo dos 200 MB que o ORQESTRAI aceita). */
const LIMITE_PARTE_BYTES = (Number(process.env.JUSBR_PARTE_MB) > 0 ? Number(process.env.JUSBR_PARTE_MB) : 80) * 1024 * 1024;
/** Documentos por pedido: o resto de um processo enorme volta ao fim da fila (jusbr-urls.ts, loteJusbr). */
const LOTE = Number(process.env.JUSBR_LOTE) > 0 ? Number(process.env.JUSBR_LOTE) : JUSBR_LOTE_PADRAO;

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
  /** PDFs originais recusados pelo Jus.br (5xx) em sequência, neste pedido. */
  private originaisRecusados = 0;
  private fonte: PDFFont | null = null;

  private abaDoPortal(ambiente: Ambiente): Page | null {
    return ambiente.contexto.pages().find((aba) => !aba.isClosed() && ehAreaLogadaJusbr(aba.url())) ?? null;
  }

  /** O login é o SSO da PDPJ (o mesmo do PJe): no servidor, certificado pelo PJe Office do robô e código do painel. */
  private opcoesDeLogin(ambiente: Ambiente): OpcoesDeLogin {
    return {
      sistema: SISTEMA,
      urlDeLogin: CONSULTA_JUSBR,
      logado: ehAreaLogadaJusbr,
      instrucao: () => "Entre no Jus.br na janela do robô: CPF e senha (ou gov.br, ou certificado), e o código do aplicativo autenticador.",
      ...loginAutomaticoPdpj(ambiente.config.pjeOffice),
    };
  }

  async entrar(ambiente: Ambiente): Promise<void> {
    if (this.abaDoPortal(ambiente)) return;
    const nova = await ambiente.contexto.newPage();
    await entrarComAPessoa({ ...ambiente, pagina: nova }, this.opcoesDeLogin(ambiente));
  }

  /**
   * A sessão venceu (a API responde 401 mesmo com a aba do portal aberta, ex.: de um dia para o outro): fecha as abas
   * do portal e esquece o token; a próxima busca abre o portal de novo, e o login (certificado e código do painel)
   * acontece sozinho.
   */
  private async reiniciarSessao(ambiente: Ambiente): Promise<void> {
    this.autorizacao = null;
    for (const aba of ambiente.contexto.pages()) {
      if (!aba.isClosed() && ehAreaLogadaJusbr(aba.url()) && aba !== ambiente.pagina) await aba.close().catch(() => undefined);
    }
  }

  private async portal(ambiente: Ambiente): Promise<Page> {
    await this.entrar(ambiente);
    const aba = this.abaDoPortal(ambiente);
    if (!aba) throw new FalhaDoConector(`O ${SISTEMA} não abriu depois do login.`);
    if (!aba.url().startsWith(CONSULTA_JUSBR)) await aba.goto(CONSULTA_JUSBR, { waitUntil: "domcontentloaded" });
    if (ehLoginPdpj(aba.url())) await entrarComAPessoa({ ...ambiente, pagina: aba }, this.opcoesDeLogin(ambiente));
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
    // Se algo abaixo falhar, as duas esperas ficariam sem dono e, ao vencer, derrubariam o robô inteiro (23/11/2026:
    // o clique em "Buscar" não aconteceu e, 60 s depois, a espera órfã matou o processo no meio do pedido seguinte).
    resposta.catch(() => undefined);
    pedido.catch(() => undefined);
    await campo.fill(digitos);
    // "Buscar" às vezes não aceita o clique (coberto ou ainda desabilitado): o Enter no campo faz a mesma busca.
    const clicou = await aba
      .getByRole("button", { name: /Buscar/i })
      .first()
      .click({ timeout: 10_000 })
      .then(() => true, () => false);
    if (!clicou) await campo.press("Enter");
    const cabecalho = (await pedido).headers()["authorization"];
    if (cabecalho) this.autorizacao = cabecalho;
    return (await resposta).status();
  }

  private async get(ambiente: Ambiente, digitos: string, url: string, semSeguir = false): Promise<APIResponse> {
    for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa += 1) {
      if (!this.autorizacao) await this.buscarPelaTela(ambiente, digitos);
      let resposta: APIResponse;
      try {
        resposta = await ambiente.contexto.request.get(url, { headers: { authorization: this.autorizacao ?? "" }, timeout: 120_000, ...(semSeguir ? { maxRedirects: 0 } : {}) });
      } catch (erro) {
        // Rede fora (sem DNS, conexão caída, tempo esgotado): espera e tenta de novo; persistindo, o pedido falha
        // inteiro e volta para a fila (nunca sai um PDF parcial por queda de rede).
        if (tentativa < TENTATIVAS) {
          await new Promise((r) => setTimeout(r, 10_000 * tentativa));
          continue;
        }
        throw new FalhaDoConector(`A conexão com o ${SISTEMA} caiu (${erro instanceof Error ? erro.message.split("\n")[0].slice(0, 80) : "erro de rede"}). O pedido volta para a fila.`);
      }
      if (resposta.status() === 401) {
        // Primeiro só renova o token pela tela; se continuar 401, a sessão do portal venceu: entra de novo.
        if (tentativa >= 2) await this.reiniciarSessao(ambiente);
        else this.autorizacao = null;
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
    let entrouDeNovo = false;
    for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa += 1) {
      busca = await this.buscarPelaTela(ambiente, digitos);
      if (busca === 401 && !entrouDeNovo) {
        entrouDeNovo = true;
        ambiente.registrar(`${SISTEMA}: a sessão venceu; entrando de novo.`);
        await this.reiniciarSessao(ambiente);
        continue;
      }
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
    // O tribunal não está servindo os originais (o Jus.br responde 503 a cada um): o resto do processo vai pelo
    // texto, sem gastar as tentativas do PDF em cada peça.
    if (desistirDosOriginais(this.originaisRecusados)) return null;
    try {
      // O arquivo pode responder com redirecionamento para um endereço temporário do armazenamento (link assinado):
      // esse segundo pedido vai sem o token da PDPJ, que o armazenamento não aceita junto da assinatura.
      let resposta = await this.get(ambiente, digitos, urlDaApi(documento.hrefBinario), true);
      const destinoDoArquivo = resposta.status() >= 300 && resposta.status() < 400 ? resposta.headers()["location"] : undefined;
      if (destinoDoArquivo) resposta = await ambiente.contexto.request.get(destinoDoArquivo, { timeout: 180_000 });
      if (resposta.status() >= 500) {
        this.originaisRecusados += 1;
        if (desistirDosOriginais(this.originaisRecusados)) {
          ambiente.registrar(`Jus.br: ${this.originaisRecusados} arquivos originais seguidos recusados (status ${resposta.status()}); o resto deste processo vai pelo texto.`);
        }
      } else this.originaisRecusados = 0;
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
      // Queda de rede não vira "peça sem arquivo": o pedido inteiro falha e volta para a fila.
      if (erro instanceof FalhaDoConector) throw erro;
      ambiente.registrar(`Jus.br: o arquivo de "${documento.nome ?? "documento"}" falhou (${erro instanceof Error ? erro.message.split("\n")[0].slice(0, 80) : "erro"}); usa o texto.`);
      return null;
    }
  }

  /** Acrescenta o documento ao PDF: o próprio PDF, ou o texto extraído (o que não é PDF, como HTML ou vídeo). */
  private async acrescentar(ambiente: Ambiente, digitos: string, saida: PDFDocument, documento: DocumentoJusbr): Promise<{ como: "pdf" | "texto" | "falhou"; bytes: number }> {
    const pdf = await this.arquivoEmPdf(ambiente, digitos, documento);
    if (pdf) {
      try {
        const origem = await PDFDocument.load(pdf, { ignoreEncryption: true });
        const paginas = await saida.copyPages(origem, origem.getPageIndices());
        for (const pagina of paginas) saida.addPage(pagina);
        return { como: "pdf", bytes: pdf.length };
      } catch {
        // PDF corrompido: cai para o texto.
      }
    }
    const falhou = { como: "falhou" as const, bytes: 0 };
    if (!documento.hrefTexto) return falhou;
    let texto: string;
    try {
      const resposta = await this.get(ambiente, digitos, urlDaApi(documento.hrefTexto));
      if (!resposta.ok()) return falhou;
      texto = textoParaPdf(await resposta.text());
    } catch (erro) {
      if (erro instanceof FalhaDoConector) throw erro;
      return falhou;
    }
    if (!texto.trim()) return falhou;
    this.fonte ??= await saida.embedFont(StandardFonts.Helvetica);
    const titulo = textoParaPdf(`${documento.sequencia ?? ""} - ${documento.nome ?? documento.tipo?.nome ?? "Documento"} (${(documento.dataHoraJuntada ?? "").slice(0, 10)})`);
    const linhas = [titulo, "", ...texto.split("\n").flatMap((linha) => linha.match(/.{1,95}(\s|$)|\S+/g) ?? [""])];
    for (let i = 0; i < linhas.length; i += 55) {
      const pagina = saida.addPage([595, 842]);
      linhas.slice(i, i + 55).forEach((linha, n) => pagina.drawText(linha, { x: 40, y: 800 - n * 13.5, size: 10, font: this.fonte!, color: rgb(0, 0, 0) }));
    }
    return { como: "texto", bytes: texto.length };
  }

  async baixar(ambiente: Ambiente, pedido: Pedido, destino: string): Promise<ResultadoDoDownload> {
    const { digitos, fichas } = await this.ficha(ambiente, pedido.cnj);
    if (fichas.some((ficha) => (ficha.nivelSigilo ?? 0) > 0) && !pedido.segredoLiberado) throw new SegredoDeJustica();
    const documentos = documentosDaFicha(fichas);
    if (!documentos.length) throw new FalhaDoConector(`${pedido.cnj}: o Jus.br não trouxe documentos deste processo (integração incompleta do tribunal).`);
    const todosNovos = documentosNovosJusbr(documentos, pedido.pecasBaixadas);
    const { lote: novos, restantes } = loteJusbr(todosNovos, LOTE);
    // A capa e os movimentos vão junto (o ORQESTRAI grava a capa e a linha do tempo), com ou sem peça nova.
    const capa = capaDaFicha(fichas) ?? undefined;
    if (!novos.length) {
      ambiente.registrar(`${documentos.length} documentos no Jus.br, todos já baixados antes: nada novo.`);
      return { semNovidades: true, capa };
    }
    ambiente.registrar(`${todosNovos.length} documentos ${todosNovos.length < documentos.length ? `novos de ${documentos.length} ` : ""}no Jus.br (${fichas.map((f) => f.siglaTribunal).join(", ")}). Baixando um a um.`);
    if (restantes) ambiente.registrar(`Processo grande: este pedido leva ${novos.length}; os outros ${restantes} voltam ao fim da fila num pedido novo.`);
    // Processo grande sai em partes (o ORQESTRAI aceita até 200 MB por arquivo): cada parte fecha perto de
    // LIMITE_PARTE_BYTES de conteúdo de origem. A primeira parte é o `destino`; as outras, "<destino>-parte2.pdf"…
    const partes: { caminho: string; pecas: string[]; paginas: number }[] = [];
    let saida = await PDFDocument.create();
    let pecasDaParte: string[] = [];
    let bytesDaParte = 0;
    this.fonte = null;
    this.originaisRecusados = 0;
    const fecharParte = async () => {
      if (!saida.getPageCount()) return;
      const caminho = partes.length ? destino.replace(/\.pdf$/i, `-parte${partes.length + 1}.pdf`) : destino;
      await writeFile(caminho, await saida.save());
      await conferirPdf(caminho);
      partes.push({ caminho, pecas: pecasDaParte, paginas: saida.getPageCount() });
      saida = await PDFDocument.create();
      this.fonte = null;
      pecasDaParte = [];
      bytesDaParte = 0;
    };
    const contagem = { pdf: 0, texto: 0, falhou: 0 };
    let falhasSeguidas = 0;
    for (const documento of novos) {
      await ambiente.sinalDeVida?.();
      const { como, bytes } = await this.acrescentar(ambiente, digitos, saida, documento);
      contagem[como] += 1;
      falhasSeguidas = como === "falhou" ? falhasSeguidas + 1 : 0;
      if (desistirDoJusbr(falhasSeguidas)) {
        throw new FalhaDoConector(`${pedido.cnj}: o Jus.br não entregou ${falhasSeguidas} documentos seguidos (a integração do tribunal parece fora do ar).`);
      }
      if (como !== "falhou") pecasDaParte.push(documento.chave);
      bytesDaParte += bytes;
      if (bytesDaParte >= LIMITE_PARTE_BYTES) await fecharParte();
      await new Promise((r) => setTimeout(r, INTERVALO_MS));
    }
    await fecharParte();
    if (!partes.length) throw new FalhaDoConector(`${pedido.cnj}: nenhum documento do Jus.br pôde ser baixado.`);
    const paginas = partes.reduce((total, parte) => total + parte.paginas, 0);
    ambiente.registrar(`Jus.br: ${contagem.pdf} em PDF, ${contagem.texto} pelo texto, ${contagem.falhou} sem arquivo; ${paginas} páginas${partes.length > 1 ? ` em ${partes.length} partes` : ""}.`);
    const pecas = partes.flatMap((parte) => parte.pecas);
    const resto = restantes ? { restantes } : {};
    return partes.length > 1 ? { pecas, capa, ...resto, arquivos: partes.map(({ caminho, pecas: daParte }) => ({ caminho, pecas: daParte })) } : { pecas, capa, ...resto };
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
