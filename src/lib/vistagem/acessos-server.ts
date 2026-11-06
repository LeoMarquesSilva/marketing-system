import "server-only";

import { hasVistagemAccess, isAdminRole, papelVistagem } from "@/lib/access-control";
import { chaveNome } from "./agendamento";
import { lerPedidoDeAcesso, ondeVista, ordenarAcessos, type AcessoVistagem } from "./acessos";
import { lerConfiguracoes } from "./configuracoes-server";
import { VistagemError } from "./errors";
import { pessoasPorNome } from "./pessoas-server";
import { admin, falhou } from "./server";

type UsuarioRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  permissions: string[] | null;
  is_active: boolean | null;
  avatar_url: string | null;
  vistagem_papel: string | null;
  vistagem_areas: string[] | null;
  vistagem_risco: boolean | null;
};

const COLUNAS = "id, name, email, role, permissions, is_active, avatar_url, vistagem_papel, vistagem_areas, vistagem_risco";

const perfilDe = (row: UsuarioRow) => ({ role: row.role, permissions: row.permissions, vistagem_papel: row.vistagem_papel });

/** Quem está ativo e tem a Vistagem (admin ou liberado em Usuários), com o papel, as áreas e onde é vistador. */
export async function listarAcessosVistagem(): Promise<AcessoVistagem[]> {
  const { data, error } = await admin().from("users").select(COLUNAS).limit(5000);
  if (error) falhou("carregar quem acessa a Vistagem", error);
  const usuarios = ((data ?? []) as UsuarioRow[]).filter((row) => row.is_active !== false && papelVistagem(perfilDe(row)) !== null);

  const [{ vistadores }, pessoas] = await Promise.all([
    lerConfiguracoes(),
    // Sem foto em Usuários, a do RH ou do organograma (pelo nome); falhar aqui só tira as fotos.
    pessoasPorNome(usuarios.filter((row) => !row.avatar_url).map((row) => row.name)).catch((erro) => {
      console.error("[vistagem] fotos de quem acessa:", erro instanceof Error ? erro.message : erro);
      return null;
    }),
  ]);

  return ordenarAcessos(
    usuarios.map((row) => {
      const nome = row.name?.trim() || row.email || "Sem nome";
      const papel = papelVistagem(perfilDe(row)) ?? "controladoria";
      const juridico = papel === "juridico";
      return {
        id: row.id,
        nome,
        email: row.email,
        foto: row.avatar_url || pessoas?.fotos[chaveNome(nome)] || null,
        admin: isAdminRole(perfilDe(row)),
        papel,
        areas: juridico ? (row.vistagem_areas ?? []) : [],
        veRisco: !juridico || row.vistagem_risco !== false,
        vistadorEm: ondeVista(nome, vistadores),
      };
    })
  );
}

/**
 * Grava o papel, as áreas e o risco de uma pessoa. Admin é sempre controladoria e quem não tem a Vistagem liberada
 * em Usuários não tem o que ajustar aqui. Os dados valem na hora (o servidor lê a cada pedido); o menu da pessoa
 * muda quando ela recarregar a página.
 */
export async function salvarAcessoVistagem(userId: string, corpo: unknown): Promise<void> {
  if (!userId) throw new VistagemError("Escolha a pessoa.");
  const pedido = lerPedidoDeAcesso(corpo);
  const db = admin();
  const { data, error } = await db.from("users").select(COLUNAS).eq("id", userId).maybeSingle();
  if (error) falhou("carregar a pessoa", error);
  const row = data as UsuarioRow | null;
  if (!row || row.is_active === false) throw new VistagemError("Pessoa não encontrada ou inativa.", 404);
  if (isAdminRole(perfilDe(row))) throw new VistagemError("Administrador é sempre controladoria na Vistagem.");
  if (!hasVistagemAccess(perfilDe(row))) {
    throw new VistagemError("Essa pessoa não tem a Vistagem liberada. Marque o módulo em Usuários antes.");
  }
  const { error: erroAoSalvar } = await db
    .from("users")
    .update({
      vistagem_papel: pedido.papel,
      vistagem_areas: pedido.papel === "juridico" ? pedido.areas : null,
      vistagem_risco: pedido.risco,
    })
    .eq("id", userId);
  if (erroAoSalvar) falhou("salvar o acesso à Vistagem", erroAoSalvar);
}
