import "server-only";

import { CONTAGENS_ZERADAS, type ContagensVistagem } from "./contagens";
import type { PerfilVistagem } from "./http";
import { admin, falhou } from "./server";

/**
 * Números das abas da Vistagem para quem está olhando: só `count` (head, sem trazer linhas), para o cabeçalho poder
 * atualizar de tempos em tempos sem pesar. O jurídico só enxerga a aba Vistagem: as outras voltam zeradas e a dele
 * conta só as áreas dele (e sem as de risco, se ele não vista risco), igual à fila que ele abre.
 */
export async function contarAbasDaVistagem(perfil: Pick<PerfilVistagem, "papel" | "areas" | "veRisco">): Promise<ContagensVistagem> {
  const db = admin();
  const publicacoes = () => db.from("vistagem_publicacoes").select("id", { count: "exact", head: true });
  const contar = async (contexto: string, consulta: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count, error } = await consulta;
    if (error) falhou(contexto, error);
    return count ?? 0;
  };

  const paraVistar = async () => {
    if (perfil.areas && !perfil.areas.length) return 0;
    let consulta = publicacoes().eq("status", "juridico_vistar");
    if (perfil.areas) consulta = consulta.in("escritorio_responsavel", perfil.areas);
    if (!perfil.veRisco) consulta = consulta.not("demanda_risco", "is", true);
    return contar("contar as publicações para vistar", consulta);
  };

  if (perfil.papel !== "controladoria") return { ...CONTAGENS_ZERADAS, vistagem: await paraVistar() };

  const [triagem, duplicidades, vistagem, conferencia, check] = await Promise.all([
    contar("contar a Triagem Manual", publicacoes().eq("status", "triagem_pendente")),
    // Mesmo filtro da aba Duplicidades (pendentes): ligada a uma principal e ainda sem revisão.
    contar("contar as duplicidades", publicacoes().not("duplicidade_de", "is", null).is("duplicidade_resultado", null)),
    paraVistar(),
    contar("contar a Conferência", publicacoes().eq("status", "controladoria_vistar")),
    contar("contar o Check", publicacoes().in("status", ["agendado", "revisar"])),
  ]);
  return { triagem, duplicidades, vistagem, conferencia, check };
}
