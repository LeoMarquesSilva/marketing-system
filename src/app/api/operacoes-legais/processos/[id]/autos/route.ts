import { carregarAutos } from "@/lib/processos/autos-server";
import { comAcesso } from "@/lib/processos/http";
import { limparSugestoesJaNoCadastro } from "@/lib/processos/sugestoes-server";

export const dynamic = "force-dynamic";

/** Pedidos ao robô, PDFs e sugestões da IA do processo. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return comAcesso(async () => {
    // O cadastro pode ter recebido o mesmo valor por outra via (importação do VIOS): essas sugestões saem da fila.
    await limparSugestoesJaNoCadastro(id).catch((erro: unknown) => console.error("[processos] limpar sugestões:", erro instanceof Error ? erro.message : erro));
    return { autos: await carregarAutos(id) };
  }, { processo: id });
}
