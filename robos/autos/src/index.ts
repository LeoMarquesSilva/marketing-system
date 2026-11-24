import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as dormir } from "node:timers/promises";
import type { Page } from "playwright";
import { FalhaDoCertificado, assinaturaDaFonte, diasParaVencer, lerCertificado, type CertificadoCliente } from "./certificado.ts";
import { lerConfig, type Config } from "./config.ts";
import { ConectorDcpTjrj, mapearDcp } from "./conectores/dcp-tjrj.ts";
import { conectoresEproc } from "./conectores/eproc.ts";
import { tribunalEprocDoCnj } from "./conectores/eproc-urls.ts";
import { conectoresEsaj } from "./conectores/esaj.ts";
import { lerCnj, nomeDoPdf, tribunalEsajDoCnj } from "./conectores/esaj-urls.ts";
import { navegadorDoRoboAberto } from "./conectores/mapeamento.ts";
import { lerPedidoDeMapa } from "./conectores/mapeamento-urls.ts";
import { ConectorPjeTjrj, mapearPje } from "./conectores/pje.ts";
import { ConectorJusbr } from "./conectores/jusbr.ts";
import { EsperaEsgotada, FalhaDoConector, SegredoDeJustica, type Ambiente, type Conector, type ResultadoDoDownload } from "./conectores/tipos.ts";
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
 *   npm run login -- eproc [TJRJ]  só abre a sessão do eproc (TJSP se não disser qual)
 *   npm run inspecionar -- <CNJ>   abre o processo e descreve a tela, sem baixar (com "eproc" antes do número, no eproc;
 *                                  o tribunal sai do número: 8.26 é o TJSP, 8.19 o TJRJ)
 *   npm run mapear -- <dcp|pje> <CNJ> [2g]   sistema que o robô ainda não atende (DCP e PJe do TJRJ): abre o login,
 *                                  espera a pessoa entrar e descreve cada tela da consulta em diagnostico/, sem baixar
 */

/**
 * Um conector por sistema e tribunal ("esaj:TJSP", "eproc:TJSP", "eproc:TJRJ", "dcp:TJRJ", "pje:TJRJ"…). Os
 * próximos entram aqui. O DCP e o PJe do TJRJ seguem pelo eproc do TJRJ quando o processo já migrou.
 */
const EPROC_TJRJ = conectoresEproc.find((conector) => conector.chave === "eproc:TJRJ");
/** O Jus.br (consulta unificada do CNJ) atende todos os tribunais: chave "jusbr:BR". */
const JUSBR = new ConectorJusbr();
const TODOS_OS_CONECTORES: Conector[] = [...conectoresEsaj, ...conectoresEproc, new ConectorDcpTjrj(EPROC_TJRJ), new ConectorPjeTjrj(EPROC_TJRJ), JUSBR];

/**
 * Os conectores que este robô atende (ROBO_CONECTORES): a chave inteira ("esaj:TJCE") ou só o sistema ("eproc").
 * Serve para dividir o trabalho entre dois robôs, ex.: o eproc no servidor e o e-SAJ no Mac (Web Signer).
 */
function conectoresDoRobo(config: Config): Conector[] {
  if (!config.conectores.length) return TODOS_OS_CONECTORES;
  const escolhidos = TODOS_OS_CONECTORES.filter((conector) => config.conectores.some((item) => conector.chave.toLowerCase() === item || conector.chave.toLowerCase().startsWith(`${item}:`)));
  if (!escolhidos.length) throw new Error(`ROBO_CONECTORES não corresponde a nenhum conector. Existem: ${TODOS_OS_CONECTORES.map((item) => item.chave).join(", ")}.`);
  return escolhidos;
}

let CONECTORES: Conector[] = TODOS_OS_CONECTORES;

/**
 * O conector pedido na linha de comando: sistema "eproc", "dcp" ou "pje" (TJRJ) ou e-SAJ (padrão), e o tribunal ("TJCE")
 * ou o do número do processo; TJSP se nada disser.
 */
