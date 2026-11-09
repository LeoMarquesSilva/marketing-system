/**
 * Preenche o BKP do SIOE (sp_publicacoes) com as publicações que já fecharam a esteira no Orquestra e mostra o que falta.
 *
 *   npx tsx --env-file=.env scripts/bkp-sioe-preencher.mts [--desde=2026-11-03] [--aplicar]
 *
 * Sem --aplicar só mostra. --aplicar grava (upsert por orquestra_id; rodar de novo não duplica) e exige a migration do SIOE.
 * Dos lotes do piloto (antes de INICIO_DO_BKP) só entram as Trabalhistas checadas: as duplicidades e as outras áreas
 * desses dias seguem vindo da lista do SharePoint.
 */
import { createClient } from "@supabase/supabase-js";
import { PASTA_POSSIVEL_ABERTURA, entraNoBkp } from "@/lib/vistagem/bkp-sioe";
import { feriadosDoSioe, gravarNoBkp, montarLinhasDoBkp, publicacoesFechadasDesde, quantasFaltamNoBkp } from "@/lib/vistagem/bkp-sioe-lote";

const APLICAR = process.argv.includes("--aplicar");
const DESDE = process.argv.find((arg) => arg.startsWith("--desde="))?.slice(8) ?? "2026-11-03";
if (!/^\d{4}-\d{2}-\d{2}$/.test(DESDE)) throw new Error("--desde=AAAA-MM-DD");

const orquestra = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
const sioe = createClient(process.env.SIOE_SUPABASE_URL ?? "", process.env.SIOE_SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });

const contar = (valores: (string | null)[]) =>
  Object.entries(valores.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v ?? "∅"]: (acc[v ?? "∅"] ?? 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([v, n]) => `${v}=${n}`)
    .join(" | ");

const migrado = !(await sioe.from("sp_publicacoes").select("orquestra_id").limit(1)).error;
const publicacoes = (await publicacoesFechadasDesde(orquestra, DESDE)).filter(entraNoBkp);
const linhas = await montarLinhasDoBkp(orquestra, publicacoes, await feriadosDoSioe(sioe));

console.log(`Publicações do Orquestra para o BKP, importadas desde ${DESDE}: ${linhas.length}`);
console.log("  tipo:", contar(linhas.map((l) => l.tipo_agendamento)));
console.log("  área:", contar(linhas.map((l) => l.area)));
console.log("  sem pasta:", linhas.filter((l) => l.pasta === PASTA_POSSIVEL_ABERTURA).length);
console.log("  vistado D+1:", contar(linhas.map((l) => l.vistado_d1)));
console.log("  agendado por:", contar(linhas.map((l) => l.agendado_por)));
console.log("  vistado por:", contar(linhas.map((l) => l.vistado_por)));
console.log("  eficiência:", contar(linhas.map((l) => l.eficiencia)));
console.log("  inconsistência do jurídico:", contar(linhas.map((l) => l.inconsistencias_juridico)));

if (!migrado) {
  console.log("\nA migration do SIOE (orquestra_id/origem) ainda não foi aplicada. Nada foi gravado.");
  if (APLICAR) process.exitCode = 1;
} else {
  console.log(`\nFaltam no BKP do SIOE: ${await quantasFaltamNoBkp(sioe, linhas)} de ${linhas.length}`);
  if (APLICAR) {
    await gravarNoBkp(sioe, linhas);
    console.log(`Gravadas no BKP do SIOE: ${linhas.length}. Faltam agora: ${await quantasFaltamNoBkp(sioe, linhas)}`);
  } else {
    console.log("Simulação: nada foi gravado.");
  }
}
