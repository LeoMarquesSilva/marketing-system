import { comAcesso } from "@/lib/processos/http";
import { resumoDasPessoas } from "@/lib/processos/pessoas-server";
import { sincronizarPessoasComVios } from "@/lib/processos/pessoas-sync-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Liga as pessoas ao cadastro do VIOS (pelo SIOE), unifica as repetidas e traz documento, endereço e contato. */
export async function POST() {
  return comAcesso(async (ator) => ({ resultado: await sincronizarPessoasComVios(ator), resumo: await resumoDasPessoas() }));
}
