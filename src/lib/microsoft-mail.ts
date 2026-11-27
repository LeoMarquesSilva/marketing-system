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
