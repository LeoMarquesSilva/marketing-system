/**
 * Endereços e pequenas conferências do e-SAJ, sem navegador (o que dá para testar sozinho).
 * O formulário de consulta é o mesmo em todos os tribunais do e-SAJ; muda a base.
 */

export const ESAJ_TJSP = "https://esaj.tjsp.jus.br";

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

/** Consulta de processos por número unificado: cpopg (1º grau) ou cposg (2º grau). */
export function urlDaConsulta(base: string, cnj: NumeroCnj): string {
  const numero = encodeURIComponent(cnj.mascarado);
  if (cnj.segundoGrau) {
    return `${base}/cposg/search.do?conversationId=&paginaConsulta=0&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${cnj.numeroDigitoAno}&foroNumeroUnificado=${cnj.foro}&dePesquisaNuUnificado=${numero}&dePesquisaNuUnificado=UNIFICADO&dePesquisa=&tipoNuProcesso=UNIFICADO`;
  }
  return `${base}/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${cnj.numeroDigitoAno}&foroNumeroUnificado=${cnj.foro}&dadosConsulta.valorConsultaNuUnificado=${numero}&dadosConsulta.valorConsultaNuUnificado=UNIFICADO&dadosConsulta.valorConsulta=&dadosConsulta.tipoNuProcesso=UNIFICADO`;
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
