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
    item.conferidoPor,
    item.auxiliar,
    ...item.agendamentos.flatMap((agendamento) => [agendamento.tarefa, agendamento.responsavel, agendamento.revisor, agendamento.viosTarefaId]),
  ].filter((campo): campo is string => Boolean(campo));
}
