import "server-only";

import { urlDoLogoDoGrupo } from "@/lib/icp/server";
import { chaveGrupo } from "./logos";
import { admin, falhou } from "./server";

/**
 * Logos dos grupos de clientes, os mesmos do ICP (página do LinkedIn ou site, em icp_group_profiles),
 * pela chave do grupo. Quem não tem logo fica de fora: a tela mostra as iniciais.
 */
export async function logosDosGrupos(): Promise<Record<string, string>> {
  const { data, error } = await admin().from("icp_group_profiles").select("grupo, logo_path, updated_at").not("logo_path", "is", null);
  if (error) falhou("carregar os logos dos grupos", error);
  const logos: Record<string, string> = {};
  for (const linha of (data ?? []) as { grupo: string; logo_path: string; updated_at: string }[]) {
    logos[chaveGrupo(linha.grupo)] = urlDoLogoDoGrupo(linha.logo_path, linha.updated_at);
  }
  return logos;
}
