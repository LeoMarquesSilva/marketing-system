/**
 * Endereços e pequenas conferências do e-SAJ, sem navegador (o que dá para testar sozinho).
 * O e-SAJ é o mesmo sistema (Softplan) em todos os tribunais que o usam: mudam o endereço e o caminho da
 * consulta de cada grau (cpopg ou cpopg5 no 1º, cposg ou cposg5 no 2º).
 */

export interface TribunalEsaj {
  sigla: string;
  base: string;
  primeiroGrau: "cpopg" | "cpopg5";
  segundoGrau: "cposg" | "cposg5";
}

/** Tribunais em que o robô já baixa autos pelo e-SAJ. Endereços conferidos na consulta pública em 10/11/2026. */
export const TRIBUNAIS_ESAJ: TribunalEsaj[] = [
  { sigla: "TJSP", base: "https://esaj.tjsp.jus.br", primeiroGrau: "cpopg", segundoGrau: "cposg" },
  { sigla: "TJCE", base: "https://esaj.tjce.jus.br", primeiroGrau: "cpopg", segundoGrau: "cposg5" },
  // No TJAL o 2º grau fica em cposg5 (o cposg devolve página em branco).
  { sigla: "TJAL", base: "https://www2.tjal.jus.br", primeiroGrau: "cpopg", segundoGrau: "cposg5" },
  { sigla: "TJMS", base: "https://esaj.tjms.jus.br", primeiroGrau: "cpopg5", segundoGrau: "cposg5" },
];

export function tribunalEsaj(sigla: string): TribunalEsaj {
  const tribunal = TRIBUNAIS_ESAJ.find((item) => item.sigla === sigla);
  if (!tribunal) throw new Error(`Tribunal sem e-SAJ mapeado: ${sigla}.`);
  return tribunal;
}

/** Sigla do tribunal estadual pelo J.TR do CNJ (8.26 → TJSP), só para os que têm e-SAJ mapeado. */
export function tribunalEsajDoCnj(cnj: string): TribunalEsaj | null {
  const digitos = cnj.replace(/\D/g, "");
  if (digitos.length !== 20 || digitos[13] !== "8") return null;
  const sigla = ({ "26": "TJSP", "06": "TJCE", "02": "TJAL", "12": "TJMS" } as Record<string, string>)[digitos.slice(14, 16)];
  return sigla ? tribunalEsaj(sigla) : null;
}

export interface NumeroCnj {
  /** 0000000-00.0000.0.00.0000 */
  mascarado: string;
  /** "0000000-00.0000", como o formulário pede. */
  numeroDigitoAno: string;
  foro: string;
  /** Origem 0000: processo do próprio tribunal (recurso ou competência originária), consultado no 2º grau. */
  segundoGrau: boolean;
}

export function lerCnj(cnj: string): NumeroCnj | null {
  const digitos = cnj.replace(/\D/g, "");
  if (digitos.length !== 20) return null;
  const mascarado = `${digitos.slice(0, 7)}-${digitos.slice(7, 9)}.${digitos.slice(9, 13)}.${digitos.slice(13, 14)}.${digitos.slice(14, 16)}.${digitos.slice(16)}`;
  return { mascarado, numeroDigitoAno: mascarado.slice(0, 15), foro: digitos.slice(16), segundoGrau: digitos.slice(16) === "0000" };
}

/** Login do portal (CAS). Com a sessão válida, o tribunal redireciona direto para o portal. */
export function urlDeLogin(base: string): string {
  return `${base}/sajcas/login?service=${encodeURIComponent(`${base}/esaj/j_spring_cas_security_check`)}`;
}

export function ehPaginaDeLogin(url: string): boolean {
  return /\/sajcas\/login/i.test(url);
}

/** Consulta de processos por número unificado, no caminho do grau certo daquele tribunal. */
export function urlDaConsulta(tribunal: TribunalEsaj, cnj: NumeroCnj): string {
  const { base } = tribunal;
  const numero = encodeURIComponent(cnj.mascarado);
  if (cnj.segundoGrau) {
    return `${base}/${tribunal.segundoGrau}/search.do?conversationId=&paginaConsulta=0&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${cnj.numeroDigitoAno}&foroNumeroUnificado=${cnj.foro}&dePesquisaNuUnificado=${numero}&dePesquisaNuUnificado=UNIFICADO&dePesquisa=&tipoNuProcesso=UNIFICADO`;
  }
  return `${base}/${tribunal.primeiroGrau}/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${cnj.numeroDigitoAno}&foroNumeroUnificado=${cnj.foro}&dadosConsulta.valorConsultaNuUnificado=${numero}&dadosConsulta.valorConsultaNuUnificado=UNIFICADO&dadosConsulta.valorConsulta=&dadosConsulta.tipoNuProcesso=UNIFICADO`;
}

/**
 * A consulta chegou à página do processo pedido? Vale para o processo principal e para incidente
 * (cumprimento de sentença), que não tem o mesmo cabeçalho: o número vem no endereço ou no texto do topo.
 */
export function ehPaginaDoProcesso(url: string, cabecalho: string, cnj: NumeroCnj): boolean {
  if (!/\/show\.do/i.test(url)) return false;
  let endereco = url;
  try {
    endereco = decodeURIComponent(url);
  } catch {
    // endereço com % solto: compara como veio
  }
  return endereco.includes(cnj.mascarado) || cabecalho.includes(cnj.mascarado);
}

/** O arquivo baixado é mesmo um PDF? (o tribunal às vezes devolve uma página de erro em HTML) */
export function comecaComoPdf(inicio: Uint8Array): boolean {
  return inicio.length >= 5 && String.fromCharCode(...inicio.slice(0, 5)) === "%PDF-";
}

export function nomeDoPdf(cnj: NumeroCnj): string {
  return `Autos ${cnj.mascarado}.pdf`;
}

/** Sem acento e em minúsculas, para achar o certificado pelo nome. */
export function simplificar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Qual certificado escolher na lista do Web Signer: o que contém o trecho configurado; sem trecho, o único
 * que houver. Devolve -1 quando a escolha não é segura (nenhum, ou mais de um candidato) e fica para a pessoa.
 */
export function escolherCertificado(opcoes: string[], trecho: string): number {
  const alvo = simplificar(trecho);
  const candidatos = opcoes.map((opcao, indice) => ({ indice, nome: simplificar(opcao) })).filter((opcao) => opcao.nome && !/^selecione/.test(opcao.nome) && (!alvo || opcao.nome.includes(alvo)));
  return candidatos.length === 1 ? candidatos[0].indice : -1;
}
