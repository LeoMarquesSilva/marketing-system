import "server-only";

import { getSioeClient, isSioeSyncConfigured } from "@/lib/sioe-sync-server";
import { nomeCurto, siglaDoNome } from "./duplas";
import { carregarPessoas, db, falhou } from "./server";
import type { PessoaPauta } from "./tipos";

/**
 * A pasta de cada processo no VIOS: cliente, grupo, advogado responsável (SIOE, processos_completo) e a sigla do
 * auxiliar da dupla (ORQESTRAI, vistagem_pastas_vios, vinda do "Processos Lista").
 */

export interface PastaVios {
  cnj: string;
  ci: string | null;
  cliente: string | null;
  grupoCliente: string | null;
  advogadoResponsavel: string | null;
  auxiliarSigla: string | null;
}

function lotes<T>(itens: T[], tamanho: number): T[][] {
  const saida: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) saida.push(itens.slice(i, i + tamanho));
  return saida;
}

export async function pastasPorCnj(cnjs: string[]): Promise<Map<string, PastaVios>> {
  const unicos = [...new Set(cnjs)];
  const pastas = new Map<string, PastaVios>();
  if (!unicos.length || !isSioeSyncConfigured()) return pastas;
  for (const lote of lotes(unicos, 150)) {
    const { data, error } = await getSioeClient()
      .from("processos_completo")
      .select("ci, nro_cnj, cliente, grupo_cliente, advogado_responsavel, processo_encerrado")
      .in("nro_cnj", lote);
    if (error) {
      console.error("[pauta] pastas no SIOE:", error.message);
      continue;
    }
    for (const l of (data ?? []) as Record<string, unknown>[]) {
      const cnj = String(l.nro_cnj);
      const atual = pastas.get(cnj);
      if (atual && l.processo_encerrado) continue; // pasta ativa vence a encerrada
      pastas.set(cnj, {
        cnj,
        ci: l.ci ? String(l.ci) : null,
        cliente: (l.cliente as string | null) ?? null,
        grupoCliente: (l.grupo_cliente as string | null) ?? null,
        advogadoResponsavel: (l.advogado_responsavel as string | null) ?? null,
        auxiliarSigla: null,
      });
    }
  }
  const cis = [...pastas.values()].map((p) => p.ci).filter((ci): ci is string => Boolean(ci));
  for (const lote of lotes(cis, 200)) {
    const { data, error } = await db().from("vistagem_pastas_vios").select("ci, auxiliar_sigla").in("ci", lote);
    if (error) {
      console.error("[pauta] auxiliares das pastas:", error.message);
      continue;
    }
    const porCi = new Map(((data ?? []) as { ci: string; auxiliar_sigla: string | null }[]).map((l) => [String(l.ci), l.auxiliar_sigla]));
    for (const pasta of pastas.values()) if (pasta.ci && porCi.has(pasta.ci)) pasta.auxiliarSigla = porCi.get(pasta.ci) ?? null;
  }
  return pastas;
}

/**
 * Traz a equipe trabalhista do cadastro do VIOS (hr_vios_employees) para a pauta. Não mexe em quem já está
 * cadastrado (WhatsApp, "faz audiência" e coordenação são escolhas da controladoria).
 */
export async function semearEquipe(): Promise<{ novas: number; total: number }> {
  const { data, error } = await db()
    .from("hr_vios_employees")
    .select("full_name, email, department, position, is_active")
    .eq("is_active", true)
    .ilike("department", "%trabalh%");
  if (error) falhou("ler a equipe trabalhista no cadastro do VIOS", error);
  const existentes = await carregarPessoas();
  const chaves = new Set(existentes.map((p) => p.nomeVios.toLowerCase()));
  const novas = ((data ?? []) as { full_name: string; email: string | null; position: string | null }[])
    .filter((e) => e.full_name && !chaves.has(e.full_name.toLowerCase()))
    .map((e) => ({
      nome_vios: e.full_name.trim(),
      nome_curto: nomeCurto(e.full_name),
      sigla: siglaDoNome(e.full_name),
      email: e.email?.trim() || null,
      cargo: e.position ?? null,
      faz_audiencia: !/estagi/i.test(e.position ?? ""),
      coordenacao: /gerente|coordena/i.test(e.position ?? ""),
    }));
  if (novas.length) {
    const { error: erroInsert } = await db().from("aud_pessoas").insert(novas);
    if (erroInsert) falhou("cadastrar a equipe trabalhista na pauta", erroInsert);
  }
  return { novas: novas.length, total: existentes.length + novas.length };
}

export type { PessoaPauta };
