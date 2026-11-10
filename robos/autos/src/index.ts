import { rm } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as dormir } from "node:timers/promises";
import type { Page } from "playwright";
import { lerConfig } from "./config.ts";
import { conectoresEsaj } from "./conectores/esaj.ts";
import { lerCnj, nomeDoPdf, tribunalEsajDoCnj } from "./conectores/esaj-urls.ts";
import { EsperaEsgotada, FalhaDoConector, SegredoDeJustica, type Ambiente, type Conector } from "./conectores/tipos.ts";
import { Fila, PedidoEncerrado, type Pedido } from "./fila.ts";
import { abrirNavegador, guardarDiagnostico } from "./navegador.ts";

/**
 * Robô de autos do ORQESTRAI. Consome a fila proc_autos_pedidos (pelas rotas /api/robos/autos), baixa os
 * autos no tribunal com a sessão do advogado e sobe o PDF ao bucket privado. A leitura pela IA acontece
 * depois, no ORQESTRAI.
 *
 *   npm run robo          fica rodando e atende a fila
 *   npm run uma-vez       atende o que estiver na fila e sai
 *   npm run login [-- TJCE]        só abre a sessão do tribunal (TJSP se não disser qual)
 *   npm run inspecionar -- <CNJ>   abre o processo e descreve a tela, sem baixar
 */

/** Um conector por sistema e tribunal ("esaj:TJSP", "esaj:TJCE"…). Os próximos (PJe, eproc, Projudi) entram aqui. */
const CONECTORES: Conector[] = [...conectoresEsaj];

/** O conector do tribunal pedido na linha de comando ("TJCE"), ou do tribunal do número do processo; TJSP se nada disser. */
function conectorDaLinhaDeComando(cnj?: string): Conector {
  const sigla = (cnj ? tribunalEsajDoCnj(cnj)?.sigla : undefined) ?? argumentos.find((item) => /^TJ[A-Z]{2,3}$/.test(item)) ?? "TJSP";
  const conector = CONECTORES.find((item) => item.chave === `esaj:${sigla}`);
  if (!conector) throw new Error(`Este robô ainda não atende o ${sigla}. Atende: ${CONECTORES.map((item) => item.chave.split(":")[1]).join(", ")}.`);
  return conector;
}

const argumentos = process.argv.slice(2);
const modo = argumentos.includes("--login") ? "login" : argumentos.includes("--inspecionar") ? "inspecionar" : argumentos.includes("--uma-vez") ? "uma-vez" : "continuo";

function registrar(mensagem: string): void {
  console.log(`[${new Date().toLocaleTimeString("pt-BR")}] ${mensagem}`);
}

/** Só a primeira linha, sem o "Call log" do Playwright (que pode citar o que foi digitado na tela). */
function mensagemLimpa(erro: unknown): string {
  if (erro instanceof FalhaDoConector) return erro.message;
  const texto = erro instanceof Error ? erro.message : String(erro);
  return `Falha inesperada no robô: ${texto.split("\n")[0].slice(0, 300)}`;
}

