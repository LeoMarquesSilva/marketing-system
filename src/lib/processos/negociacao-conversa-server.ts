import "server-only";

import {
  enviadosDaCaixa,
  mensagensDaConversa,
  microsoftMailConfigurado,
  MicrosoftMailError,
  resolverCaixa,
  responderMensagem,
  tokenGraphReaproveitado,
  type MensagemDaCaixa,
} from "@/lib/microsoft-mail";
import { ProcessosError } from "./errors";
import { assuntoDeResposta, conferirDestinatarios, textoParaHtml } from "./negociacao";
import { exigirTrabalhistas, faltaMigration, gravarNegociacao, negociacaoDoProcesso, registrarEventos } from "./negociacao-server";
import { registrarNoHistorico } from "./processos-server";
import { textoOpcional } from "./rec-credito";
import { db, falhou, type Ator } from "./server";

/**
 * A conversa do e-mail de acordo no Outlook: o e-mail sai pelo sendMail (que não devolve id), então a conferência
 * acha a mensagem nos Itens Enviados da caixa pelo assunto e pela hora, guarda a conversa e, a cada conferência,
 * traz para o histórico de cada processo do e-mail o que entrou nela (respostas do advogado e o que a equipe mandou
 * direto pelo Outlook). Precisa da permissão de aplicativo Mail.Read no app do Microsoft 365.
 */

type Linha = Record<string, unknown>;

const texto = (valor: unknown) => (typeof valor === "string" && valor ? valor : null);
const normalizarAssunto = (assunto: string) => assunto.replace(/\s+/g, " ").trim().toLowerCase();

/** E-mails da conversa olhados até 6 meses depois do envio. */
const JANELA_DIAS = 180;
/** O e-mail aparece nos Itens Enviados alguns segundos depois do sendMail; a busca olha um intervalo folgado. */
const ANTES_MS = 2 * 60_000;
const DEPOIS_MS = 30 * 60_000;
/** Resposta mandada pela tela: a mensagem que aparece na conversa até este tempo depois é ela. */
const CASAR_RESPOSTA_MS = 20 * 60_000;

export interface ResultadoDaConferencia {
  conversas: number;
  /** Mensagens novas trazidas para o histórico (contadas uma vez, mesmo que o e-mail seja de vários processos). */
  novas: number;
  /** Processos que passaram a "respondido" nesta conferência. */
  respondidos: number;
  aviso: string | null;
}

interface EventoDeEnvio {
  id: string;
  negociacaoId: string;
  processoId: string;
  envioId: string;
  caixa: string;
  assunto: string;
  conversaId: string | null;
  mensagemId: string | null;
  quando: string;
}

function paraEventoDeEnvio(linha: Linha): EventoDeEnvio {
  return {
    id: linha.id as string,
    negociacaoId: linha.negociacao_id as string,
    processoId: linha.processo_id as string,
    envioId: linha.envio_id as string,
    caixa: (linha.caixa as string).toLowerCase(),
    assunto: (linha.assunto as string | null) ?? "",
    conversaId: texto(linha.conversa_id),
    mensagemId: texto(linha.mensagem_id),
    quando: (texto(linha.mensagem_em) ?? linha.criado_em) as string,
  };
}

function motivoDoMicrosoft(erro: unknown, caixa: string): string {
  if (erro instanceof MicrosoftMailError) {
    if (erro.status === 403 || erro.code === "ErrorAccessDenied") {
      return `O app do Microsoft 365 não tem permissão de ler a caixa ${caixa}: falta a permissão de aplicativo Mail.Read (com o consentimento do administrador).`;
    }
    if (erro.status === 404) return `A caixa ${caixa} não foi encontrada no Microsoft 365.`;
    return erro.message;
  }
  return erro instanceof Error ? erro.message : "Falha ao ler a caixa no Microsoft 365.";
}

