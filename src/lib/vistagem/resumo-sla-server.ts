import "server-only";

import { criarCalendario, feriadosNacionais } from "./dias-uteis";
import { carregarFeriados } from "./feriados";
import { diaEmSaoPaulo, montarResumoSla, type PublicacaoDoResumo } from "./resumo-sla";
import { admin, falhou } from "./server";

const COLUNAS = "escritorio_responsavel, demanda_risco, grupo_cliente, triada_em, triagem_resolvida_em, transferido_em, created_at";

/** A fila inteira do jurídico: o PostgREST devolve no máximo 1000 linhas por vez. */
async function filaDoJuridico(): Promise<PublicacaoDoResumo[]> {
  const fila: PublicacaoDoResumo[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await admin()
      .from("vistagem_publicacoes")
      .select(COLUNAS)
      .eq("status", "juridico_vistar")
      .order("linha_arquivo")
      .order("id")
      .range(inicio, inicio + 999);
    if (error) falhou("consultar a fila do jurídico", error);
    for (const linha of data ?? []) {
      // Mesma data do BKP: a última entrada na fila (triagem, pendência resolvida ou transferência de área).
      const entrada = [linha.triada_em, linha.triagem_resolvida_em, linha.transferido_em].filter(Boolean).sort().at(-1) ?? linha.created_at;
      fila.push({
        escritorio: linha.escritorio_responsavel,
        dia: diaEmSaoPaulo(new Date(entrada)),
        demandaRisco: linha.demanda_risco === true,
        grupo: linha.grupo_cliente,
      });
    }
    if ((data ?? []).length < 1000) return fila;
  }
}

/** Aviso do SLA da vistagem. `diaUtil` falso: feriado ou fim de semana, quem envia não posta no grupo. */
export async function resumoSlaDoJuridico(agora = new Date()): Promise<{ texto: string; html: string; diaUtil: boolean }> {
  const hoje = diaEmSaoPaulo(agora);
  const [feriados, fila] = await Promise.all([carregarFeriados().catch(() => feriadosNacionais(Number(hoje.slice(0, 4)))), filaDoJuridico()]);
  return { ...montarResumoSla(fila, agora, feriados), diaUtil: criarCalendario(feriados)(hoje) };
}
