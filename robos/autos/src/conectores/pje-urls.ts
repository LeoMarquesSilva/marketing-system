import { cnjDoTjrj } from "./dcp-tjrj-urls.ts";

/**
 * PJe, sem navegador (o que dá para testar sozinho). RASCUNHO: o conector ainda não está registrado (nem em
 * CONECTORES, no robô, nem em CONECTORES_DISPONIVEIS, no ORQESTRAI). Por ora, só o PJe do TJRJ.
 *
 * Conferido em 18/11/2026 nas páginas públicas e nos manuais:
 * - 1º grau: tjrj.pje.jus.br/1g. O login.seam redireciona ao SSO nacional da PDPJ (sso.cloud.pje.jus.br, realm
 *   "pje", client_id "pje-tjrj-1g"), com "CPF/CNPJ" (#username), senha (#password), "Entrar" (#kc-login),
 *   "CERTIFICADO DIGITAL" (#kc-pje-office, pelo PJe Office) e "Entrar com gov.br". Versão 2.9.7 na tela.
 * - 2º grau: tjrj.pje.jus.br/2g/login.seam tem login próprio (versão 2.1.2.5, "CPF | CNPJ", senha e "Modo de
 *   assinatura: Java Applet / PJeOffice"), sem passar pelo SSO.
 * - Duplo fator (manual "Novo Acesso ao PJe", TJRJ): código de 6 dígitos do Microsoft Authenticator, campo próprio
 *   e botão "Validar", depois do usuário e senha ou do certificado.
 * - Consulta (manual do usuário externo PJe Advogado/Parte, TJRJ, v1.4): aba "Consultar Processos", preencher e
 *   "Pesquisar"; clicar no número abre os "Autos Digitais" em outra aba. Aba "Acervo" lista os processos do
 *   advogado por comarca.
 * - Autos digitais (manual do advogado, docs.pje.jus.br): cabeçalho com "Segredo de justiça"; por documento, ícone
 *   de download; ícone de download do processo, "por Id, Período ou todo o conteúdo"; favoritos com download.
 * - Migração (Dica de Sistema "Migração PJe x eproc", TJRJ): processo migrado mostra "Processo migrado para o eproc,
 *   acesse-o através do link …", o peticionamento fica bloqueado e o eproc mantém o número CNJ.
 *
 * Conferido nas telas do 1º grau do TJRJ em 18/11/2026: consulta, autos digitais, download e Área de download (veja
 * pje.ts). O que ainda está marcado como SUPOSIÇÃO vem do PJe nacional (o mesmo sistema em vários tribunais) e será conferido no
 * `npm run mapear -- pje <CNJ>`.
 */

export interface InstanciaPje {
  /** "1g" ou "2g", como na linha de comando. */
  grau: "1g" | "2g";
  rotulo: string;
  /** Até /1g ou /2g, sem barra no fim. */
  base: string;
  /** O login passa pelo SSO nacional da PDPJ (1º grau) ou é a tela do próprio PJe (2º grau). */
  sso: boolean;
}

export const INSTANCIAS_PJE_TJRJ: InstanciaPje[] = [
  { grau: "1g", rotulo: "1º grau", base: "https://tjrj.pje.jus.br/1g", sso: true },
  { grau: "2g", rotulo: "2º grau", base: "https://tjrj.pje.jus.br/2g", sso: false },
];

export function instanciaPjeTjrj(grau: "1g" | "2g"): InstanciaPje {
  return INSTANCIAS_PJE_TJRJ.find((item) => item.grau === grau) ?? INSTANCIAS_PJE_TJRJ[0];
}

export function urlDeLoginPje(instancia: InstanciaPje): string {
  return `${instancia.base}/login.seam`;
}

/** Consulta pública (sem login): existe, mas o robô não usa. Conferida pelo link da tela de login. */
export function urlDaConsultaPublicaPje(instancia: InstanciaPje): string {
  return `${instancia.base}/ConsultaPublica/listView.seam`;
}

/** SUPOSIÇÃO: "Processo > Consultar processo" no PJe nacional. O mapear confere; o menu é o caminho alternativo. */
export function urlDaConsultaPje(instancia: InstanciaPje): string {
  return `${instancia.base}/Processo/ConsultaProcesso/listView.seam`;
}