/** Acha, nos Itens Enviados, o e-mail de cada envio que ainda não tem a conversa, e guarda conversa e mensagem. */
async function localizarConversas(envios: EventoDeEnvio[], avisos: Set<string>): Promise<void> {
  const semConversa = new Map<string, EventoDeEnvio>();
  for (const evento of envios) if (!evento.conversaId && !semConversa.has(evento.envioId)) semConversa.set(evento.envioId, evento);
  for (const envio of semConversa.values()) {
    const quando = new Date(envio.quando).getTime();
    let enviados: MensagemDaCaixa[];
    try {
      enviados = await enviadosDaCaixa(envio.caixa, new Date(quando - ANTES_MS), new Date(quando + DEPOIS_MS));
    } catch (erro) {
      avisos.add(motivoDoMicrosoft(erro, envio.caixa));
      continue;
    }
    const assunto = normalizarAssunto(envio.assunto);
    const achado = enviados
      .filter((item) => normalizarAssunto(item.assunto) === assunto)
      .sort((a, b) => Math.abs(new Date(a.em).getTime() - quando) - Math.abs(new Date(b.em).getTime() - quando))[0];
    if (!achado) continue;
    const { error } = await db()
      .from("proc_negociacao_eventos")
      .update({ conversa_id: achado.conversaId, mensagem_id: achado.id, mensagem_em: achado.em })
      .eq("envio_id", envio.envioId);
    if (error) falhou("guardar a conversa do e-mail", error);
    for (const evento of envios) {
      if (evento.envioId !== envio.envioId) continue;
      evento.conversaId = achado.conversaId;
      evento.mensagemId = achado.id;
    }
  }
}

/**
 * Traz para o histórico o que entrou nas conversas dos e-mails de acordo. Sem `processoIds`, de todos os processos
 * trabalhistas; com eles, só desses (a tela de um processo).
 */
