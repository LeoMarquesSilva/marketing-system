import "server-only";

import { lerConfiguracoes } from "./configuracoes-server";
import { VistagemError } from "./errors";
import { admin } from "./server";
import { tokenGraph } from "./sharepoint";
import { importarVistadores, type LinhaDaListaUsuarios, type ResultadoDaImportacao } from "./vistadores-importacao";

const GRAPH = "https://graph.microsoft.com/v1.0";
/** Lista USUARIOS do site BISMARCHIPIRES: quem é responsável pela vistagem de cada área. */
const SITE = "bpplaw2.sharepoint.com:/sites/BISMARCHIPIRES";
const LISTA = "USUARIOS";

async function graph<T>(caminho: string, token: string): Promise<T> {
  const resposta = await fetch(caminho.startsWith("http") ? caminho : `${GRAPH}${caminho}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!resposta.ok) throw new VistagemError(`SharePoint respondeu ${resposta.status} ao ler a lista ${LISTA}.`, 502);
  return (await resposta.json()) as T;
}

type CamposDaLista = {
  Title?: string | null;
  field_1?: string | null;
  field_2?: string | null;
  RESP_x002e_PORVISTAGEMDEPUBLI?: boolean | null;
  GERENTE?: string | null;
};

/** As linhas da lista USUARIOS (Nome, Email, Área, responsável pela vistagem, GERENTE). */
export async function lerListaUsuarios(): Promise<LinhaDaListaUsuarios[]> {
  const token = await tokenGraph();
  const site = await graph<{ id: string }>(`/sites/${SITE}`, token);
  const linhas: LinhaDaListaUsuarios[] = [];
  let proxima: string | undefined = `/sites/${site.id}/lists/${LISTA}/items?$expand=fields&$top=500`;
  while (proxima) {
    const pagina: { value: { fields: CamposDaLista }[]; "@odata.nextLink"?: string } = await graph(proxima, token);
    for (const { fields } of pagina.value) {
      const nome = fields.Title?.replace(/\s+/g, " ").trim();
      if (!nome) continue;
      linhas.push({
        nome,
        email: fields.field_1?.trim().toLowerCase() || null,
        area: fields.field_2?.trim() || null,
        responsavel: fields.RESP_x002e_PORVISTAGEMDEPUBLI === true,
        gerente: fields.GERENTE?.trim() || null,
      });
    }
    proxima = pagina["@odata.nextLink"];
  }
  return linhas;
}

/** Parte do e-mail antes do @: a mesma pessoa aparece com @bismarchipires.com.br e @bpplaw.com.br. */
const usuarioDoEmail = (email: string | null | undefined) => (email ? email.trim().toLowerCase().split("@")[0] : "");

/**
 * Nome completo de cada e-mail, pelo RH (ativos) e, sem ele, pelo cadastro de usuários do Orquestra. A lista às vezes
 * traz só o primeiro nome ("Giovani"); com o nome do RH a foto aparece.
 */
async function nomesPorEmail(): Promise<Map<string, string>> {
  const db = admin();
  const [rh, usuarios] = await Promise.all([
    db.from("hr_employees").select("full_name, email, is_active").not("email", "is", null).limit(3000),
    db.from("users").select("name, email, is_active").not("email", "is", null).limit(3000),
  ]);
  const mapa = new Map<string, string>();
  const guardar = (linhas: { nome: string | null; email: string | null; ativo: boolean | null }[]) => {
    // Ativos por último: sobrescrevem um cadastro antigo com o mesmo e-mail.
    for (const linha of [...linhas].sort((a, b) => Number(Boolean(a.ativo)) - Number(Boolean(b.ativo)))) {
      const chave = usuarioDoEmail(linha.email);
      if (chave && linha.nome?.trim()) mapa.set(chave, linha.nome.trim());
    }
  };
  // Usuários primeiro e RH depois: o nome do RH vale mais (é o das fotos).
  guardar(((usuarios.data ?? []) as { name: string | null; email: string | null; is_active: boolean | null }[]).map((linha) => ({ nome: linha.name, email: linha.email, ativo: linha.is_active })));
  guardar(((rh.data ?? []) as { full_name: string | null; email: string | null; is_active: boolean | null }[]).map((linha) => ({ nome: linha.full_name, email: linha.email, ativo: linha.is_active })));
  return mapa;
}

/** Proposta de vistadores: os de hoje + quem a lista USUARIOS traz de novo (nada é gravado aqui). */
export async function proporVistadoresDaLista(): Promise<ResultadoDaImportacao> {
  const [linhas, nomes, configuracoes] = await Promise.all([lerListaUsuarios(), nomesPorEmail(), lerConfiguracoes()]);
  return importarVistadores(linhas, configuracoes.vistadores, (linha) => nomes.get(usuarioDoEmail(linha.email)) ?? linha.nome);
}
