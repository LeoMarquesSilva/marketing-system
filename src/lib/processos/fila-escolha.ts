/**
 * Em que ordem a fila do robô de autos oferece os pedidos, e quando um pedido que não anda sai da fila. Funções
 * puras (sem banco), para dar para testar; quem grava é robo-server.ts.
 *
 * O problema que isto resolve (27/11/2026): o robô atende um pedido por vez. Quando ele para num login, código de
 * verificação ou CAPTCHA e ninguém aparece, o pedido fica "aguardando pessoa" e volta a ser oferecido minutos
 * depois. Como a fila andava do mais antigo para o mais novo, o mesmo pedido parado voltava sempre na frente, o robô
 * esperava a pessoa de novo, e os pedidos de trás nunca andavam. Agora:
 *   1. pedido novo (pendente) vem sempre antes de pedido que já parou;
 *   2. pedido que parou esperando uma pessoa (ou que derrubou o robô no meio) volta poucas vezes; depois disso sai
 *      da fila como erro, com a mensagem dizendo o que faltou, e a pessoa pede de novo quando puder.
 */

/** Pedido "em andamento" sem notícia do robô há este tempo volta para a fila. */
export const PEDIDO_PARADO_MS = 20 * 60_000;
/** Enquanto espera a pessoa, o robô dá sinal a cada minuto; sem sinal há este tempo, o pedido volta a ser oferecido. */
export const ESPERA_PARADA_MS = 3 * 60_000;
/** Tentativas de um pedido que parou esperando uma pessoa antes de sair da fila. */
export const TENTATIVAS_COM_PESSOA = 3;
/** Tentativas de um pedido que ficou sem notícia no meio (o robô caiu ou reiniciou) antes de sair da fila. */
export const TENTATIVAS_PARADO = 4;

export interface PedidoDaFila {
  sistema: string;
  tribunal: string;
  status: string;
  motivoEspera: string | null;
  tentativas: number;
  criadoEm: string;
  atualizadoEm: string;
}

/** O conector que atende o pedido, como o robô o anuncia ("esaj:TJSP"; o Jus.br, que atende todos, "jusbr:BR"). */
export function conectorDoPedido(pedido: Pick<PedidoDaFila, "sistema" | "tribunal">): string {
  return pedido.sistema === "jusbr" ? "jusbr:BR" : `${pedido.sistema}:${pedido.tribunal}`;
}

export type DecisaoDaFila<P> = { tipo: "oferecer"; pedido: P } | { tipo: "tirar"; pedido: P; mensagem: string };

const BARREIRA: Record<string, string> = {
  login: "o login no tribunal",
  segundo_fator: "o código de verificação do login",
  captcha: "o CAPTCHA do tribunal",
};

function mensagemDeSaida(pedido: PedidoDaFila): string {
  if (pedido.status === "aguardando_pessoa") {
    const barreira = BARREIRA[pedido.motivoEspera ?? ""] ?? "uma etapa do login";
    return (
      `O robô parou ${pedido.tentativas} vezes esperando uma pessoa resolver ${barreira} e ninguém concluiu. ` +
      "O pedido saiu da fila para não segurar os outros: peça os autos de novo quando houver alguém para o login, ou anexe o PDF."
    );
  }
  return `O robô parou no meio deste pedido ${pedido.tentativas} vezes sem terminar. O pedido saiu da fila para não segurar os outros: peça os autos de novo ou anexe o PDF.`;
}

/**
 * O que fazer com a fila, na ordem em que o robô deve tentar: os pedidos que ele pode pegar (`oferecer`) e os que
 * pararam vezes demais (`tirar`, de qualquer conector: quem passar primeiro limpa). Pendentes vêm antes dos que
 * já pararam; dentro de cada grupo, o mais antigo primeiro.
 *
 * Segredo de justiça sem liberação nunca volta ao robô: espera a decisão de uma pessoa na ficha, sem prazo.
 */
export function decidirFila<P extends PedidoDaFila>(pedidos: readonly P[], conectoresDoRobo: ReadonlySet<string>, agoraMs: number): DecisaoDaFila<P>[] {
  const pendentes: P[] = [];
  const parados: P[] = [];
  const tirar: DecisaoDaFila<P>[] = [];
  for (const pedido of pedidos) {
    const semNoticia = agoraMs - new Date(pedido.atualizadoEm).getTime();
    if (pedido.status === "pendente") {
      if (conectoresDoRobo.has(conectorDoPedido(pedido))) pendentes.push(pedido);
      continue;
    }
    const esperandoPessoa = pedido.status === "aguardando_pessoa" && pedido.motivoEspera !== "segredo_justica" && semNoticia > ESPERA_PARADA_MS;
    const caiuNoMeio = pedido.status === "em_andamento" && semNoticia > PEDIDO_PARADO_MS;
    if (!esperandoPessoa && !caiuNoMeio) continue;
    if (pedido.tentativas >= (esperandoPessoa ? TENTATIVAS_COM_PESSOA : TENTATIVAS_PARADO)) {
      tirar.push({ tipo: "tirar", pedido, mensagem: mensagemDeSaida(pedido) });
      continue;
    }
    if (conectoresDoRobo.has(conectorDoPedido(pedido))) parados.push(pedido);
  }
  const porIdade = (a: P, b: P) => a.criadoEm.localeCompare(b.criadoEm);
  return [...tirar, ...pendentes.sort(porIdade).map((pedido) => ({ tipo: "oferecer" as const, pedido })), ...parados.sort(porIdade).map((pedido) => ({ tipo: "oferecer" as const, pedido }))];
}
