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
}

export interface Conector {
  /** "sistema:TRIBUNAL", como o ORQESTRAI grava no pedido (ex.: "esaj:TJSP"). */
  chave: string;
  /** Deixa a sessão do tribunal pronta (com a pessoa, se preciso). Usado também pelo modo --login. */
  entrar(ambiente: Ambiente): Promise<void>;
  /** Baixa os autos do pedido para `destino` (caminho do PDF). */
  baixar(ambiente: Ambiente, pedido: Pedido, destino: string): Promise<void>;
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
