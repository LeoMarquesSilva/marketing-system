import "server-only";

import { parse } from "csv-parse/sync";
import { VistagemError } from "./errors";
import { admin, falhou } from "./server";
import { baixarArquivoPorCaminho } from "./sharepoint";

/** Relatório "Processos Lista" do VIOS (atualizado todo dia ~8h na pasta da Controladoria). */
const SITE_CONTROLADORIA = "bpplaw2.sharepoint.com:/sites/Controladoria";
const PROCESSOS_LISTA = "Núcleo de Cadastro/Bases Atualizacoes/Processos Lista.csv";

function limparCi(valor: unknown): string {
  return String(valor ?? "").replace(/[="\s]/g, "");
}

/** Importa CI → vínculo, sigla do auxiliar e advogado do "Processos Lista". */
export async function sincronizarPastasVios(): Promise<{ pastas: number }> {
  const conteudo = await baixarArquivoPorCaminho(SITE_CONTROLADORIA, PROCESSOS_LISTA);
  const texto = new TextDecoder("windows-1252").decode(conteudo);
  const linhas = parse(texto, { delimiter: ";", columns: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!linhas.length || !("CI" in linhas[0])) throw new VistagemError("Processos Lista sem a coluna CI.", 502);
  const agora = new Date().toISOString();
  const registros = new Map<string, { ci: string; vinculo: string | null; auxiliar_sigla: string | null; advogado: string | null; atualizado_em: string }>();
  for (const linha of linhas) {
    const ci = limparCi(linha.CI);
    if (!ci) continue;
    registros.set(ci, {
      ci,
      vinculo: linha["Vínculo"]?.trim() || null,
      auxiliar_sigla: linha["Aux."]?.trim() || null,
      advogado: linha["Advogado responsável"]?.trim() || null,
      atualizado_em: agora,
    });
  }
  const db = admin();
  const lista = [...registros.values()];
  for (let i = 0; i < lista.length; i += 1000) {
    const { error } = await db.from("vistagem_pastas_vios").upsert(lista.slice(i, i + 1000), { onConflict: "ci" });
    if (error) falhou("gravar as pastas do VIOS", error);
  }
  return { pastas: lista.length };
}

export async function buscarPastasVios(cis: string[]): Promise<Map<string, { vinculo: string | null; auxiliarSigla: string | null }>> {
  const unicos = [...new Set(cis.filter(Boolean))];
  const mapa = new Map<string, { vinculo: string | null; auxiliarSigla: string | null }>();
  for (let i = 0; i < unicos.length; i += 200) {
    const { data, error } = await admin().from("vistagem_pastas_vios").select("ci, vinculo, auxiliar_sigla").in("ci", unicos.slice(i, i + 200));
    if (error) falhou("consultar as pastas do VIOS", error);
    for (const row of data ?? []) mapa.set(row.ci as string, { vinculo: row.vinculo as string | null, auxiliarSigla: row.auxiliar_sigla as string | null });
  }
  return mapa;
}