/** Telas de login: SSO da PDPJ (usuário e senha, código, PJe Office, gov.br) ou o login.seam do próprio PJe. */
export function ehLoginPje(url: string, instancia: InstanciaPje): boolean {
  if (/^https:\/\/sso\.cloud\.pje\.jus\.br\/auth\/realms\/pje\//i.test(url)) return true;
  if (/^https:\/\/sso\.acesso\.gov\.br\//i.test(url)) return true;
  // login.seam com ?code= é a volta do SSO, ainda no meio do login.
  return url.toLowerCase().startsWith(`${instancia.base.toLowerCase()}/login.seam`);
}

/**
 * Área logada do PJe daquela instância: qualquer página .seam fora do login e da consulta pública (painel do
 * advogado, consulta, autos digitais). Critério observável do mapear.
 */
export function ehAreaLogadaPje(url: string, instancia: InstanciaPje): boolean {
  if (ehLoginPje(url, instancia)) return false;
  const base = instancia.base.toLowerCase();
  const endereco = url.toLowerCase();
  if (!endereco.startsWith(`${base}/`)) return false;
  return !/\/(consultapublica|push)\//.test(endereco.slice(base.length));
}

/**
 * Os autos digitais abrem em outra aba. No TJRJ (visto em 18/11/2026) o advogado cai em
 * Processo/ConsultaProcesso/Detalhe/listProcessoCompletoAdvogado.seam?id=…&ca=…; listAutosDigitais.seam é o nome
 * em outras versões do PJe.
 */
export function ehAutosDigitais(url: string): boolean {
  return /\/(listAutosDigitais|listProcessoCompletoAdvogado)\.seam/i.test(url);
}

/** A Área de download do PJe: o PDF pedido nos autos é montado em segundo plano e baixado de lá. */
export function urlDaAreaDeDownloadPje(instancia: InstanciaPje): string {
  return `${instancia.base}/AreaDeDownload/listView.seam`;
}

/** O iframe da Área de download (pje-frontend-docs.tjrj.jus.br/#/area-download no TJRJ). */
export function ehQuadroDaAreaDeDownload(url: string): boolean {
  return /#\/area-download\b/i.test(url);
}

/** Id de um documento pelo rótulo na linha do tempo dos autos ("273922481 - Certidão de Migração"). */
export function idDoRotuloPje(rotulo: string): number | null {
  const achado = /^\s*(\d{6,})\s*-\s*\S/.exec(rotulo);
  return achado ? Number(achado[1]) : null;
}


export interface CamposCnjPje {
  /** NNNNNNN */
  sequencial: string;
  /** DD */
  digito: string;
  /** AAAA */
  ano: string;
  /** J */
  ramo: string;
  /** TR */
  tribunal: string;
  /** OOOO */
  origem: string;
  mascarado: string;
}

/**
 * O número em campos, como a pesquisa do PJe costuma pedir (sequencial, dígito, ano, ramo, tribunal, origem).
 * SUPOSIÇÃO: a consulta do PJe do TJRJ usa esses campos separados; se usar um campo só, vale o `mascarado`.
 */
export function camposCnjPje(cnj: string): CamposCnjPje | null {
  const numero = cnjDoTjrj(cnj);
  if (!numero) return null;
  const digitos = numero.mascarado.replace(/\D/g, "");
  return {
    sequencial: digitos.slice(0, 7),
    digito: digitos.slice(7, 9),
    ano: digitos.slice(9, 13),
    ramo: digitos.slice(13, 14),
    tribunal: digitos.slice(14, 16),
    origem: digitos.slice(16, 20),
    mascarado: numero.mascarado,
  };
}

/**
 * O processo é sigiloso? O cabeçalho dos autos digitais traz "Segredo de justiça" (manual do advogado). SUPOSIÇÃO:
 * o valor vem como SIM ou NÃO logo depois do rótulo. Sem o rótulo, decide pelo texto; na dúvida, segredo.
 */
export function emSegredoPje(texto: string): boolean {
  const limpo = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
  const rotulo = /segredo de justica\s*[:?]?\s*(sim|nao)\b/.exec(limpo);
  if (rotulo) return rotulo[1] === "sim";
  return /segredo de justica|\bsigiloso\b/.test(limpo);
}


/** Identidade de uma peça no PJe: o id do documento, que não muda. É por ela que o próximo download traz só o novo. */
export function chaveDaPecaPje(id: number): string {
  return `pje:${id}`;
}

/**
 * Download incremental: o primeiro id que ainda não veio. Os ids crescem com a juntada (conferido nos autos), então
 * "ID a partir de" (filtro do download do processo, que respeita a faixa) com o maior id baixado + 1 traz só o que
 * é novo. Sem peças anteriores (ou sem chaves do PJe), o processo inteiro (null).
 */
export function idInicialDoIncremental(pecasBaixadas: readonly string[] | undefined): number | null {
  const ids = (pecasBaixadas ?? []).map((chave) => /^pje:(\d+)$/.exec(chave)?.[1]).filter((id): id is string => Boolean(id));
  if (!ids.length) return null;
  return Math.max(...ids.map(Number)) + 1;
}
