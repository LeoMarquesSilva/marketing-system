/**
 * Jus.br (Portal de Serviços do Poder Judiciário, CNJ), sem navegador: o que dá para testar sozinho.
 *
 * Visto em 18/11/2026 com a sessão do advogado (protótipo):
 * - login pelo SSO da PDPJ (sso.cloud.pje.jus.br, realm "pje", client "jusbr"), o mesmo do PJe;
 * - a consulta (portaldeservicos.pdpj.jus.br/consulta) usa a API do próprio portal, com o token da sessão:
 *   GET /api/v2/processos?numeroProcesso=<20 dígitos> (busca) e GET /api/v2/processos/<20 dígitos> (ficha);
 * - a ficha traz tramitacaoAtual (e tramitacoes) com "documentos": sequencia, idCodex, idOrigem, nome,
 *   dataHoraJuntada, nivelSigilo, tipo e os links relativos hrefBinario (o arquivo) e hrefTexto (o texto extraído);
 * - só processos públicos; a integração dos tribunais ainda está incompleta (eproc do TJMG não encontrado; TJSC
 *   com poucos documentos) e o serviço oscila (503, às vezes 403).
 */

export const CONSULTA_JUSBR = "https://portaldeservicos.pdpj.jus.br/consulta";
export const API_JUSBR = "https://portaldeservicos.pdpj.jus.br/api/v2";

/** Telas do login da PDPJ (SSO do CNJ). */
export function ehLoginPdpj(url: string): boolean {
  return /^https:\/\/sso\.cloud\.pje\.jus\.br\//i.test(url) || /^https:\/\/sso\.acesso\.gov\.br\//i.test(url);
}

/** A pessoa já entrou: a aba está no Portal de Serviços. */
export function ehAreaLogadaJusbr(url: string): boolean {
  return /^https:\/\/portaldeservicos\.pdpj\.jus\.br\//i.test(url);
}

/** Os 20 dígitos do número CNJ, como a API pede. */
export function digitosDoCnj(cnj: string): string | null {
  const digitos = cnj.replace(/\D/g, "");
  return digitos.length === 20 ? digitos : null;
}

export interface DocumentoJusbr {
  sequencia?: number;
  idCodex?: number | string;
  idOrigem?: string;
  nome?: string;
  dataHoraJuntada?: string;
  nivelSigilo?: string;
  tipo?: { nome?: string };
  hrefBinario?: string;
  hrefTexto?: string;
}

interface TramitacaoJusbr {
  documentos?: DocumentoJusbr[];
  tribunal?: { sigla?: string };
  grau?: { sigla?: string };
}

export interface FichaJusbr {
  numeroProcesso?: string;
  siglaTribunal?: string;
  nivelSigilo?: number;
  tramitacaoAtual?: TramitacaoJusbr;
  tramitacoes?: TramitacaoJusbr[];
}

/** Identidade de um documento: o id do Codex (base nacional), senão o da origem, senão o link do arquivo. */
export function chaveDoDocumentoJusbr(documento: DocumentoJusbr): string | null {
  const id = documento.idCodex ?? documento.idOrigem ?? documento.hrefBinario;
  return id === undefined || id === null || id === "" ? null : `jusbr:${id}`;
}

/**
 * Todos os documentos da ficha (tramitação atual e as outras, como 1º e 2º grau ou o sistema antigo de um processo
 * migrado), sem repetir, na ordem de juntada. Só os que têm arquivo ou texto.
 */
export function documentosDaFicha(fichas: FichaJusbr[]): DocumentoJusbr[] {
  const vistos = new Set<string>();
  const todos: DocumentoJusbr[] = [];
  for (const ficha of fichas) {
    for (const tramitacao of [ficha.tramitacaoAtual, ...(ficha.tramitacoes ?? [])]) {
      for (const documento of tramitacao?.documentos ?? []) {
        const chave = chaveDoDocumentoJusbr(documento);
        if (!chave || vistos.has(chave) || (!documento.hrefBinario && !documento.hrefTexto)) continue;
        vistos.add(chave);
        todos.push(documento);
      }
    }
  }
  const momento = (documento: DocumentoJusbr) => documento.dataHoraJuntada ?? "";
  return todos.sort((a, b) => momento(a).localeCompare(momento(b)) || (a.sequencia ?? 0) - (b.sequencia ?? 0));
}

/** Os documentos que ainda não vieram em downloads anteriores (chaves de outros sistemas não contam). */
export function documentosNovosJusbr(documentos: DocumentoJusbr[], baixadas: readonly string[] | undefined): DocumentoJusbr[] {
  const ja = new Set((baixadas ?? []).filter((chave) => chave.startsWith("jusbr:")));
  return ja.size ? documentos.filter((documento) => !ja.has(chaveDoDocumentoJusbr(documento) ?? "")) : documentos;
}

/** Endereço absoluto de um link da ficha ("/processos/.../binario"). */
export function urlDaApi(href: string): string {
  return href.startsWith("http") ? href : `${API_JUSBR}${href.startsWith("/") ? "" : "/"}${href}`;
}

/** O que a API respondeu, em português, para a ficha do processo. */
export function motivoDaResposta(status: number): string | null {
  if (status === 200) return null;
  if (status === 404) return "o processo não foi encontrado no Jus.br (tribunal ou sistema ainda não integrado, ou processo sigiloso)";
  if (status === 403) return "o Jus.br negou o acesso (processo sigiloso ou limite de consultas)";
  if (status === 401) return "a sessão do Jus.br venceu";
  if (status >= 500) return `o Jus.br está instável (erro ${status})`;
  return `o Jus.br respondeu ${status}`;
}

/** Texto seguro para a fonte padrão do PDF (WinAnsi): troca o que ela não desenha. */
export function textoParaPdf(texto: string): string {
  return texto
    .replace(/\r/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\n\t\x20-\x7E -ÿ]/g, "?");
}
