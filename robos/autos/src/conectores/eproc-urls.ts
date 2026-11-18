import type { NumeroCnj } from "./esaj-urls.ts";

/**
 * eproc, sem navegador (o que dá para testar sozinho). O eproc é o mesmo sistema (o nacional, do TRF4) em
 * vários tribunais: mudam os endereços das instalações e o SSO (Keycloak) de cada um.
 *
 * - TJSP: uma instalação por competência (1º grau cível; execução fiscal e Fazenda Pública; 2º grau), todas
 *   atrás do mesmo login (sso.tjsp.jus.br). Endereços conferidos na página pública em 12/11/2026.
 * - TJRJ: 1º e 2º grau (eproc1g e eproc2g.tjrj.jus.br), login em eproc-sso.tjrj.jus.br, que passa pelo SSO
 *   nacional da PDPJ (sso.cloud.pje.jus.br). Desde maio de 2026 todo processo cível novo é distribuído no eproc,
 *   e o tribunal migra para ele, com o mesmo número CNJ, o acervo do DCP (sistema próprio, Portal de Serviços)
 *   e do PJe. Conferido na página pública e na tela de login em 18/11/2026.
 *
 * Entrar numa instalação vale para as outras do mesmo tribunal. O número do processo não diz em qual instalação
 * ele está; o robô procura na ordem de `instanciasDoCnj`.
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

export const INSTANCIAS_EPROC_TJRJ: InstanciaEproc[] = [
  { rotulo: "1º grau", base: "https://eproc1g.tjrj.jus.br/eproc" },
  { rotulo: "2º grau", base: "https://eproc2g.tjrj.jus.br/eproc" },
];

export interface TribunalEproc {
  sigla: string;
  instancias: InstanciaEproc[];
  /** Telas de login do SSO do tribunal (usuário e senha, código ou certificado). */
  sso: RegExp;
  /** Valor de `?sistema=` na fonte do código de 2 fatores: cada tribunal tem o seu segredo de TOTP. */
  sistema2fa: string;
  /** Onde o processo pode estar quando não aparece no eproc (vai na mensagem de erro). */
  foraDoEproc: string;
}

export const TRIBUNAIS_EPROC: TribunalEproc[] = [
  {
    sigla: "TJSP",
    instancias: INSTANCIAS_EPROC_TJSP,
    sso: /^https:\/\/(certificado-)?sso\.tjsp\.jus\.br\//i,
    sistema2fa: "eproc",
    foraDoEproc: "Pode estar no e-SAJ, ser criminal, ou estar em segredo de justiça sem acesso do advogado.",
  },
  {
    sigla: "TJRJ",
    instancias: INSTANCIAS_EPROC_TJRJ,
    // O endereço do login por certificado não foi conferido: vale o mesmo host, com ou sem "certificado-" na frente.
    sso: /^https:\/\/(certificado-)?eproc-sso\.tjrj\.jus\.br\//i,
    sistema2fa: "eproc-tjrj",
    foraDoEproc:
      "Processo do TJRJ que ainda não migrou para o eproc continua no DCP (Portal de Serviços, o sistema próprio) ou no PJe, que o robô ainda não atende: anexe o PDF à mão. Também pode ser criminal, ou estar em segredo de justiça sem acesso do advogado.",
  },
];

export function tribunalEproc(sigla: string): TribunalEproc {
  const tribunal = TRIBUNAIS_EPROC.find((item) => item.sigla === sigla);
  if (!tribunal) throw new Error(`Tribunal sem eproc mapeado: ${sigla}.`);
  return tribunal;
}

/** O tribunal estadual pelo J.TR do CNJ (8.26 → TJSP, 8.19 → TJRJ), só para os que têm eproc mapeado. */
export function tribunalEprocDoCnj(cnj: string): TribunalEproc | null {
  const digitos = cnj.replace(/\D/g, "");
  if (digitos.length !== 20 || digitos[13] !== "8") return null;
  const sigla = ({ "26": "TJSP", "19": "TJRJ" } as Record<string, string>)[digitos.slice(14, 16)];
  return sigla ? tribunalEproc(sigla) : null;
}

/** Onde procurar o processo: número com origem 0000 (recurso ou ação do próprio tribunal) começa pelo 2º grau. */
export function instanciasDoCnj(cnj: NumeroCnj, instancias: InstanciaEproc[] = INSTANCIAS_EPROC_TJSP): InstanciaEproc[] {
  if (!cnj.segundoGrau) return instancias;
  const segundo = instancias.filter((instancia) => /2º grau/.test(instancia.rotulo));
  return [...segundo, ...instancias.filter((instancia) => !segundo.includes(instancia))];
}

/** Tela de login do SSO do tribunal (usuário e senha, código ou certificado). Sem tribunal, o do TJSP. */
export function ehLoginSso(url: string, tribunal: TribunalEproc = TRIBUNAIS_EPROC[0]): boolean {
  return tribunal.sso.test(url);
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

/**
 * Identidade de uma peça nos autos do eproc: o evento e o nome do documento ("12:PET1"). Os eventos não mudam
 * depois de lançados; é por ela que o próximo download traz só o que ainda não veio.
 */
export function chaveDaPeca(documento: Pick<DocumentoEproc, "evento" | "nome">): string {
  return `${documento.evento}:${documento.nome.replace(/\s+/g, " ").trim().toUpperCase()}`;
}

/** O aviso que a pesquisa devolveu, sem a faixa fixa de "Usuário logado como … Sair do Sistema". */
export function mensagemDaPesquisa(textos: string[]): string | null {
  const aviso = textos.map((texto) => texto.replace(/\s+/g, " ").trim()).find((texto) => texto && !/usu[áa]rio logado como|sair do sistema/i.test(texto));
  return aviso ? aviso.slice(0, 200) : null;
}

/** As peças que ainda não foram baixadas, na ordem dos autos. */
export function pecasNovas(documentos: DocumentoEproc[], baixadas: readonly string[] | undefined): DocumentoEproc[] {
  if (!baixadas?.length) return documentos;
  const ja = new Set(baixadas);
  return documentos.filter((documento) => !ja.has(chaveDaPeca(documento)));
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