function conectorDaLinhaDeComando(cnj?: string): Conector {
  // Protótipo do Jus.br: só pela linha de comando, fora da fila.
  if (argumentos.some((item) => item.toLowerCase() === "jusbr")) return JUSBR;
  const doTjrj = argumentos.map((item) => item.toLowerCase()).find((item) => item === "dcp" || item === "pje");
  if (doTjrj) {
    const conector = CONECTORES.find((item) => item.chave === `${doTjrj}:TJRJ`);
    if (!conector) throw new Error(`Este robô não atende o ${doTjrj} do TJRJ. Atende: ${CONECTORES.map((item) => item.chave).join(", ")}.`);
    return conector;
  }
  const sistema = argumentos.some((item) => item.toLowerCase() === "eproc") ? "eproc" : "esaj";
  const doNumero = cnj ? (sistema === "eproc" ? tribunalEprocDoCnj(cnj) : tribunalEsajDoCnj(cnj))?.sigla : undefined;
  const sigla = doNumero ?? argumentos.find((item) => /^TJ[A-Z]{2,3}$/.test(item)) ?? "TJSP";
  const conector = CONECTORES.find((item) => item.chave === `${sistema}:${sigla}`);
  if (!conector) throw new Error(`Este robô ainda não atende o ${sistema} do ${sigla}. Atende: ${CONECTORES.map((item) => item.chave).join(", ")}.`);
  return conector;
}

const argumentos = process.argv.slice(2);
const modo = argumentos.includes("--login")
  ? "login"
  : argumentos.includes("--provar")
    ? "provar"
    : argumentos.includes("--inspecionar")
    ? "inspecionar"
    : argumentos.includes("--mapear")
      ? "mapear"
      : argumentos.includes("--uma-vez")
        ? "uma-vez"
        : "continuo";

function registrar(mensagem: string): void {
  console.log(`[${new Date().toLocaleTimeString("pt-BR")}] ${mensagem}`);
}

// Uma espera esquecida num conector (ex.: waitForResponse que venceu depois de o pedido já ter falhado) não pode
// derrubar o robô no meio de outro pedido: vira aviso no log, só a primeira linha (sem o "Call log" do Playwright).
process.on("unhandledRejection", (erro) => {
  registrar(`Aviso: erro solto ignorado (${erro instanceof Error ? erro.message.split("\n")[0] : String(erro).split("\n")[0]}).`);
});

/** Só a primeira linha, sem o "Call log" do Playwright (que pode citar o que foi digitado na tela). */
function mensagemLimpa(erro: unknown): string {
  if (erro instanceof FalhaDoConector) return erro.message;
  const texto = erro instanceof Error ? erro.message : String(erro);
  return `Falha inesperada no robô: ${texto.split("\n")[0].slice(0, 300)}`;
}

/** Carrega o certificado em arquivo, se houver, e avisa do vencimento. Não registra nada do conteúdo. */
async function carregarCertificado(config: Config): Promise<CertificadoCliente | null> {
  const certificado = await lerCertificado(config.certificado);
  if (!certificado) return null;
  const dias = diasParaVencer(certificado.validoAte);
  registrar(`Certificado em arquivo carregado (${certificado.origem}), apresentado só a ${certificado.origens.join(", ")}.`);
  if (dias !== null && dias < 0) registrar(`ATENÇÃO: o certificado venceu em ${certificado.validoAte.slice(0, 10)}. Envie o novo pelo painel.`);
  else if (dias !== null && dias <= 30) registrar(`ATENÇÃO: o certificado vence em ${dias} dia${dias === 1 ? "" : "s"} (${certificado.validoAte.slice(0, 10)}).`);
  return certificado;
}

