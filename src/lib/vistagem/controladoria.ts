import { mascararCnj } from "./processo";
import { chaveCliente, numerosCitados, pastaAtiva, type SugestaoTriagem } from "./sugestao-triagem";
import type { PastaSioe } from "./triagem";

/**
 * Apoio à controladoria nas pendências da triagem: qual pasta sugerir quando o processo tem mais
 * de uma e o que o sistema já procurou antes de dizer que não há pasta (possível abertura).
 */

/** Pasta do processo principal ("PROCESSO PRINCIPAL" no vínculo do VIOS). */
function ehPrincipal(pasta: PastaSioe): boolean {
  return /principal/i.test(pasta.vinculo ?? "");
}

/**
 * Entre as pastas do mesmo processo, a que provavelmente recebe a publicação: a única ativa ou,
 * entre as ativas, a do processo principal. Sem uma escolha clara, null (a controladoria decide).
 */
export function pastaSugerida(candidatas: PastaSioe[]): { pasta: PastaSioe; motivo: string } | null {
  if (candidatas.length < 2) return null;
  const ativas = candidatas.filter(pastaAtiva);
  if (ativas.length === 1) {
    return { pasta: ativas[0], motivo: ehPrincipal(ativas[0]) ? "Única pasta ativa e é a do processo principal." : "Única pasta ativa." };
  }
  const principais = (ativas.length ? ativas : candidatas).filter(ehPrincipal);
  if (principais.length === 1) {
    return { pasta: principais[0], motivo: ativas.length ? "Pasta ativa do processo principal." : "Pasta do processo principal (nenhuma está ativa)." };
  }
  return null;
}

/** O cliente da pasta aparece no texto da publicação (partes ou intimados)? */
export function clienteNoTexto(pasta: PastaSioe, texto: string): boolean {
  const cliente = chaveCliente(pasta.cliente);
  if (cliente.length < 4) return false;
  return chaveCliente(texto).includes(cliente);
}

export type SituacaoVerificacao = "achou" | "nada" | "nao_verificado";

export interface Verificacao {
  rotulo: string;
  situacao: SituacaoVerificacao;
  detalhe: string;
}

/**
 * O que já foi procurado para a publicação sem pasta, na ordem do roteiro da controladoria:
 * o número no SIOE, o processo citado no texto, as partes que são clientes e a leitura da IA.
 */
export function verificacoesSemPasta(publicacao: {
  teor: string;
  numeroProcesso: string | null;
  sugestaoTriagem: SugestaoTriagem | null;
}): Verificacao[] {
  const sugestao = publicacao.sugestaoTriagem;
  const citados = numerosCitados(publicacao.teor, publicacao.numeroProcesso);
  const referencia = sugestao?.referencia;
  const grupoDaReferencia = referencia ? [referencia.grupo, referencia.cliente].filter(Boolean).join(" · ") : "";

  const numero: Verificacao = {
    rotulo: "Número do processo no SIOE",
    situacao: "nada",
    detalhe: "Nenhuma pasta com este número.",
  };

  const citado: Verificacao =
    sugestao?.origem === "numero" && referencia
      ? {
          rotulo: "Processo citado no texto",
          situacao: "achou",
          detalhe: `${mascararCnj(referencia.cnj.replace(/\D/g, ""))} tem a pasta CI ${referencia.ci}${grupoDaReferencia ? ` (${grupoDaReferencia})` : ""}.`,
        }
      : {
          rotulo: "Processo citado no texto",
          situacao: "nada",
          detalhe: citados.length
            ? `Cita ${citados.map(mascararCnj).join(", ")}, sem pasta no VIOS.`
            : "O texto não cita outro processo.",
        };

  // O roteiro para no primeiro achado: com o processo citado, as partes não chegam a ser procuradas.
  const partes: Verificacao =
    sugestao?.origem === "numero"
      ? { rotulo: "Partes que são clientes", situacao: "nao_verificado", detalhe: "Não foi preciso: o processo citado já indicou a pasta." }
      : sugestao?.origem === "parte"
        ? {
            rotulo: "Partes que são clientes",
            situacao: "achou",
            detalhe: `${sugestao.cliente ?? "Uma parte"} é cliente${grupoDaReferencia ? ` (${grupoDaReferencia}${referencia ? `, CI ${referencia.ci}` : ""})` : ""}.`,
          }
        : sugestao
          ? { rotulo: "Partes que são clientes", situacao: "nada", detalhe: "Nenhuma parte tem processo no VIOS." }
          : { rotulo: "Partes que são clientes", situacao: "nao_verificado", detalhe: "Ainda não procurado." };

  const ia: Verificacao =
    sugestao?.origem === "ia"
      ? {
          rotulo: "Leitura da IA",
          situacao: sugestao.grupo || sugestao.cliente ? "achou" : "nada",
          detalhe: sugestao.motivo,
        }
      : { rotulo: "Leitura da IA", situacao: "nao_verificado", detalhe: sugestao ? "Não foi preciso." : "Ainda não pedida." };

  return [numero, citado, partes, ia];
}