export async function conferirRespostas(ator: Ator, processoIds: string[] | null = null): Promise<ResultadoDaConferencia> {
  const resultado: ResultadoDaConferencia = { conversas: 0, novas: 0, respondidos: 0, aviso: null };
  if (!microsoftMailConfigurado()) return { ...resultado, aviso: "O Microsoft 365 não está configurado neste ambiente: não dá para acompanhar as respostas." };

  const desde = new Date(Date.now() - JANELA_DIAS * 86_400_000).toISOString();
  let consulta = db()
    .from("proc_negociacao_eventos")
    .select("id, negociacao_id, processo_id, envio_id, caixa, assunto, conversa_id, mensagem_id, mensagem_em, criado_em")
    .eq("tipo", "email_enviado")
    .not("envio_id", "is", null)
    .not("caixa", "is", null)
    .gte("criado_em", desde)
    .order("criado_em", { ascending: true })
    .limit(2000);
  if (processoIds?.length) consulta = consulta.in("processo_id", processoIds);
  const { data, error } = await consulta;
  if (error) {
    if (faltaMigration(error)) return { ...resultado, aviso: "Falta aplicar a migration das conversas dos acordos (20261127210000) para acompanhar as respostas." };
    falhou("carregar os e-mails enviados", error);
  }
  const envios = ((data ?? []) as Linha[]).map(paraEventoDeEnvio);
  if (!envios.length) return resultado;

  const avisos = new Set<string>();
  await localizarConversas(envios, avisos);

  // Cada conversa: a caixa, os processos dela e a negociação de cada um.
  const conversas = new Map<string, { caixa: string; processos: Map<string, string> }>();
  for (const evento of envios) {
    if (!evento.conversaId) continue;
    const conversa = conversas.get(evento.conversaId) ?? { caixa: evento.caixa, processos: new Map<string, string>() };
    conversa.processos.set(evento.processoId, evento.negociacaoId);
    conversas.set(evento.conversaId, conversa);
  }
  resultado.conversas = conversas.size;
  if (!conversas.size) {
    resultado.aviso = [...avisos][0] ?? null;
    return resultado;
  }

  // O que cada processo já tem de cada conversa (mensagens trazidas e respostas mandadas pela tela, ainda sem id).
  const { data: existentes, error: erroExistentes } = await db()
    .from("proc_negociacao_eventos")
    .select("id, processo_id, conversa_id, mensagem_id, tipo, criado_em")
    .in("conversa_id", [...conversas.keys()])
    .limit(5000);
  if (erroExistentes) falhou("carregar a conversa", erroExistentes);
  const jaTem = new Set(((existentes ?? []) as Linha[]).filter((linha) => linha.mensagem_id).map((linha) => `${linha.processo_id}|${linha.mensagem_id}`));
  const pendentesDaTela = ((existentes ?? []) as Linha[]).filter((linha) => linha.tipo === "email_enviado" && !linha.mensagem_id);

  const token = await tokenGraphReaproveitado().catch(() => null);
  for (const [conversaId, conversa] of conversas) {
    let mensagens: MensagemDaCaixa[];
    let propria = conversa.caixa;
    try {
      if (token) propria = (await resolverCaixa(conversa.caixa, token)).toLowerCase();
      mensagens = await mensagensDaConversa(conversa.caixa, conversaId);
    } catch (erro) {
      avisos.add(motivoDoMicrosoft(erro, conversa.caixa));
      continue;
    }
    for (const mensagem of mensagens) {
      const nossa = mensagem.de === propria || mensagem.de === conversa.caixa;
      let contada = false;
      for (const [processoId, negociacaoId] of conversa.processos) {
        if (jaTem.has(`${processoId}|${mensagem.id}`)) continue;
        jaTem.add(`${processoId}|${mensagem.id}`);

        if (nossa) {
          // Resposta mandada pela tela: a linha já está no histórico, só ganha o id da mensagem.
          const daTela = pendentesDaTela.find(
            (linha) => linha.processo_id === processoId && linha.conversa_id === conversaId && Math.abs(new Date(linha.criado_em as string).getTime() - new Date(mensagem.em).getTime()) <= CASAR_RESPOSTA_MS
          );
          if (daTela) {
            pendentesDaTela.splice(pendentesDaTela.indexOf(daTela), 1);
            const { error: erroCasar } = await db().from("proc_negociacao_eventos").update({ mensagem_id: mensagem.id, mensagem_em: mensagem.em }).eq("id", daTela.id as string);
            if (erroCasar) falhou("guardar a mensagem da conversa", erroCasar);
            continue;
          }
        }

        await registrarEventos(
          [
            {
              negociacao_id: negociacaoId,
              processo_id: processoId,
              tipo: nossa ? "email_enviado" : "email_recebido",
              descricao: nossa ? `E-mail enviado pelo Outlook de ${mensagem.de ?? conversa.caixa} para ${mensagem.para.join(", ")}` : `Resposta de ${mensagem.de ?? "remetente desconhecido"}`,
              para: mensagem.para,
              cc: mensagem.cc,
              remetente: mensagem.de,
              assunto: mensagem.assunto,
              corpo: mensagem.texto.slice(0, 20000),
              caixa: conversa.caixa,
              conversa_id: conversaId,
              mensagem_id: mensagem.id,
              mensagem_em: mensagem.em,
            },
          ],
          null
        ).catch((erro: unknown) => {
          // Duas conferências ao mesmo tempo: a outra já gravou esta mensagem.
          if (!(erro instanceof ProcessosError) || !/23505|duplicate/i.test(String(erro.detalhe ?? erro.message))) throw erro;
        });
        if (!contada) {
          resultado.novas += 1;
          contada = true;
        }

        if (!nossa) {
          const atual = await negociacaoDoProcesso(processoId);
          if (atual.status === "a_enviar" || atual.status === "enviado") {
            await gravarNegociacao(processoId, { status: "respondido", respondido_em: atual.respondidoEm ?? mensagem.em }, ator);
            await registrarNoHistorico(processoId, "negociacao", null, `Negociação de acordo: resposta por e-mail de ${mensagem.de ?? "advogado"}`, ator);
            resultado.respondidos += 1;
          }
        }
      }
    }
  }
  resultado.aviso = [...avisos][0] ?? null;
  return resultado;
}