async function principal(): Promise<void> {
  const config = lerConfig();
  CONECTORES = conectoresDoRobo(config);
  // O mapear confere os argumentos antes de abrir o navegador, e não divide o Chrome com o robô ligado.
  const pedidoDeMapa = modo === "mapear" ? lerPedidoDeMapa(argumentos) : null;
  if (typeof pedidoDeMapa === "string") throw new Error(pedidoDeMapa);
  if (pedidoDeMapa && (await navegadorDoRoboAberto(config))) {
    throw new Error(
      "O Chrome do robô já está aberto (o robô está rodando em outro terminal). Pare o robô com Ctrl+C na aba dele antes de mapear e ligue de novo depois: os dois usariam a mesma janela."
    );
  }
  const fila = new Fila(config);
  // Sem certificado válido (o painel ainda não enviou, ou a senha não abre), o robô sobe assim mesmo: o login por
  // certificado fica com a pessoa e ele adota o certificado quando um válido chegar.
  let certificado = await carregarCertificado(config).catch((erro) => {
    if (!(erro instanceof FalhaDoCertificado)) throw erro;
    registrar(`Certificado em arquivo indisponível: ${erro.message} O robô segue sem ele.`);
    return null;
  });
  let assinaturaDoCertificado = certificado?.assinatura ?? (await assinaturaDaFonte(config.certificado));
  let navegador = await abrirNavegador(config, certificado);
  let encerrando = false;
  const encerrar = async () => {
    if (encerrando) return;
    encerrando = true;
    registrar("Encerrando o robô.");
    await navegador.fechar();
    process.exit(0);
  };

  /**
   * O painel trocou o certificado? Confere entre um pedido e outro (é só ler um arquivo pequeno). Com um
   * certificado novo e válido, o robô fecha o navegador e reabre com ele; com um inválido, segue com o anterior.
   */
  async function conferirTrocaDoCertificado(): Promise<void> {
    if (!config.certificado.pfx && !config.certificado.pasta) return;
    const assinatura = await assinaturaDaFonte(config.certificado).catch(() => assinaturaDoCertificado);
    if (assinatura === assinaturaDoCertificado) return;
    assinaturaDoCertificado = assinatura;
    try {
      const novo = await carregarCertificado(config);
      registrar("Certificado novo: reabrindo o navegador com ele.");
      await navegador.fechar();
      certificado = novo;
      navegador = await abrirNavegador(config, certificado);
    } catch (erro) {
      registrar(`O certificado novo não foi aceito (${erro instanceof FalhaDoCertificado ? erro.message : mensagemLimpa(erro)}). O robô segue com o anterior.`);
    }
  }
  process.on("SIGINT", () => void encerrar());
  process.on("SIGTERM", () => void encerrar());

  function ambientePara(pedido: Pedido | null): Ambiente {
    const { contexto, pagina } = navegador;
    return {
      config,
      contexto,
      pagina,
      registrar,
      diagnostico: (alvo: Page, etapa: string) => guardarDiagnostico(config, alvo, etapa),
      async aguardarPessoa(motivo, instrucao, resolvido) {
        registrar(`>>> PRECISA DE UMA PESSOA: ${instrucao}`);
        if (config.telaRemotaUrl) registrar(`Tela do robô: ${config.telaRemotaUrl}`);
        if (config.navegadorHeadless) registrar("O navegador está sem janela (NAVEGADOR_HEADLESS=sim): ninguém consegue resolver por aqui. O pedido fica aguardando pessoa.");
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
    await navegador.fechar();
    return;
  }

  if (modo === "provar") {
    // Baixa os autos de um processo para downloads/prova-<número>.pdf, sem a fila e sem entregar ao ORQESTRAI.
    // O navegador fica aberto (a sessão do tribunal continua valendo).
    const cnj = argumentos.find((item) => lerCnj(item));
    if (!cnj) throw new Error("Informe o número do processo: npm run provar -- jusbr 0000000-00.0000.8.26.0000");
    const conector = conectorDaLinhaDeComando(cnj);
    const destino = join(config.pastas.downloads, `prova-${cnj.replace(/\D/g, "")}.pdf`);
    const pedido: Pedido = { id: "prova", processoId: "prova", cnj, sistema: conector.chave.split(":")[0], tribunal: conector.chave.split(":")[1], status: "em_andamento", segredoLiberado: false, tentativas: 1, pecasBaixadas: [] };
    const inicio = Date.now();
    const resultado = await conector.baixar(ambientePara(null), pedido, destino);
    registrar(`Prova concluída em ${Math.round((Date.now() - inicio) / 1000)} s: ${resultado?.semNovidades ? "nada novo" : `${resultado?.pecas?.length ?? 0} peças em ${destino}`}.`);
    // Sai sem fechar o navegador: a conexão com o Chrome mantinha o processo vivo.
    process.exit(0);
  }

  if (modo === "inspecionar") {
    const cnj = argumentos.find((item) => lerCnj(item));
    if (!cnj) throw new Error("Informe o número do processo: npm run inspecionar -- 0000000-00.0000.8.26.0000 (ou -- eproc 0000000-00.0000.8.26.0000)");
    try {
      await conectorDaLinhaDeComando(cnj).inspecionar?.(ambientePara(null), cnj);
    } finally {
      await navegador.fechar();
    }
    return;
  }

  if (pedidoDeMapa) {
    try {
      const ambiente = ambientePara(null);
      if (pedidoDeMapa.sistema === "dcp") await mapearDcp(ambiente, pedidoDeMapa.cnj);
      else await mapearPje(ambiente, pedidoDeMapa.cnj, pedidoDeMapa.grau);
    } finally {
      await navegador.fechar();
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
    await conferirTrocaDoCertificado();
    let pedido: Pedido | null = null;
    try {
      pedido = await fila.proximo(CONECTORES.map((conector) => conector.chave));
    } catch (erro) {
      registrar(`Não consegui consultar a fila: ${mensagemLimpa(erro)}`);
    }
    // Decisão do escritório (24/11/2026): processo em segredo de justiça que o robô abre com o login do advogado é
    // processo do advogado; baixa sem esperar a liberação na ficha. SEGREDO_JUSTICA=esperar volta à regra antiga.
    if (pedido && config.segredoSempreLiberado && !pedido.segredoLiberado) pedido = { ...pedido, segredoLiberado: true };
    if (!pedido) {
      if (modo === "uma-vez") break;
      if (config.capaDataJud && Date.now() >= proximaCapa) proximaCapa = await completarUmaCapa();
      await dormir(config.intervaloMs);
      continue;
    }

    const chave = pedido.sistema === "jusbr" ? JUSBR.chave : `${pedido.sistema}:${pedido.tribunal}`;
    const conector = CONECTORES.find((item) => item.chave === chave);
    const cnj = lerCnj(pedido.cnj);
    const destino = join(config.pastas.downloads, `${pedido.id}.pdf`);
    registrar(`Pedido ${pedido.cnj} (${pedido.tribunal}), tentativa ${pedido.tentativas}.`);
    try {
      if (!conector || !cnj) throw new FalhaDoConector(`Este robô não atende ${pedido.sistema} do ${pedido.tribunal}.`);
      let resultado: ResultadoDoDownload | void;
      try {
        resultado = await conector.baixar(ambientePara(pedido), pedido, destino);
      } catch (erro) {
        // O Jus.br não trouxe os autos (tribunal ainda não integrado, documentos incompletos, instabilidade):
        // segue pelo robô do tribunal no mesmo pedido, se este robô o tiver.
        const reserva = pedido.sistema === "jusbr" && erro instanceof FalhaDoConector && pedido.reserva ? CONECTORES.find((item) => item.chave === pedido.reserva) : undefined;
        if (!reserva || !pedido.reserva || !(erro instanceof FalhaDoConector)) throw erro;
        registrar(`${erro.message} Seguindo pelo ${pedido.reserva}.`);
        const doTribunal = await reserva.baixar(ambientePara(pedido), { ...pedido, sistema: pedido.reserva.split(":")[0] }, destino);
        resultado = { ...(doTribunal ?? {}), sistema: doTribunal?.sistema ?? pedido.reserva.split(":")[0] };
      }
      if (resultado?.semNovidades) {
        await fila.semNovidades(pedido.id, resultado.sistema, resultado.capa);
        registrar(`Autos de ${pedido.cnj} conferidos: nenhuma peça nova desde o último download.`);
      } else {
        registrar(resultado?.arquivos && resultado.arquivos.length > 1 ? `PDF baixado em ${resultado.arquivos.length} partes. Enviando ao ORQESTRAI.` : "PDF baixado. Enviando ao ORQESTRAI.");
        await fila.entregar(pedido.id, destino, nomeDoPdf(cnj), resultado?.pecas, resultado?.sistema, resultado?.arquivos, resultado?.capa);
        registrar(`Autos de ${pedido.cnj} entregues${resultado?.pecas?.length ? ` (${resultado.pecas.length} peças)` : ""}. A leitura pela IA segue no ORQESTRAI.`);
      }
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
      // Partes de um PDF grande ("<pedido>-parteN.pdf") também saem.
      for (const nome of await readdir(config.pastas.downloads).catch(() => [] as string[])) {
        if (nome.startsWith(`${pedido.id}-parte`)) await rm(join(config.pastas.downloads, nome), { force: true }).catch(() => undefined);
      }
    }
    if (!encerrando) await dormir(config.pausaEntrePedidosMs);
  }
  await navegador.fechar();
}

principal().catch((erro) => {
  console.error(mensagemLimpa(erro));
  process.exit(1);
});
