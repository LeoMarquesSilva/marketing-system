import "server-only";

import { createHash } from "node:crypto";
import type { AgendamentoValidado } from "./agendamento";
import { admin } from "./server";
import { compararComSugestao, entradaDoRegistro, type ResultadoSugestao, type SugestaoIa } from "./sugestao-ia";

/**
 * Registro da IA da vistagem (vistagem_ia_registros, pedido de 16/11/2026): o que a IA leu, o que sugeriu e o que o
 * advogado escolheu, para a IA aprender com as decisões do jurídico. Nada aqui derruba a sugestão nem a vistagem: se a
 * gravação falhar, fica só o log.
 */

type PublicacaoDoRegistro = Parameters<typeof entradaDoRegistro>[0] & {
  id: string;
  numero_processo: string | null;
  escritorio_responsavel: string | null;
};

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : typeof erro === "object" && erro && "message" in erro ? String(erro.message) : String(erro);
}

/** Na geração: as instruções (uma vez por versão), o que a IA leu e o que ela sugeriu. */
export async function registrarSugestaoDaIa(publicacao: PublicacaoDoRegistro, area: string, instrucoes: string, sugestao: SugestaoIa): Promise<void> {
  try {
    const db = admin();
    const hash = createHash("sha256").update(instrucoes).digest("hex");
    const { error: erroInstrucoes } = await db
      .from("vistagem_ia_instrucoes")
      .upsert({ hash, area, texto: instrucoes }, { onConflict: "hash", ignoreDuplicates: true });
    if (erroInstrucoes) throw erroInstrucoes;
    const { error } = await db.from("vistagem_ia_registros").upsert(
      {
        publicacao_id: publicacao.id,
        numero_processo: publicacao.numero_processo,
        area,
        escritorio: publicacao.escritorio_responsavel,
        modelo: sugestao.modelo,
        instrucoes_hash: hash,
        entrada: entradaDoRegistro(publicacao),
        sugestao,
        custo_us: sugestao.custoUS,
        gerada_em: sugestao.geradaEm,
      },
      { onConflict: "publicacao_id" }
    );
    if (error) throw error;
  } catch (erro) {
    console.error("[vistagem] registro da IA (sugestão)", publicacao.id, mensagem(erro));
  }
}

/**
 * Na vistagem: o que o advogado agendou, a comparação com a sugestão e o resultado. Grava a linha inteira (upsert): a
 * sugestão gerada antes do registro existir também entra. Uma nova vistagem atualiza a mesma linha.
 */
export async function registrarDecisaoDaIa(entrada: {
  publicacao: PublicacaoDoRegistro;
  area: string | null;
  sugestao: SugestaoIa;
  resultado: ResultadoSugestao;
  itens: AgendamentoValidado[];
  autor: string;
}): Promise<void> {
  try {
    const { publicacao, sugestao, itens } = entrada;
    const { error } = await admin()
      .from("vistagem_ia_registros")
      .upsert(
        {
          publicacao_id: publicacao.id,
          numero_processo: publicacao.numero_processo,
          ...(entrada.area ? { area: entrada.area } : {}),
          escritorio: publicacao.escritorio_responsavel,
          modelo: sugestao.modelo,
          entrada: entradaDoRegistro(publicacao),
          sugestao,
          custo_us: sugestao.custoUS,
          gerada_em: sugestao.geradaEm,
          resultado: entrada.resultado,
          tarefas_escolhidas: itens.map((item) => ({
            classe: item.etiqueta,
            tarefaId: item.tarefaId,
            tarefa: item.tarefa,
            dias: item.diasPrazo,
            contagem: item.contagemPrazo,
            dataFatal: item.dataFatal,
            data: item.data,
            hora: item.hora,
          })),
          comparacao: compararComSugestao(sugestao, itens),
          decidido_por: entrada.autor,
          decidido_em: new Date().toISOString(),
        },
        { onConflict: "publicacao_id" }
      );
    if (error) throw error;
  } catch (erro) {
    console.error("[vistagem] registro da IA (decisão)", entrada.publicacao.id, mensagem(erro));
  }
}