/**
 * POST { acao: "responder", confirmado: true, processoId, mensagemId, para, cc, texto } — responde, pela caixa da
 * conversa, uma mensagem dela. Fica no histórico de todos os processos da conversa.
 */
export async function responderNaConversa(entrada: Record<string, unknown>, ator: Ator): Promise<{ respondidos: number; remetente: string }> {
  if (entrada.confirmado !== true) throw new ProcessosError("Confirme a resposta na tela antes de enviar.", 400);
  const processoId = typeof entrada.processoId === "string" ? entrada.processoId : "";
  const mensagemId = typeof entrada.mensagemId === "string" ? entrada.mensagemId : "";
  if (!mensagemId) throw new ProcessosError("Escolha o e-mail da conversa a responder.", 400);
  await exigirTrabalhistas([processoId]);
  const corpo = textoOpcional(entrada.texto, 20000);
  if (!corpo) throw new ProcessosError("Escreva o texto da resposta.", 400);
  const para = conferirDestinatarios(entrada.para, { rotulo: "Para" });
  const cc = conferirDestinatarios(entrada.cc ?? [], { opcional: true, rotulo: "Cc" }).filter((item) => !para.includes(item));

  const { data: original, error } = await db()
    .from("proc_negociacao_eventos")
    .select("caixa, conversa_id, assunto")
    .eq("processo_id", processoId)
    .eq("mensagem_id", mensagemId)
    .not("conversa_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) {
    if (faltaMigration(error)) throw new ProcessosError("Falta aplicar a migration das conversas dos acordos (20261127210000).", 409);
    falhou("carregar o e-mail da conversa", error);
  }
  if (!original?.caixa || !original.conversa_id) throw new ProcessosError("Esse e-mail não está numa conversa acompanhada.", 404);
  const caixa = original.caixa as string;
  const conversaId = original.conversa_id as string;

  try {
    await responderMensagem({ caixa, mensagemId, para, cc, html: textoParaHtml(corpo) });
  } catch (erro) {
    if (erro instanceof MicrosoftMailError) {
      console.error("[processos] resposta na conversa do acordo:", erro.message);
      throw new ProcessosError(`Não foi possível responder: ${motivoDoMicrosoft(erro, caixa)}`, 502);
    }
    throw erro;
  }

  // A resposta vale para todos os processos da conversa (o e-mail era de vários processos do advogado).
  const { data: daConversa, error: erroConversa } = await db().from("proc_negociacao_eventos").select("processo_id, negociacao_id").eq("conversa_id", conversaId).limit(2000);
  if (erroConversa) falhou("carregar os processos da conversa", erroConversa);
  const processos = new Map(((daConversa ?? []) as Linha[]).map((linha) => [linha.processo_id as string, linha.negociacao_id as string]));
  const agora = new Date().toISOString();
  const envioId = crypto.randomUUID();
  await registrarEventos(
    [...processos].map(([idDoProcesso, negociacaoId]) => ({
      negociacao_id: negociacaoId,
      processo_id: idDoProcesso,
      tipo: "email_enviado",
      descricao: `Resposta enviada pelo Outlook de ${caixa} para ${para.join(", ")}`,
      para,
      cc,
      remetente: caixa,
      assunto: assuntoDeResposta(original.assunto as string | null),
      corpo,
      envio_id: envioId,
      caixa,
      conversa_id: conversaId,
      mensagem_em: agora,
    })),
    ator
  );
  for (const idDoProcesso of processos.keys()) {
    await registrarNoHistorico(idDoProcesso, "negociacao", null, `Resposta na conversa do acordo enviada (${para.join(", ")})`, ator);
  }
  return { respondidos: processos.size, remetente: caixa };
}
