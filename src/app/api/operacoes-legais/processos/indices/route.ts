import { comAcesso } from "@/lib/processos/http";
import { importarIndicesTjsp, situacaoDosIndices } from "@/lib/processos/indices-server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Situação dos índices do TJSP no banco: quantos meses, o último e quando foram importados. */
export async function GET() {
  return comAcesso(async () => ({ indices: await situacaoDosIndices() }));
}

/** Baixa de novo a planilha oficial do TJSP e grava os índices. */
export async function POST() {
  return comAcesso(async () => ({ resultado: await importarIndicesTjsp(), indices: await situacaoDosIndices() }));
}
