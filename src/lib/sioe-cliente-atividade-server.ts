/**
 * Mapeia clientes ativo/inativo no SIOE PRO via faturamento previsto e categoria.
 */

import { getSioeClient, isSioeSyncConfigured } from "@/lib/sioe-sync-server";
import {
  emptySioeClienteAtividadeIndex,
  grupoClienteKey,
  isSioeCategoriaInativa,
  isSioeCategoriaAtiva,
  planoContasNaCota,
  type SioeClienteAtividade,
  type SioeClienteAtividadeIndex,
} from "@/lib/sioe-cliente-atividade";

const PAGE_SIZE = 1000;

interface RawPessoaRow {
  id: string;
  grupo_cliente: string | null;
  categoria: string | null;
}

interface RawParcelaRow {
  pessoa_id: string | null;
  // Sem schema gerado do Supabase, a inferência de tipo para relações
  // aninhadas pode vir como objeto único ou array conforme o build —
  // aceitamos os dois formatos e normalizamos em pickParcelaLink().
  pessoas: RawPessoaRow | RawPessoaRow[] | null;
}

interface RawPrevistoRow {
  ci_item: number;
  plano_contas: string | null;
  data_vencimento: string | null;
  valor_item: number | string | null;
  tipo: string | null;
  financeiro_parcelas: RawParcelaRow | RawParcelaRow[] | null;
}

interface GrupoStats {
  displayName: string;
  hasAtivo: boolean;
  hasInativo: boolean;
}

function isReceberTipo(tipo: string | null): boolean {
  if (!tipo) return true;
  return tipo.trim().toUpperCase() === "RECEBER";
}

function monthBounds(reference = new Date()): { mesReferencia: string; start: string; end: string } {
  const ano = reference.getFullYear();
  const mes = reference.getMonth() + 1;
  const lastDay = new Date(ano, mes, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    mesReferencia: `${ano}-${pad(mes)}`,
    start: `${ano}-${pad(mes)}-01`,
    end: `${ano}-${pad(mes)}-${pad(lastDay)}`,
  };
}

function markGrupoAtivo(
  byGrupoKey: Map<string, SioeClienteAtividade>,
  grupoCliente: string | null,
  grupoNames: Map<string, string>
): void {
  const trimmed = grupoCliente?.trim();
  if (!trimmed) return;
  const key = grupoClienteKey(trimmed);
  if (!key) return;
  if (!grupoNames.has(key)) grupoNames.set(key, trimmed);
  byGrupoKey.set(key, "ativo");
}

function pickParcelaLink(link: RawPrevistoRow["financeiro_parcelas"]): {
  pessoaId: string | null;
  grupoCliente: string | null;
  inativa: boolean;
} {
  const rows = Array.isArray(link) ? link : link ? [link] : [];
  for (const row of rows) {
    const pessoa = Array.isArray(row.pessoas) ? (row.pessoas[0] ?? null) : row.pessoas;
    if (pessoa && isSioeCategoriaInativa(pessoa.categoria)) {
      return { pessoaId: row.pessoa_id, grupoCliente: pessoa.grupo_cliente, inativa: true };
    }
    return {
      pessoaId: row.pessoa_id,
      grupoCliente: pessoa?.grupo_cliente ?? null,
      inativa: false,
    };
  }
  return { pessoaId: null, grupoCliente: null, inativa: false };
}

