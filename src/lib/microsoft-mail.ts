import "server-only";

/**
 * Envio de e-mail 1:1 (transacional) pela caixa do Microsoft 365, via Graph.
 * Usa o mesmo app do Entra da vistagem (MICROSOFT_TENANT_ID/CLIENT_ID/SECRET),
 * que precisa da permissão de aplicativo Mail.Send com consentimento do admin.
 * Sai da caixa da Controladoria (respostas chegam lá); MICROSOFT_MAIL_SENDER troca
 * a caixa sem mexer no código.
 * Campanhas de produto também podem sair por aqui, da caixa do próprio sócio, um e-mail por
 * pessoa e com intervalo (ver email-marketing-mailbox.ts); newsletters em volume seguem pelo Resend.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
const DEFAULT_SENDER = "controladoria@bismarchipires.com.br";

export class MicrosoftMailError extends Error {
  constructor(
    message: string,
    /** HTTP do Graph (403 = sem permissão na caixa, 429 = limite de envio por minuto). */
    readonly status?: number,
    readonly code?: string
  ) {
    super(message);
  }
}

export function microsoftMailConfigurado(): boolean {
  return Boolean(
    process.env.MICROSOFT_TENANT_ID?.trim() &&
      process.env.MICROSOFT_CLIENT_ID?.trim() &&
      process.env.MICROSOFT_CLIENT_SECRET?.trim()
  );
}

async function tokenGraph(): Promise<string> {
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim();
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const secret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  if (!tenant || !clientId || !secret) {
    throw new MicrosoftMailError("Credenciais do Microsoft Graph não configuradas (MICROSOFT_TENANT_ID/CLIENT_ID/CLIENT_SECRET).");
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
    throw new MicrosoftMailError(`Falha ao autenticar no Microsoft Graph: ${corpo?.error_description?.split("\r")[0] ?? resposta.status}`);
  }
  return corpo.access_token;
}

// O token do app vale ~1h: reaproveitar evita uma chamada de login por e-mail nos envios em sequência.
let tokenCache: { valor: string; expiraEm: number } | null = null;

export async function tokenGraphReaproveitado(): Promise<string> {
  if (tokenCache && tokenCache.expiraEm > Date.now()) return tokenCache.valor;
  const valor = await tokenGraph();
  tokenCache = { valor, expiraEm: Date.now() + 45 * 60 * 1000 };
  return valor;
}

const caixaPorEndereco = new Map<string, string>();

/**
 * O Graph só acha a caixa pelo endereço principal (UPN). Quem usa @bismarchipires como apelido de uma
 * caixa @bpplaw (ex.: daniel@bismarchipires.com.br → daniel@bpplaw.com.br) é procurado pelos apelidos.
 * O e-mail sai pelo endereço principal da caixa.
 */
