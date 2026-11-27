import type { BrowserContext, Page } from "playwright";
import type { Config } from "../config.ts";
import type { MotivoEspera, Pedido } from "../fila.ts";

/** O que o conector recebe para trabalhar num pedido. */
export interface Ambiente {
  config: Config;
  contexto: BrowserContext;
  pagina: Page;
  registrar: (mensagem: string) => void;
  /**
   * O robô chegou a uma barreira que só uma pessoa resolve (login, código de verificação, CAPTCHA).
   * Marca o pedido como "aguardando pessoa", avisa no terminal e espera `resolvido()` ficar verdadeiro,
   * sem tocar na barreira. Lança EsperaEsgotada se ninguém aparecer.
   */
  aguardarPessoa: (motivo: Exclude<MotivoEspera, "segredo_justica">, instrucao: string, resolvido: () => Promise<boolean>) => Promise<void>;
  /** Guarda captura de tela e HTML da página em diagnostico/, para ajustar o conector. Devolve o caminho. */
  diagnostico: (pagina: Page, etapa: string) => Promise<string>;
  /**
   * Download longo: avisa o ORQESTRAI que o robô segue no pedido (no máximo uma chamada por minuto; pode chamar a
   * cada documento). Pedido cancelado na ficha lança PedidoEncerrado e o robô larga o download na hora.
   */
  sinalDeVida?: () => Promise<void>;
}

export interface ResultadoDoDownload {
  pecas?: string[];
  semNovidades?: boolean;
  /** O pedido acabou atendido por outro sistema (o DCP manda ao eproc o processo migrado; o Jus.br, ao tribunal). */
  sistema?: string;
  /** Jus.br: capa e movimentos da ficha, que o ORQESTRAI grava na capa e na linha do tempo. */
  capa?: unknown;
  /** Processo grande em partes (Jus.br): cada PDF com as suas peças. O primeiro é o `destino`. */
  arquivos?: { caminho: string; pecas: string[] }[];
  /** Jus.br: documentos que ficaram para o próximo pedido (processo maior que um lote). */
  restantes?: number;
}

export interface Conector {
  /** "sistema:TRIBUNAL", como o ORQESTRAI grava no pedido (ex.: "esaj:TJSP"). */
  chave: string;
  /** Deixa a sessão do tribunal pronta (com a pessoa, se preciso). Usado também pelo modo --login. */
  entrar(ambiente: Ambiente): Promise<void>;
  /**
   * Baixa os autos do pedido para `destino` (caminho do PDF). O eproc devolve as peças que vieram (para o
   * próximo download trazer só as novas) ou `semNovidades` quando não há nada novo (sem PDF).
   */
  baixar(ambiente: Ambiente, pedido: Pedido, destino: string): Promise<ResultadoDoDownload | void>;
  /** Abre os autos e só descreve o que achou na tela (modo --inspecionar), sem baixar. */
  inspecionar?(ambiente: Ambiente, cnj: string): Promise<void>;
}

/** Processo em segredo de justiça sem liberação: o pedido fica à espera da decisão de uma pessoa na ficha. */
export class SegredoDeJustica extends Error {
  constructor() {
    super("Processo em segredo de justiça: o download depende de liberação na ficha.");
  }
}

/** Ninguém concluiu o login, o código ou o CAPTCHA a tempo: o pedido continua "aguardando pessoa". */
export class EsperaEsgotada extends Error {}

/** Falha em que não adianta tentar de novo sozinho; a mensagem vai para a ficha do processo. */
export class FalhaDoConector extends Error {}

/**
 * O PJe ou o DCP dizem que o processo migrou para o eproc (`reserva`, ex.: "eproc:TJRJ") e este robô não atende o
 * eproc do tribunal: o pedido volta à fila no eproc, para o robô que já tem esse login. Sem o repasse, vira erro com
 * a mensagem.
 */
export class MigradoParaEproc extends FalhaDoConector {
  constructor(
    readonly reserva: string,
    mensagem: string
  ) {
    super(mensagem);
  }
}
