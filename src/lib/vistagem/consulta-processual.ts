import { mascararCnj } from "./processo";

/**
 * Consulta processual pública do tribunal, para o jurídico abrir o processo em nova aba pelo número.
 * STJ e TST publicam com o número da origem, então valem pelo campo `tribunal`; nos demais manda o
 * próprio CNJ (J.TR: 5.02 é o TRT2, 8.26 o TJSP), que diz onde o processo tramita mesmo quando o diário
 * é de outro tribunal. Sem endereço conhecido (PJe só com formulário, eproc sem link direto), null.
 */
export interface ConsultaProcessual {
  url: string;
  /** Onde abre, para o title do link: "no PJe do TRT15", "no e-SAJ do TJSP"… */
  onde: string;
  /** A página abre com o número preenchido e a pessoa ainda escolhe a instância e consulta. */
  preenchida: boolean;
}

/** e-SAJ (Softplan): mesmo formulário em todos os tribunais, por número unificado e foro. */
function esaj(base: string, cnj: string, segundoGrau: boolean, primeiroGrau = "cpopg"): string {
  const numeroDigitoAno = cnj.slice(0, 15);
  const foro = cnj.slice(-4);
  return segundoGrau
    ? `${base}/cposg/search.do?conversationId=&paginaConsulta=0&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${numeroDigitoAno}&foroNumeroUnificado=${foro}&dePesquisaNuUnificado=${cnj}&dePesquisaNuUnificado=UNIFICADO&dePesquisa=&tipoNuProcesso=UNIFICADO`
    : `${base}/${primeiroGrau}/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${numeroDigitoAno}&foroNumeroUnificado=${foro}&dadosConsulta.valorConsultaNuUnificado=${cnj}&dadosConsulta.valorConsultaNuUnificado=UNIFICADO&dadosConsulta.valorConsulta=&dadosConsulta.tipoNuProcesso=UNIFICADO`;
}

/** PJe da Justiça do Trabalho: a consulta mostra as instâncias do número (1º grau, 2º grau, TST) para escolher. */
function pjeTrabalhista(host: string, cnj: string): string {
  return `https://${host}/consultaprocessual/detalhe-processo/${cnj}`;
}

export function consultaProcessual(tribunal: string | null, numero: string | null): ConsultaProcessual | null {
  const digitos = (numero ?? "").replace(/\D/g, "");
  if (digitos.length < 20) return null;
  const cnj = mascararCnj(digitos.slice(0, 20));
  const sigla = (tribunal ?? "").trim().toUpperCase();
  const justica = digitos[13];
  const regiao = Number(digitos.slice(14, 16));
  const origem = digitos.slice(16, 20);

  if (sigla === "STJ") {
    return {
      url: `https://processo.stj.jus.br/processo/pesquisa/?tipoPesquisa=tipoPesquisaNumeroUnico&termo=${cnj}&totalRegistrosPorPagina=40&aplicacao=processos.ea`,
      onde: "na pesquisa processual do STJ",
      preenchida: false,
    };
  }
  if (justica === "5") {
    if (sigla === "TST" || regiao === 0) return { url: pjeTrabalhista("pje.tst.jus.br", cnj), onde: "no PJe do TST", preenchida: false };
    if (regiao >= 1 && regiao <= 24) {
      return { url: pjeTrabalhista(`pje.trt${regiao}.jus.br`, cnj), onde: `no PJe do TRT${regiao}`, preenchida: false };
    }
    return null;
  }
  if (justica !== "8") return null;
  const segundoGrau = origem === "0000";
  if (regiao === 26) {
    // Os processos novos do eproc (sequencial 4…) não estão no e-SAJ: a consulta unificada abre com o número.
    if (digitos[0] === "4") {
      return {
        url: `https://eproc-consulta.tjsp.jus.br/consulta_1g/externo_controlador.php?acao=tjsp@consulta_unificada_publica/consultar&num_processo=${cnj}`,
        onde: "na consulta unificada do TJSP (eproc e e-SAJ)",
        preenchida: true,
      };
    }
    return { url: esaj("https://esaj.tjsp.jus.br", cnj, segundoGrau), onde: "no e-SAJ do TJSP", preenchida: false };
  }
  // TJAL e TJMS: só o 1º grau do e-SAJ tem endereço conferido.
  if (regiao === 2 && !segundoGrau) return { url: esaj("https://www2.tjal.jus.br", cnj, false), onde: "no e-SAJ do TJAL", preenchida: false };
  if (regiao === 12 && !segundoGrau) {
    return { url: esaj("https://esaj.tjms.jus.br", cnj, false, "cpopg5"), onde: "no e-SAJ do TJMS", preenchida: true };
  }
  return null;
}