export async function resolverCaixa(endereco: string, token: string): Promise<string> {
  const chave = endereco.toLowerCase();
  const emCache = caixaPorEndereco.get(chave);
  if (emCache) return emCache;
  const direto = await fetch(`${GRAPH}/users/${encodeURIComponent(endereco)}?$select=userPrincipalName`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (direto.ok) {
    const corpo = (await direto.json()) as { userPrincipalName: string };
    caixaPorEndereco.set(chave, corpo.userPrincipalName);
    return corpo.userPrincipalName;
  }
  const filtro = `proxyAddresses/any(x:x eq 'smtp:${chave.replace(/'/g, "''")}')`;
  const busca = await fetch(
    `${GRAPH}/users?$filter=${encodeURIComponent(filtro).replace(/'/g, "%27")}&$select=userPrincipalName`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  const achados = busca.ok ? ((await busca.json()) as { value: { userPrincipalName: string }[] }).value : [];
  if (achados.length !== 1) {
    throw new MicrosoftMailError(`A caixa ${endereco} não foi encontrada no Microsoft 365.`, 404, "MailboxNotFound");
  }
  caixaPorEndereco.set(chave, achados[0].userPrincipalName);
  return achados[0].userPrincipalName;
}

export async function enviarEmailMicrosoft(params: {
  /** Um ou vários destinatários (todos em "Para"). */
  para: string | string[];
  /** Em cópia (Cc). */
  cc?: string[];
  assunto: string;
  html: string;
  /** Para onde vão as respostas (ex.: a pessoa do RH que enviou). Sem ele, voltam para o remetente. */
  responderPara?: string | null;
  /** Caixa que envia (ex.: o sócio de uma campanha de produto). Padrão: Controladoria. */
  remetente?: string | null;
  /** Guarda a cópia nos Itens Enviados do remetente (campanhas: sim, para ele ver o que saiu). */
  salvarEmEnviados?: boolean;
}): Promise<void> {
  const token = await tokenGraphReaproveitado();
  // O remetente da campanha pode vir pelo apelido @bismarchipires; o padrão (Controladoria) já funciona direto.
  const remetente = params.remetente?.trim()
    ? await resolverCaixa(params.remetente.trim(), token)
    : process.env.MICROSOFT_MAIL_SENDER?.trim() || DEFAULT_SENDER;
  const responderPara = params.responderPara?.trim();
  const resposta = await fetch(`${GRAPH}/users/${encodeURIComponent(remetente)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: params.assunto,
        body: { contentType: "HTML", content: params.html },
        toRecipients: (Array.isArray(params.para) ? params.para : [params.para]).map((address) => ({ emailAddress: { address } })),
        ...(params.cc?.length ? { ccRecipients: params.cc.map((address) => ({ emailAddress: { address } })) } : {}),
        ...(responderPara ? { replyTo: [{ emailAddress: { address: responderPara } }] } : {}),
      },
      saveToSentItems: params.salvarEmEnviados ?? false,
    }),
    cache: "no-store",
  });
  // O Graph responde 202 (aceito) sem corpo quando o envio entra na fila.
  if (resposta.status !== 202) {
    const corpo = (await resposta.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    const detalhe = corpo?.error ? `${corpo.error.code}: ${corpo.error.message}` : String(resposta.status);
    if (resposta.status === 401) tokenCache = null;
    throw new MicrosoftMailError(`O Microsoft 365 recusou o envio (${detalhe}).`, resposta.status, corpo?.error?.code);
  }
}

/* ------------------------------------------------------------------ leitura da caixa */

/** Uma mensagem da caixa, em texto simples (o que a conversa de uma negociação mostra). */
export interface MensagemDaCaixa {
  id: string;
  conversaId: string;
  assunto: string;
  de: string | null;
  para: string[];
  cc: string[];
  /** Quando saiu (enviada) ou chegou (recebida). */
  em: string;
  texto: string;
}

interface MensagemGraph {
  id: string;
  conversationId?: string;
  subject?: string;
  from?: { emailAddress?: { address?: string } };
  toRecipients?: { emailAddress?: { address?: string } }[];
  ccRecipients?: { emailAddress?: { address?: string } }[];
  sentDateTime?: string;
  receivedDateTime?: string;
  isDraft?: boolean;
  body?: { content?: string };
}

const enderecos = (lista: MensagemGraph["toRecipients"]) =>
  (lista ?? []).map((item) => item.emailAddress?.address?.trim().toLowerCase() ?? "").filter(Boolean);

function paraMensagem(item: MensagemGraph): MensagemDaCaixa {
  return {
    id: item.id,
    conversaId: item.conversationId ?? "",
    assunto: item.subject ?? "",
    de: item.from?.emailAddress?.address?.trim().toLowerCase() ?? null,
    para: enderecos(item.toRecipients),
    cc: enderecos(item.ccRecipients),
    em: item.receivedDateTime ?? item.sentDateTime ?? new Date().toISOString(),
    texto: (item.body?.content ?? "").replace(/\r\n/g, "\n").trim(),
  };
}

const CAMPOS_DA_MENSAGEM = "id,conversationId,subject,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,isDraft,body";

async function lerDaCaixa(caminho: string): Promise<MensagemGraph[]> {
  const token = await tokenGraphReaproveitado();
  const resposta = await fetch(`${GRAPH}${caminho}`, {
    // Corpo em texto simples: a conversa mostra o que foi escrito, sem o HTML do Outlook.
    headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="text"' },
    cache: "no-store",
  });
  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    if (resposta.status === 401) tokenCache = null;
    throw new MicrosoftMailError(
      `O Microsoft 365 recusou a leitura da caixa (${corpo?.error ? `${corpo.error.code}: ${corpo.error.message}` : resposta.status}).`,
      resposta.status,
      corpo?.error?.code
    );
  }
  return ((await resposta.json()) as { value: MensagemGraph[] }).value ?? [];
}

/**
 * Mensagens dos Itens Enviados da caixa num intervalo (para achar a conversa de um e-mail mandado pelo sendMail,
 * que não devolve o id). Precisa da permissão de aplicativo Mail.Read.
 */
export async function enviadosDaCaixa(caixa: string, desde: Date, ate: Date): Promise<MensagemDaCaixa[]> {
  const token = await tokenGraphReaproveitado();
  const upn = await resolverCaixa(caixa, token);
  const filtro = `sentDateTime ge ${desde.toISOString()} and sentDateTime le ${ate.toISOString()}`;
  const itens = await lerDaCaixa(
    `/users/${encodeURIComponent(upn)}/mailFolders/sentitems/messages?$filter=${encodeURIComponent(filtro)}&$select=${CAMPOS_DA_MENSAGEM}&$top=50`
  );
  return itens.filter((item) => !item.isDraft).map(paraMensagem);
}

/** Todas as mensagens de uma conversa na caixa (enviadas e recebidas, em qualquer pasta), da mais antiga à mais nova. */
export async function mensagensDaConversa(caixa: string, conversaId: string): Promise<MensagemDaCaixa[]> {
  const token = await tokenGraphReaproveitado();
  const upn = await resolverCaixa(caixa, token);
  const filtro = `conversationId eq '${conversaId.replace(/'/g, "''")}'`;
  const itens = await lerDaCaixa(`/users/${encodeURIComponent(upn)}/messages?$filter=${encodeURIComponent(filtro)}&$select=${CAMPOS_DA_MENSAGEM}&$top=100`);
  return itens
    .filter((item) => !item.isDraft)
    .map(paraMensagem)
    .sort((a, b) => a.em.localeCompare(b.em));
}

/**
 * Responde uma mensagem da conversa pela caixa (fica na mesma conversa do Outlook, com o histórico citado abaixo do
 * texto). Os destinatários informados substituem os da mensagem original.
 */
export async function responderMensagem(params: { caixa: string; mensagemId: string; para: string[]; cc?: string[]; html: string }): Promise<void> {
  const token = await tokenGraphReaproveitado();
  const upn = await resolverCaixa(params.caixa, token);
  const resposta = await fetch(`${GRAPH}/users/${encodeURIComponent(upn)}/messages/${encodeURIComponent(params.mensagemId)}/reply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        toRecipients: params.para.map((address) => ({ emailAddress: { address } })),
        ccRecipients: (params.cc ?? []).map((address) => ({ emailAddress: { address } })),
      },
      comment: params.html,
    }),
    cache: "no-store",
  });
  if (resposta.status !== 202) {
    const corpo = (await resposta.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    if (resposta.status === 401) tokenCache = null;
    throw new MicrosoftMailError(
      `O Microsoft 365 recusou a resposta (${corpo?.error ? `${corpo.error.code}: ${corpo.error.message}` : resposta.status}).`,
      resposta.status,
      corpo?.error?.code
    );
  }
}