async function principal(): Promise<void> {
  const config = lerConfig();
  const fila = new Fila(config);
  const { contexto, pagina, fechar } = await abrirNavegador(config);
  let encerrando = false;
  const encerrar = async () => {
    if (encerrando) return;
    encerrando = true;
    registrar("Encerrando o robô.");
    await fechar();
    process.exit(0);
  };
  process.on("SIGINT", () => void encerrar());
  process.on("SIGTERM", () => void encerrar());

  function ambientePara(pedido: Pedido | null): Ambiente {
    return {
      config,
      contexto,
      pagina,
      registrar,
      diagnostico: (alvo: Page, etapa: string) => guardarDiagnostico(config, alvo, etapa),
      async aguardarPessoa(motivo, instrucao, resolvido) {
        registrar(`>>> PRECISA DE UMA PESSOA: ${instrucao}`);
        process.stdout.write("\u0007");
        if (pedido) await fila.aguardarPessoa(pedido.id, motivo);
        const limite = Date.now() + config.esperaPessoaMs;
        let ultimoSinal = Date.now();
        while (Date.now() < limite) {
          await dormir(2_000);
          if (await resolvido().catch(() => false)) {
            if (pedido) await fila.seguir(pedido.id);
            registrar("Resolvido. O robô segue.");
            return;
          }
          // Sinal de vida a cada minuto: a ficha continua mostrando que o robô espera a pessoa.
          if (pedido && Date.now() - ultimoSinal > 60_000) {
            await fila.aguardarPessoa(pedido.id, motivo);
            ultimoSinal = Date.now();
          }
        }
        throw new EsperaEsgotada(`Ninguém concluiu a etapa (${motivo}) em ${Math.round(config.esperaPessoaMs / 60_000)} min.`);
      },
    };
  }

  if (modo === "login") {
    await conectorDaLinhaDeComando().entrar(ambientePara(null));
    registrar("Sessão do tribunal aberta e guardada no perfil do robô.");
    await fechar();
    return;
  }

  if (modo === "inspecionar") {
    const cnj = argumentos.find((item) => lerCnj(item));
    if (!cnj) throw new Error("Informe o número do processo: npm run inspecionar -- 0000000-00.0000.8.26.0000");
    try {
      await conectorDaLinhaDeComando(cnj).inspecionar?.(ambientePara(null), cnj);
    } finally {
      await fechar();
    }
    return;
  }

  registrar(`Robô "${config.nome}" atendendo ${CONECTORES.map((conector) => conector.chave).join(", ")} em ${config.orqestraiUrl}.`);
  // Com a fila de autos vazia, o robô completa a capa dos processos pelo DataJud, um por vez.
  let proximaCapa = 0;
  let capasFeitas = 0;
  async function completarUmaCapa(): Promise<number> {
    try {
      const capa = await fila.proximaCapa();
      if (capa.nada) return Date.now() + 60 * 60_000;
      if (capa.recusado) {
        registrar("DataJud recusou por excesso de consultas: o robô espera 10 min para a próxima capa.");
        return Date.now() + 10 * 60_000;
      }
      capasFeitas += 1;
      // Uma linha a cada 10 consultas (e na última), para o terminal não encher.
      if (capasFeitas % 10 === 1 || capa.restantes === 0) {
        registrar(`Capa pelo DataJud: ${capasFeitas} consultada${capasFeitas === 1 ? "" : "s"} nesta execução; faltam ${capa.restantes}. A última ${capa.achou ? `deixou ${capa.sugestoes} sugest${capa.sugestoes === 1 ? "ão" : "ões"}` : "não está no DataJud"}.`);
      }
      return Date.now() + config.pausaCapaMs;
    } catch (erro) {
      registrar(`Capa pelo DataJud falhou: ${mensagemLimpa(erro)}`);
      return Date.now() + 5 * 60_000;
    }
  }

  while (!encerrando) {
    let pedido: Pedido | null = null;
    try {
      pedido = await fila.proximo(CONECTORES.map((conector) => conector.chave));
    } catch (erro) {
      registrar(`Não consegui consultar a fila: ${mensagemLimpa(erro)}`);
    }
    if (!pedido) {
      if (modo === "uma-vez") break;
      if (config.capaDataJud && Date.now() >= proximaCapa) proximaCapa = await completarUmaCapa();
      await dormir(config.intervaloMs);
      continue;
    }

    const chave = `${pedido.sistema}:${pedido.tribunal}`;
    const conector = CONECTORES.find((item) => item.chave === chave);
    const cnj = lerCnj(pedido.cnj);
    const destino = join(config.pastas.downloads, `${pedido.id}.pdf`);
    registrar(`Pedido ${pedido.cnj} (${pedido.tribunal}), tentativa ${pedido.tentativas}.`);
    try {
      if (!conector || !cnj) throw new FalhaDoConector(`Este robô não atende ${pedido.sistema} do ${pedido.tribunal}.`);
      await conector.baixar(ambientePara(pedido), pedido, destino);
      registrar("PDF baixado. Enviando ao ORQESTRAI.");
      await fila.entregar(pedido.id, destino, nomeDoPdf(cnj));
      registrar(`Autos de ${pedido.cnj} entregues. A leitura pela IA segue no ORQESTRAI.`);
    } catch (erro) {
      if (erro instanceof PedidoEncerrado) {
        registrar(`Pedido ${pedido.cnj} saiu da fila (cancelado ou encerrado na ficha).`);
      } else if (erro instanceof SegredoDeJustica) {
        registrar(`${pedido.cnj}: segredo de justiça sem liberação. O pedido espera a decisão de uma pessoa na ficha.`);
        await fila.aguardarPessoa(pedido.id, "segredo_justica").catch(() => undefined);
      } else if (erro instanceof EsperaEsgotada) {
        registrar(`${erro.message} O pedido continua aguardando pessoa; o robô tenta de novo adiante.`);
        await dormir(config.intervaloMs);
      } else {
        const mensagem = mensagemLimpa(erro);
        registrar(`${pedido.cnj}: ${mensagem}`);
        await fila.erro(pedido.id, mensagem).catch((falha) => registrar(`Não consegui registrar o erro no ORQESTRAI: ${mensagemLimpa(falha)}`));
      }
    } finally {
      // O PDF não fica nesta máquina: ou subiu ao bucket privado, ou é descartado.
      await rm(destino, { force: true }).catch(() => undefined);
    }
    if (!encerrando) await dormir(config.pausaEntrePedidosMs);
  }
  await fechar();
}

principal().catch((erro) => {
  console.error(mensagemLimpa(erro));
  process.exit(1);
});
