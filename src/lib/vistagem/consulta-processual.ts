import { mascararCnj } from "./processo";

/**
 * Consulta processual pública do tribunal, para o jurídico abrir o processo em nova aba pelo número.
 * STJ e TST publicam com o número da origem, então valem pelo campo `tribunal` (ou pelo J do CNJ: 3 é o
 * STJ, 5.00 o TST); nos demais manda o próprio CNJ (J.TR: 5.02 é o TRT2, 8.26 o TJSP), que diz onde o
 * processo tramita mesmo quando o diário é de outro tribunal. Onde a consulta é só por formulário (PJe do
 * TJBA, TJCE e TRF3, PROJUDI do TJGO) ou pede login (JUS.BR, no TJES), o link abre a consulta e o clique copia o
 * número (`copiar`). Sem endereço conferido, null: melhor sem link do que um link que leva a erro.
 */
export interface ConsultaProcessual {
  url: string;
  /** Onde abre, para o title do link: "no PJe do TRT15", "no e-SAJ do TJSP"… */
  onde: string;
  /** A página abre com o número preenchido e a pessoa ainda escolhe a instância e consulta. */
  preenchida: boolean;
  /**
   * Consulta só por formulário (PJe dos TJs e TRFs, PROJUDI) ou com login (JUS.BR): o link abre a consulta e o
   * clique copia este texto, no formato que o campo do tribunal pede, para a pessoa só colar.
   */
  copiar?: string;
}

/** Consulta pública que não aceita o número no endereço: abre o formulário e o clique copia o número. */
function porFormulario(url: string, onde: string, copiar: string): ConsultaProcessual {
  return { url, onde, preenchida: false, copiar };
}

/**
 * e-SAJ (Softplan): mesmo formulário em todos os tribunais, por número unificado e foro. O caminho muda
 * de tribunal para tribunal (cpopg/cposg no TJSP, cpopg/cposg5 no TJAL, cpopg5 no TJMS).
 */
function esaj(base: string, caminho: string, cnj: string): string {
  const numeroDigitoAno = cnj.slice(0, 15);
  const foro = cnj.slice(-4);
  return caminho.startsWith("cposg")
    ? `${base}/${caminho}/search.do?conversationId=&paginaConsulta=0&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${numeroDigitoAno}&foroNumeroUnificado=${foro}&dePesquisaNuUnificado=${cnj}&dePesquisaNuUnificado=UNIFICADO&dePesquisa=&tipoNuProcesso=UNIFICADO`
    : `${base}/${caminho}/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${numeroDigitoAno}&foroNumeroUnificado=${foro}&dadosConsulta.valorConsultaNuUnificado=${cnj}&dadosConsulta.valorConsultaNuUnificado=UNIFICADO&dadosConsulta.valorConsulta=&dadosConsulta.tipoNuProcesso=UNIFICADO`;
}

/** PJe da Justiça do Trabalho: a consulta mostra as instâncias do número (1º grau, 2º grau) para escolher. */
function pjeTrabalhista(host: string, cnj: string): string {
  return `https://${host}/consultaprocessual/detalhe-processo/${cnj}`;
}

/**
 * Consulta pela numeração única do TST. Abre o processo direto quando ele está no e-SIJ (os recursos
 * antigos, que o PJe do TST não mostra) e redireciona sozinha para o PJe do TST quando está lá.
 */
function consultaTst(digitos: string): string {
  const campos = new URLSearchParams({
    consulta: "Consultar",
    conscsjt: "",
    numeroTst: digitos.slice(0, 7),
    digitoTst: digitos.slice(7, 9),
    anoTst: digitos.slice(9, 13),
    orgaoTst: digitos.slice(13, 14),
    tribunalTst: digitos.slice(14, 16),
    varaTst: digitos.slice(16, 20),
    submit: "Consultar",
  });
  return `https://consultaprocessual.tst.jus.br/consultaProcessual/consultaTstNumUnica.do?${campos}`;
}

