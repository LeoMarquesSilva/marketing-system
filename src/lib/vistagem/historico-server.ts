import "server-only";

import type { HistoricoPublicacao } from "./historico";
import { pessoasPorNome } from "./pessoas-server";
import { admin } from "./server";

type ContextoRow = { grupo_cliente: string | null; cliente: string | null; escritorio_responsavel: string | null; demanda_risco: boolean | null };

/**
 * Completa o histórico para o modal: a foto de quem aparece (quem fez cada passo e o responsável de cada tarefa) e
 * de quem é a publicação (grupo, cliente, área, risco). É enfeite: se falhar, o histórico vai sem isso.
 */
export async function comFotosEContexto(id: string, historico: HistoricoPublicacao): Promise<HistoricoPublicacao> {
  const nomes = historico.eventos.flatMap((evento) => [evento.por, ...(evento.tarefas ?? []).map((tarefa) => tarefa.responsavel)]);
  const [pessoas, publicacao] = await Promise.all([
    pessoasPorNome(nomes).catch(() => null),
    admin()
      .from("vistagem_publicacoes")
      .select("grupo_cliente, cliente, escritorio_responsavel, demanda_risco")
      .eq("id", id)
      .maybeSingle()
      .then(
        (resposta) => (resposta.error ? null : (resposta.data as ContextoRow | null)),
        () => null
      ),
  ]);
  return {
    ...historico,
    fotos: pessoas?.fotos ?? {},
    contexto: publicacao
      ? { grupo: publicacao.grupo_cliente, cliente: publicacao.cliente, area: publicacao.escritorio_responsavel, risco: Boolean(publicacao.demanda_risco) }
      : null,
  };
}
