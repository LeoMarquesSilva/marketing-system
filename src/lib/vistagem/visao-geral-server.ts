import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { chaveNome } from "./agendamento";
import { pessoasPorNome } from "./pessoas-server";
import { admin, falhou, hojeEmSaoPaulo } from "./server";
import type { PublicacaoStatus } from "./types";
import {
  STATUS_ABERTOS,
  inicioDoPeriodo,
  montarVisaoGeral,
  type AbertaDaVisao,
  type ChegadaDaVisao,
  type PeriodoVisao,
  type VisaoGeral,
} from "./visao-geral";
import { nomeNoRh, nomesDosVistadores } from "./vistadores";
import { lerConfiguracoes } from "./configuracoes-server";

const PAGINA = 1000;
/** Teto de segurança: 30 dias de arquivos cheios ainda cabem com folga. */
const MAXIMO = 20000;

/** Lê todas as páginas de uma consulta (o Supabase devolve no máximo 1.000 linhas por vez). */
async function todasAsPaginas<T>(
  contexto: string,
  pagina: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; de < MAXIMO; de += PAGINA) {
    const { data, error } = await pagina(de, de + PAGINA - 1);
    if (error) falhou(contexto, error);
    linhas.push(...((data ?? []) as T[]));
    if ((data ?? []).length < PAGINA) break;
  }
  return linhas;
}

/** Início do dia em São Paulo (UTC−3, sem horário de verão) como instante ISO, para comparar com timestamps. */
const inicioDoDiaEmSaoPaulo = (data: string) => `${data}T03:00:00.000Z`;

async function arquivosDoPeriodo(db: SupabaseClient, desde: string) {
  const { data, error } = await db
    .from("vistagem_kurier_arquivos")
    .select("id, data_arquivo, total_linhas")
    .gte("data_arquivo", desde)
    .neq("status", "erro")
    .limit(500);
  if (error) falhou("carregar os arquivos do período", error);
  return ((data ?? []) as { id: string; data_arquivo: string; total_linhas: number | null }[]).map((arquivo) => ({
    id: arquivo.id,
    data: arquivo.data_arquivo,
    linhas: arquivo.total_linhas ?? 0,
  }));
}

export async function obterVisaoGeral(dias: PeriodoVisao): Promise<VisaoGeral> {
  const db = admin();
  const hoje = hojeEmSaoPaulo();
  const desde = inicioDoPeriodo(hoje, dias);
  const arquivos = await arquivosDoPeriodo(db, desde);
  const idsArquivos = arquivos.map((arquivo) => arquivo.id);

  type ChegadaRow = { kurier_arquivo_id: string | null; status: PublicacaoStatus; escritorio_responsavel: string | null; grupo_cliente: string | null };
  type AbertaRow = {
    status: PublicacaoStatus;
    escritorio_responsavel: string | null;
    demanda_risco: boolean | null;
    data_publicacao: string | null;
    duplicidade_de: string | null;
    duplicidade_resultado: string | null;
  };

  const [chegadas, abertas, checadas] = await Promise.all([
    idsArquivos.length
      ? todasAsPaginas<ChegadaRow>("carregar o que chegou no período", (de, ate) =>
          db
            .from("vistagem_publicacoes")
            .select("kurier_arquivo_id, status, escritorio_responsavel, grupo_cliente")
            .in("kurier_arquivo_id", idsArquivos)
            .order("id")
            .range(de, ate)
        )
      : Promise.resolve([] as ChegadaRow[]),
    todasAsPaginas<AbertaRow>("carregar as publicações em andamento", (de, ate) =>
      db
        .from("vistagem_publicacoes")
        .select("status, escritorio_responsavel, demanda_risco, data_publicacao, duplicidade_de, duplicidade_resultado")
        .in("status", STATUS_ABERTOS)
        .order("id")
        .range(de, ate)
    ),
    todasAsPaginas<{ escritorio_responsavel: string | null }>("carregar as checadas do período", (de, ate) =>
      db
        .from("vistagem_publicacoes")
        .select("escritorio_responsavel")
        .eq("status", "checado")
        .gte("checado_em", inicioDoDiaEmSaoPaulo(desde))
        .order("id")
        .range(de, ate)
    ),
  ]);

  const abertasDaVisao: AbertaDaVisao[] = abertas.map((row) => ({
    status: row.status,
    area: row.escritorio_responsavel,
    risco: row.demanda_risco === true,
    dataPublicacao: row.data_publicacao,
    // A aba Duplicidades lista as cópias ligadas a uma principal e ainda sem revisão.
    duplicidadePendente: Boolean(row.duplicidade_de) && !row.duplicidade_resultado,
  }));
  const chegadasDaVisao: ChegadaDaVisao[] = chegadas.map((row) => ({
    arquivoId: row.kurier_arquivo_id,
    status: row.status,
    area: row.escritorio_responsavel,
    grupo: row.grupo_cliente,
  }));

  // Foto de cada vistador cadastrado (vistadores.ts), procurada pelo nome completo do RH; sem foto, as iniciais.
  const { vistadores: mapaDeVistadores } = await lerConfiguracoes();
  const vistadores = nomesDosVistadores(mapaDeVistadores);
  const pessoas = await pessoasPorNome(vistadores.map(nomeNoRh)).catch((erro) => {
    console.error("[vistagem] fotos da visão geral:", erro instanceof Error ? erro.message : erro);
    return null;
  });
  const fotosDosVistadores: Record<string, string> = {};
  for (const nome of vistadores) {
    const foto = pessoas?.fotos[chaveNome(nomeNoRh(nome))];
    if (foto) fotosDosVistadores[chaveNome(nome)] = foto;
  }

  return montarVisaoGeral({
    hoje,
    dias,
    arquivos,
    chegadas: chegadasDaVisao,
    abertas: abertasDaVisao,
    checadas: checadas.map((row) => row.escritorio_responsavel),
    fotos: fotosDosVistadores,
    chaveNome,
    vistadores: mapaDeVistadores,
  });
}
