import "server-only";

import { VistagemError } from "./errors";

const GRAPH = "https://graph.microsoft.com/v1.0";
/** Pasta onde o Power Automate deixa o xlsx diário da Kurier. */
const SITE_KURIER = "bpplaw2.sharepoint.com:/sites/BISMARCHIPIRES";
const PASTA_KURIER = "Núcleo de Publicações/2023/PUBLIS - KURRIER";

export interface ArquivoSharePoint {
  id: string;
  nome: string;
  criadoEm: string;
  tamanho: number;
}

async function tokenGraph(): Promise<string> {
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim();
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const secret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  if (!tenant || !clientId || !secret) {
    throw new VistagemError("Credenciais do Microsoft Graph não configuradas (MICROSOFT_TENANT_ID/CLIENT_ID/CLIENT_SECRET).", 500);
  }
  const resposta = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: secret,
      scope: "https://graph.microsoft.com/.default",
    }),
    cache: "no-store",
  });
  const corpo = (await resposta.json().catch(() => null)) as { access_token?: string; error_description?: string } | null;
  if (!resposta.ok || !corpo?.access_token) {
    throw new VistagemError(`Falha ao autenticar no Microsoft Graph: ${corpo?.error_description?.split("\r")[0] ?? resposta.status}`, 502);
  }
  return corpo.access_token;
}

async function graphJson<T>(caminho: string, token: string): Promise<T> {
  const resposta = await fetch(caminho.startsWith("http") ? caminho : `${GRAPH}${caminho}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!resposta.ok) {
    throw new VistagemError(`SharePoint respondeu ${resposta.status} ao ler a pasta da Kurier.`, 502);
  }
  return (await resposta.json()) as T;
}

interface ItemGraph {
  id: string;
  name: string;
  size: number;
  createdDateTime: string;
  file?: unknown;
}

export async function listarArquivosKurierSharePoint(): Promise<{ token: string; siteId: string; arquivos: ArquivoSharePoint[] }> {
  const token = await tokenGraph();
  const site = await graphJson<{ id: string }>(`/sites/${SITE_KURIER}`, token);
  const arquivos: ArquivoSharePoint[] = [];
  let proxima: string | undefined =
    `/sites/${site.id}/drive/root:/${encodeURI(PASTA_KURIER)}:/children?$top=200&$select=id,name,size,createdDateTime,file`;
  while (proxima) {
    const pagina: { value: ItemGraph[]; "@odata.nextLink"?: string } = await graphJson(proxima, token);
    for (const item of pagina.value) {
      if (item.file) arquivos.push({ id: item.id, nome: item.name, criadoEm: item.createdDateTime, tamanho: item.size });
    }
    proxima = pagina["@odata.nextLink"];
  }
  return { token, siteId: site.id, arquivos };
}

export async function baixarArquivoSharePoint(siteId: string, itemId: string, token: string): Promise<Uint8Array> {
  const resposta = await fetch(`${GRAPH}/sites/${siteId}/drive/items/${itemId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!resposta.ok) throw new VistagemError(`Falha ao baixar arquivo do SharePoint (${resposta.status}).`, 502);
  return new Uint8Array(await resposta.arrayBuffer());
}

/** Baixa um arquivo pelo caminho dentro da biblioteca padrão de um site (ex.: relatórios do VIOS). */
export async function baixarArquivoPorCaminho(site: string, caminho: string): Promise<Uint8Array> {
  const token = await tokenGraph();
  const siteInfo = await graphJson<{ id: string }>(`/sites/${site}`, token);
  const resposta = await fetch(`${GRAPH}/sites/${siteInfo.id}/drive/root:/${encodeURI(caminho)}:/content`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!resposta.ok) throw new VistagemError(`Falha ao baixar ${caminho} do SharePoint (${resposta.status}).`, 502);
  return new Uint8Array(await resposta.arrayBuffer());
}