/** Agrega categoria por grupo_cliente: ativo se houver qualquer pessoa ativa no grupo. */
async function fetchGrupoAtividadeFromPessoas(
  byGrupoKey: Map<string, SioeClienteAtividade>,
  byPessoaId: Map<string, SioeClienteAtividade>,
  grupoNames: Map<string, string>
): Promise<void> {
  const stats = new Map<string, GrupoStats>();
  const sioe = getSioeClient();
  let offset = 0;

  for (;;) {
    const { data, error } = await sioe
      .from("pessoas")
      .select("id, grupo_cliente, categoria")
      .not("grupo_cliente", "is", null)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("[sioe-cliente-atividade] pessoas:", error.message);
      break;
    }

    const batch = data ?? [];
    for (const row of batch) {
      const grupo = (row.grupo_cliente as string | null)?.trim();
      if (!grupo) continue;
      const key = grupoClienteKey(grupo);
      if (!key) continue;

      let group = stats.get(key);
      if (!group) {
        group = { displayName: grupo, hasAtivo: false, hasInativo: false };
        stats.set(key, group);
      }

      const pessoaId = row.id as string;
      const categoria = row.categoria as string | null;
      if (isSioeCategoriaAtiva(categoria)) {
        group.hasAtivo = true;
        byPessoaId.set(pessoaId, "ativo");
      } else if (isSioeCategoriaInativa(categoria)) {
        group.hasInativo = true;
        if (byPessoaId.get(pessoaId) !== "ativo") {
          byPessoaId.set(pessoaId, "inativo");
        }
      }
    }

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  for (const [key, group] of stats) {
    grupoNames.set(key, group.displayName);
    if (group.hasAtivo) {
      byGrupoKey.set(key, "ativo");
    } else if (group.hasInativo) {
      byGrupoKey.set(key, "inativo");
    }
  }
}

async function fetchAtivosPorPrevisto(
  reference: Date,
  byGrupoKey: Map<string, SioeClienteAtividade>,
  byPessoaId: Map<string, SioeClienteAtividade>,
  grupoNames: Map<string, string>
): Promise<void> {
  const { start, end } = monthBounds(reference);
  const sioe = getSioeClient();
  const seenItems = new Set<number>();
  let offset = 0;

  for (;;) {
    const { data, error } = await sioe
      .from("financeiro_parcelas_itens")
      .select(
        `
        ci_item,
        plano_contas,
        data_vencimento,
        valor_item,
        tipo,
        financeiro_parcelas!inner (
          pessoa_id,
          pessoas (
            id,
            grupo_cliente,
            categoria
          )
        )
      `
      )
      .gte("data_vencimento", start)
      .lte("data_vencimento", end)
      .not("plano_contas", "is", null)
      .not("valor_item", "is", null)
      .order("ci_item")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("[sioe-cliente-atividade] previsto:", error.message);
      break;
    }

    // Inferência do client Supabase trata relações aninhadas de forma
    // inconsistente (objeto vs array) — normalizamos depois em pickParcelaLink.
    const batch = (data ?? []) as unknown as RawPrevistoRow[];
    for (const row of batch) {
      if (seenItems.has(row.ci_item)) continue;
      if (!isReceberTipo(row.tipo)) continue;
      if (!planoContasNaCota(row.plano_contas)) continue;
      if (!row.data_vencimento || row.valor_item == null) continue;

      const link = pickParcelaLink(row.financeiro_parcelas);
      if (link.inativa) continue;

      seenItems.add(row.ci_item);
      markGrupoAtivo(byGrupoKey, link.grupoCliente, grupoNames);
      if (link.pessoaId) byPessoaId.set(link.pessoaId, "ativo");
    }

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
}

/** Índice ativo/inativo por grupo_cliente no SIOE PRO. */
export async function fetchSioeClienteAtividadeIndex(
  reference = new Date()
): Promise<SioeClienteAtividadeIndex> {
  const { mesReferencia } = monthBounds(reference);
  if (!isSioeSyncConfigured()) {
    return emptySioeClienteAtividadeIndex(mesReferencia);
  }

  const byGrupoKey = new Map<string, SioeClienteAtividade>();
  const byPessoaId = new Map<string, SioeClienteAtividade>();
  const grupoNames = new Map<string, string>();

  await fetchGrupoAtividadeFromPessoas(byGrupoKey, byPessoaId, grupoNames);
  await fetchAtivosPorPrevisto(reference, byGrupoKey, byPessoaId, grupoNames);

  return {
    byGrupoKey: Object.fromEntries(byGrupoKey),
    byPessoaId: Object.fromEntries(byPessoaId),
    grupoNames: Object.fromEntries(grupoNames),
    mesReferencia,
  };
}
