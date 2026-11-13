import type { NumeroCnj } from "./esaj-urls.ts";

/**
 * eproc do TJSP, sem navegador (o que dá para testar sozinho). O TJSP tem uma instalação do eproc por
 * competência, todas atrás do mesmo login (SSO do tribunal, Keycloak): entrar numa vale para as outras.
 * O número do processo não diz em qual instalação ele está; o robô procura na ordem de `instanciasDoCnj`.
 * Endereços conferidos na página pública em 12/11/2026.
 */

export interface InstanciaEproc {
  /** Como aparece nas mensagens: "1º grau cível", "2º grau"… */
  rotulo: string;
  /** Até /eproc, sem barra no fim. */
  base: string;
}

export const INSTANCIAS_EPROC_TJSP: InstanciaEproc[] = [
  { rotulo: "1º grau cível", base: "https://eproc1g.tjsp.jus.br/eproc" },
  { rotulo: "1º grau de execução fiscal e Fazenda Pública", base: "https://eproc1g-ef.tjsp.jus.br/eproc" },
  { rotulo: "2º grau", base: "https://eproc2g.tjsp.jus.br/eproc" },
];

/** Onde procurar o processo: número com origem 0000 (recurso ou ação do próprio tribunal) começa pelo 2º grau. */
export function instanciasDoCnj(cnj: NumeroCnj, instancias: InstanciaEproc[] = INSTANCIAS_EPROC_TJSP): InstanciaEproc[] {
  if (!cnj.segundoGrau) return instancias;
  const segundo = instancias.filter((instancia) => /2º grau/.test(instancia.rotulo));
  return [...segundo, ...instancias.filter((instancia) => !segundo.includes(instancia))];
}

/** Tela de login do SSO do tribunal (usuário e senha, código ou certificado). */
export function ehLoginSso(url: string): boolean {
  return /^https:\/\/(certificado-)?sso\.tjsp\.jus\.br\//i.test(url);
}

/** Área logada do eproc: controlador.php. A área pública é externo_controlador.php. */
export function ehAreaLogada(url: string): boolean {
  return /\/eproc\/controlador\.php/i.test(url);
}

/** A capa do processo pedido está aberta? O eproc mostra o número com máscara na capa. */
export function ehCapaDoProcesso(url: string, texto: string, cnj: NumeroCnj): boolean {
  if (!ehAreaLogada(url) || !/acao=processo_selecionar/i.test(url)) return false;
  return texto.includes(cnj.mascarado) || texto.replace(/\D/g, "").includes(cnj.mascarado.replace(/\D/g, ""));
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * O processo é sigiloso? O eproc mostra o nível de sigilo na capa ("Sem Sigilo (Nível 0)", "Segredo de
 * Justiça (Nível 1)"…). Na dúvida, trata como segredo: o pedido espera a liberação na ficha.
 */
export function emSegredoPelaCapa(texto: string): boolean {
  const limpo = semAcento(texto).replace(/\s+/g, " ");
  const nivel = /nivel\s*(\d)/.exec(limpo.match(/sigilo[^.]{0,80}/)?.[0] ?? "");
  if (nivel) return Number(nivel[1]) > 0;
  if (/sem sigilo/.test(limpo)) return false;
  // \b: "sigiloso", não "sigilosos" (item de menu).
  return /segredo de justica|\bsigiloso\b|tramitacao sigilosa/.test(limpo);
}

export interface DocumentoEproc {
  evento: number;
  /** Ordem do documento dentro do evento (DEC1, DEC2…). */
  ordem: number;
  nome: string;
  data: string;
  url: string;
}

/** Ordem dos autos: do evento mais antigo para o mais novo (a tabela da capa vem do mais novo para o mais antigo). */
export function ordenarDocumentos(documentos: DocumentoEproc[]): DocumentoEproc[] {
  const vistos = new Set<string>();
  return [...documentos]
    .sort((a, b) => a.evento - b.evento || a.ordem - b.ordem)
    .filter((documento) => {
      // O mesmo documento pode aparecer duas vezes (evento que referencia outro): entra uma vez só.
      const chave = documento.url.replace(/([?&](hash|key)=)[^&]+/gi, "");
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
}

export type TipoDeArquivo = "pdf" | "imagem-png" | "imagem-jpg" | "html" | "outro";

/** Pelo tipo informado pelo tribunal e, na falta, pelos primeiros bytes. */
export function tipoDoArquivo(contentType: string, inicio: Uint8Array): TipoDeArquivo {
  const assinatura = String.fromCharCode(...inicio.slice(0, 8));
  if (assinatura.startsWith("%PDF-")) return "pdf";
  if (inicio[0] === 0x89 && assinatura.slice(1, 4) === "PNG") return "imagem-png";
  if (inicio[0] === 0xff && inicio[1] === 0xd8) return "imagem-jpg";
  if (/pdf/i.test(contentType)) return "pdf";
  if (/html/i.test(contentType) || /^\s*</.test(assinatura)) return "html";
  return "outro";
}

/**
 * O eproc abre alguns documentos numa página que embute o arquivo (iframe, embed ou object). Devolve o
 * endereço do arquivo embutido, absoluto, ou null.
 */
export function arquivoEmbutido(html: string, endereco: string): string | null {
  const achado = /<(?:iframe|embed|object)\b[^>]*?\b(?:src|data)\s*=\s*["']([^"']+)["']/i.exec(html);
  if (!achado) return null;
  const alvo = achado[1].replace(/&amp;/g, "&");
  if (/^(about:|javascript:)/i.test(alvo)) return null;
  try {
    return new URL(alvo, endereco).toString();
  } catch {
    return null;
  }
}
