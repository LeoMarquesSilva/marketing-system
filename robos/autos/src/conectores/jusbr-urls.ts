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
  dataHoraAjuizamento?: string;
  classe?: { codigo?: number; descricao?: string }[];
  distribuicao?: { orgaoJulgador?: { nome?: string }[]; orgaoJulgadorLocal?: { nome?: string; jurisdicaoLocal?: { nome?: string } } }[];
  movimentos?: { dataHora?: string; descricao?: string; tipo?: { codigo?: number }; complementos?: { nome?: string; valor?: { descricao?: string; valor?: string } }[] }[];
}

export interface FichaJusbr {
  numeroProcesso?: string;
  siglaTribunal?: string;
  nivelSigilo?: number;
  tramitacaoAtual?: TramitacaoJusbr;
  tramitacoes?: TramitacaoJusbr[];
}

export interface DocumentoComChave extends DocumentoJusbr {
  /** "jusbr:<juntada>|<nome>|<n>": igual para a cópia do mesmo documento em outra tramitação (1º e 2º grau). */
  chave: string;
}

/** Nome e momento da juntada: o que identifica o mesmo documento copiado de uma tramitação para outra. */
function identidade(documento: DocumentoJusbr): string {
  const nome = (documento.nome ?? documento.tipo?.nome ?? "").normalize("NFC").replace(/\s+/g, " ").trim().slice(0, 180);
  return `${(documento.dataHoraJuntada ?? "").slice(0, 19)}|${nome}`;
}

/**
 * Todos os documentos da ficha (tramitação atual e as outras, como 1º e 2º grau ou o sistema antigo de um processo
 * migrado), na ordem de juntada, só os que têm arquivo ou texto. O 2º grau repete os documentos do 1º com outro id
 * (visto no TRT15 em 18/11/2026: 99 dos 100 eram cópias): entre tramitações, o mesmo nome e momento de juntada é o
 * mesmo documento e entra uma vez. Dentro de uma tramitação, tudo entra (dois anexos podem ter o mesmo nome).
 */
export function documentosDaFicha(fichas: FichaJusbr[]): DocumentoComChave[] {
  const jaVistas = new Set<string>();
  const todos: DocumentoComChave[] = [];
  for (const ficha of fichas) {
    for (const tramitacao of [ficha.tramitacaoAtual, ...(ficha.tramitacoes ?? [])]) {
      const nesta = new Map<string, number>();
      const daTramitacao: DocumentoComChave[] = [];
      for (const documento of tramitacao?.documentos ?? []) {
        if (!documento.hrefBinario && !documento.hrefTexto) continue;
        const base = identidade(documento);
        const n = (nesta.get(base) ?? 0) + 1;
        nesta.set(base, n);
        daTramitacao.push({ ...documento, chave: `jusbr:${base}|${n}` });
      }
      for (const documento of daTramitacao) {
        if (jaVistas.has(documento.chave)) continue;
        todos.push(documento);
      }
      for (const documento of daTramitacao) jaVistas.add(documento.chave);
    }
  }
  const momento = (documento: DocumentoJusbr) => documento.dataHoraJuntada ?? "";
  return todos.sort((a, b) => momento(a).localeCompare(momento(b)) || (a.sequencia ?? 0) - (b.sequencia ?? 0));
}

/** Os documentos que ainda não vieram em downloads anteriores (chaves de outros sistemas não contam). */
export function documentosNovosJusbr<T extends DocumentoComChave>(documentos: T[], baixadas: readonly string[] | undefined): T[] {
  const ja = new Set((baixadas ?? []).filter((chave) => chave.startsWith("jusbr:")));
  return ja.size ? documentos.filter((documento) => !ja.has(documento.chave)) : documentos;
}

/** A capa que o robô envia ao ORQESTRAI junto com os autos (o formato do CapaDoJusbr de lá). */
export interface CapaDoJusbr {
  siglaTribunal: string | null;
  nivelSigilo: number | null;
  tramitacoes: {
    grau: string | null;
    dataHoraAjuizamento: string | null;
    classe: string | null;
    orgaoJulgador: string | null;
    cidade: string | null;
    movimentos: { dataHora: string | null; descricao: string | null; codigo: number | null; complementos: string[] }[];
  }[];
}

/**
 * Capa e movimentos de cada tramitação (1º grau, 2º grau…), sem partes nem documentos. A mesma tramitação pode vir
 * como atual e na lista: entra uma vez (mesmo grau e ajuizamento).
 */
export function capaDaFicha(fichas: FichaJusbr[]): CapaDoJusbr | null {
  const tramitacoes: CapaDoJusbr["tramitacoes"] = [];
  const vistas = new Set<string>();
  for (const ficha of fichas) {
    for (const tramitacao of [ficha.tramitacaoAtual, ...(ficha.tramitacoes ?? [])]) {
      if (!tramitacao) continue;
      const chave = `${tramitacao.grau?.sigla ?? ""}|${tramitacao.dataHoraAjuizamento ?? ""}`;
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      const distribuicao = tramitacao.distribuicao?.[0];
      tramitacoes.push({
        grau: tramitacao.grau?.sigla ?? null,
        dataHoraAjuizamento: tramitacao.dataHoraAjuizamento ?? null,
        classe: tramitacao.classe?.[0]?.descricao ?? null,
        orgaoJulgador: distribuicao?.orgaoJulgador?.[0]?.nome ?? distribuicao?.orgaoJulgadorLocal?.nome ?? null,
        cidade: distribuicao?.orgaoJulgadorLocal?.jurisdicaoLocal?.nome ?? null,
        movimentos: (tramitacao.movimentos ?? [])
          .filter((movimento) => movimento.dataHora && movimento.descricao)
          .slice(0, 5000)
          .map((movimento) => ({
            dataHora: movimento.dataHora ?? null,
            descricao: (movimento.descricao ?? "").slice(0, 1000),
            codigo: typeof movimento.tipo?.codigo === "number" ? movimento.tipo.codigo : null,
            complementos: (movimento.complementos ?? []).map((item) => (item.valor?.descricao ?? item.valor?.valor ?? item.nome ?? "").slice(0, 300)).filter(Boolean).slice(0, 20),
          })),
      });
    }
  }
  if (!tramitacoes.length) return null;
  return { siglaTribunal: fichas[0]?.siglaTribunal ?? null, nivelSigilo: fichas[0]?.nivelSigilo ?? null, tramitacoes: tramitacoes.slice(0, 10) };
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