export function consultaProcessual(tribunal: string | null, numero: string | null): ConsultaProcessual | null {
  const digitos = (numero ?? "").replace(/\D/g, "").slice(0, 20);
  if (digitos.length < 20) return null;
  const cnj = mascararCnj(digitos);
  const sigla = (tribunal ?? "").trim().toUpperCase();
  const justica = digitos[13];
  const regiao = Number(digitos.slice(14, 16));
  const origem = digitos.slice(16, 20);

  if (sigla === "STJ" || justica === "3") {
    // No STJ o "número único" do recurso é o CNJ da origem; a própria página do processo no STJ linka
    // essa pesquisa com os 20 dígitos, sem máscara.
    return {
      url: `https://processo.stj.jus.br/processo/pesquisa/?tipoPesquisa=tipoPesquisaNumeroUnico&termo=${digitos}&totalRegistrosPorPagina=40&aplicacao=processos.ea`,
      onde: "na pesquisa processual do STJ",
      preenchida: false,
    };
  }
  if (justica === "5") {
    if (sigla === "TST" || regiao === 0) return { url: consultaTst(digitos), onde: "na consulta processual do TST", preenchida: false };
    if (regiao >= 1 && regiao <= 24) {
      return { url: pjeTrabalhista(`pje.trt${regiao}.jus.br`, cnj), onde: `no PJe do TRT${regiao}`, preenchida: false };
    }
    return null;
  }
  const segundoGrau = origem === "0000";
  // TRF3 (Justiça Federal, 3ª Região): consulta pública do PJe, 1º e 2º grau.
  if (justica === "4" && regiao === 3) {
    return segundoGrau
      ? porFormulario("https://pje2g.trf3.jus.br/pje/ConsultaPublica/listView.seam", "na consulta pública do PJe do TRF3 (2º grau)", cnj)
      : porFormulario("https://pje1g.trf3.jus.br/pje/ConsultaPublica/listView.seam", "na consulta pública do PJe do TRF3 (1º grau)", cnj);
  }
  if (justica !== "8") return null;
  // TJBA: consulta pública do PJe, 1º e 2º grau.
  if (regiao === 5) {
    return segundoGrau
      ? porFormulario("https://pje2g.tjba.jus.br/pje/ConsultaPublica/listView.seam", "na consulta pública do PJe do TJBA (2º grau)", cnj)
      : porFormulario("https://consultapublicapje.tjba.jus.br/pje/ConsultaPublica/listView.seam", "na consulta pública do PJe do TJBA (1º grau)", cnj);
  }
  // TJCE: consulta pública do PJe, 1º e 2º grau.
  if (regiao === 6) {
    const instancia = segundoGrau ? "pje2grau" : "pje1grau";
    return porFormulario(
      `https://pje-consulta.tjce.jus.br/${instancia}/ConsultaPublica/listView.seam`,
      `na consulta pública do PJe do TJCE (${segundoGrau ? "2º" : "1º"} grau)`,
      cnj
    );
  }
  // TJES: a consulta pública do PJe manda para a consulta nacional do CNJ (JUS.BR), que pede login gov.br ou certificado.
  if (regiao === 8) return porFormulario("https://portaldeservicos.pdpj.jus.br/consulta", "na consulta do JUS.BR (TJES; pede login)", cnj);
  // TJGO: busca pública do PROJUDI, que pede o número e o dígito ("148032-91"), sem os zeros da frente.
  if (regiao === 9) {
    return porFormulario("https://projudi.tjgo.jus.br/BuscaProcesso", "na busca pública do PROJUDI do TJGO", `${Number(digitos.slice(0, 7))}-${digitos.slice(7, 9)}`);
  }
  if (regiao === 26) {
    // Os processos novos do eproc (sequencial 4…) não estão no e-SAJ: a consulta unificada abre com o número.
    if (digitos[0] === "4") {
      return {
        url: `https://eproc-consulta.tjsp.jus.br/consulta_1g/externo_controlador.php?acao=tjsp@consulta_unificada_publica/consultar&num_processo=${cnj}`,
        onde: "na consulta unificada do TJSP (eproc e e-SAJ)",
        preenchida: true,
      };
    }
    return { url: esaj("https://esaj.tjsp.jus.br", segundoGrau ? "cposg" : "cpopg", cnj), onde: "no e-SAJ do TJSP", preenchida: false };
  }
  if (regiao === 2) {
    // No TJAL o 2º grau fica em cposg5 (o cposg devolve página em branco).
    return { url: esaj("https://www2.tjal.jus.br", segundoGrau ? "cposg5" : "cpopg", cnj), onde: "no e-SAJ do TJAL", preenchida: false };
  }
  // TJMS: só o 1º grau tem endereço conferido, e ele para no reCAPTCHA com o número preenchido.
  if (regiao === 12 && !segundoGrau) {
    return { url: esaj("https://esaj.tjms.jus.br", "cpopg5", cnj), onde: "no e-SAJ do TJMS", preenchida: true };
  }
  return null;
}
