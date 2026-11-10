import { rm } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as dormir } from "node:timers/promises";
import type { Page } from "playwright";
import { lerConfig } from "./config.ts";
import { esajTjsp } from "./conectores/esaj.ts";
import { lerCnj, nomeDoPdf } from "./conectores/esaj-urls.ts";
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
 *   npm run login         só abre a sessão do tribunal (para a pessoa concluir o login com calma)
 *   npm run inspecionar -- <CNJ>   abre o processo e descreve a tela, sem baixar
 */

/** Um conector por sistema de tribunal. Os próximos (PJe, eproc, Projudi) entram aqui. */
const CONECTORES: Conector[] = [esajTjsp];

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
  const { contexto, pagina } = await abrirNavegador(config);
  let encerrando = false;
  const encerrar = async () => {
    if (encerrando) return;
    encerrando = true;
    registrar("Encerrando o robô.");
    await contexto.close().catch(() => undefined);
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
    await CONECTORES[0].entrar(ambientePara(null));
    registrar("Sessão do tribunal aberta e guardada no perfil do robô.");
    await contexto.close();
    return;
  }

  if (modo === "inspecionar") {
    const cnj = argumentos.find((item) => lerCnj(item));
    if (!cnj) throw new Error("Informe o número do processo: npm run inspecionar -- 0000000-00.0000.8.26.0000");
    await CONECTORES[0].inspecionar?.(ambientePara(null), cnj);
    await contexto.close();
    return;
  }

  registrar(`Robô "${config.nome}" atendendo ${CONECTORES.map((conector) => conector.chave).join(", ")} em ${config.orqestraiUrl}.`);
  while (!encerrando) {
    let pedido: Pedido | null = null;
    try {
      pedido = await fila.proximo(CONECTORES.map((conector) => conector.chave));
    } catch (erro) {
      registrar(`Não consegui consultar a fila: ${mensagemLimpa(erro)}`);
    }
    if (!pedido) {
      if (modo === "uma-vez") break;
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
  await contexto.close().catch(() => undefined);
}

principal().catch((erro) => {
  console.error(mensagemLimpa(erro));
  process.exit(1);
});
