import { lerPublicacao } from "./leitura";
import type { ConferenciaItem, PublicacaoResumo } from "./types";

/** Sem acento, minúsculas e espaços simples: "Pague  Menos" e "pague menos" são a mesma coisa. */
export function normalizarBusca(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Palavras da busca, já normalizadas. */
export function termosDaBusca(busca: string): string[] {
  return normalizarBusca(busca).split(" ").filter(Boolean);
}

/**
 * A busca da Vistagem: cada palavra precisa aparecer em algum dos campos, em qualquer ordem ("menos pague" acha
 * "Pague Menos"; "metalcasty grupo" acha o "Grupo Metalcasty"). Palavra com 4 dígitos ou mais vale também sem a
 * pontuação ("0010869", "108695320245150126" e "0010869-53" acham o mesmo processo). Busca vazia combina com tudo.
 */
export function combinaCampos(campos: (string | null | undefined)[], busca: string): boolean {
  const termos = termosDaBusca(busca);
  if (!termos.length) return true;
  const textos = campos.filter((campo): campo is string => Boolean(campo)).map(normalizarBusca);
  const digitosDosTextos = textos.map((texto) => texto.replace(/\D/g, ""));
  return termos.every((termo) => {
    if (textos.some((texto) => texto.includes(termo))) return true;
    const digitos = termo.replace(/\D/g, "");
    return digitos.length >= 4 && digitosDosTextos.some((texto) => texto.includes(digitos));
  });
}

/**
 * O que se busca numa publicação, em todas as abas: processo, pasta, grupo, cliente, área, tribunal, órgão, ação,
 * advogado da pasta, intimados e as partes do texto. Ler o texto custa: guarde o resultado por publicação.
 */
export function camposDaPublicacao(publicacao: PublicacaoResumo): string[] {
  const leitura = lerPublicacao(publicacao.teor);
  return [
    publicacao.numeroProcesso,
    publicacao.numeroProcessoOriginal,
    publicacao.pastaCi,
    publicacao.grupoCliente,
    publicacao.cliente,
    publicacao.escritorioResponsavel,
    publicacao.tribunal,
    publicacao.djenOrgao,
    publicacao.acaoProcesso,
    publicacao.advogadoResponsavel,
    publicacao.sugestaoTriagem?.grupo,
    publicacao.sugestaoTriagem?.cliente,
    ...publicacao.pastasCandidatas.map((pasta) => pasta.grupoCliente),
    ...publicacao.djenIntimados,
    ...leitura.partes.map((parte) => parte.nome),
  ].filter((campo): campo is string => Boolean(campo));
}

/** Publicação depois da vistagem: o que a publicação tem, mais quem vistou e conferiu, as tarefas e quem fica nelas. */
export function camposDaConferencia(item: ConferenciaItem): string[] {
  return [
    ...camposDaPublicacao(item.publicacao),
    item.vistadoPor,
    item.revistadoPor,
    item.conferidoPor,
    item.auxiliar,
    ...item.agendamentos.flatMap((agendamento) => [agendamento.tarefa, agendamento.responsavel, agendamento.revisor, agendamento.viosTarefaId]),
  ].filter((campo): campo is string => Boolean(campo));
}

/** No Check, também quem checou. A tela e a busca no banco usam a mesma lista, para acharem a mesma coisa. */
export function camposDoCheck(item: ConferenciaItem): string[] {
  return item.checadoPor ? [...camposDaConferencia(item), item.checadoPor] : camposDaConferencia(item);
}

/** A busca nas Checadas vai ao banco a partir deste tamanho; abaixo disso, procura só no que está na tela. */
export const MINIMO_BUSCA_NO_BANCO = 3;

/** Letras que a busca acha com ou sem acento (o banco já ignora maiúsculas, inclusive nas acentuadas). */
const VARIANTES: Record<string, string> = {
  a: "aáàâãä",
  e: "eéèêë",
  i: "iíìîï",
  o: "oóòôõö",
  u: "uúùûü",
  c: "cç",
  n: "nñ",
};

/**
 * Expressão regular do banco (`imatch`) para uma palavra da busca: "insolvencia" acha "Insolvência". Letras e números
 * entram como estão; qualquer outro sinal vira "qualquer caractere". O banco só separa as candidatas: o resultado
 * ainda passa pelo `combinaCampos`, que é quem decide.
 */
export function padraoDoTermo(termo: string): string {
  return [...normalizarBusca(termo)]
    .map((letra) => (VARIANTES[letra] ? `[${VARIANTES[letra]}]` : /[a-z0-9]/.test(letra) ? letra : "."))
    .join("");
}

/** Os dígitos da palavra, quando são 4 ou mais (número do processo, CI): valem também sem a pontuação. */
export function digitosDoTermo(termo: string): string | null {
  const digitos = termo.replace(/\D/g, "");
  return digitos.length >= 4 ? digitos : null;
}
