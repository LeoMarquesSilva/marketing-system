import "server-only";

/**
 * Envio de e-mail 1:1 (transacional) pela caixa do Microsoft 365, via Graph.
 * Usa o mesmo app do Entra da vistagem (MICROSOFT_TENANT_ID/CLIENT_ID/SECRET),
 * que precisa da permissão de aplicativo Mail.Send com consentimento do admin.
 * Sai da caixa da Controladoria (respostas chegam lá); MICROSOFT_MAIL_SENDER troca
 * a caixa sem mexer no código.
 * Não serve para envio em massa: campanhas seguem pelo Resend.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
const DEFAULT_SENDER = "controladoria@bismarchipires.com.br";

export class MicrosoftMailError extends Error {}

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

export async function enviarEmailMicrosoft(params: {
  para: string;
  assunto: string;
  html: string;
  /** Para onde vão as respostas (ex.: a pessoa do RH que enviou). Sem ele, voltam para o remetente. */
  responderPara?: string | null;
}): Promise<void> {
  const remetente = process.env.MICROSOFT_MAIL_SENDER?.trim() || DEFAULT_SENDER;
  const token = await tokenGraph();
  const responderPara = params.responderPara?.trim();
  const resposta = await fetch(`${GRAPH}/users/${encodeURIComponent(remetente)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: params.assunto,
        body: { contentType: "HTML", content: params.html },
        toRecipients: [{ emailAddress: { address: params.para } }],
        ...(responderPara ? { replyTo: [{ emailAddress: { address: responderPara } }] } : {}),
      },
      saveToSentItems: false,
    }),
    cache: "no-store",
  });
  // O Graph responde 202 (aceito) sem corpo quando o envio entra na fila.
  if (resposta.status !== 202) {
    const corpo = (await resposta.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    const detalhe = corpo?.error ? `${corpo.error.code}: ${corpo.error.message}` : String(resposta.status);
    throw new MicrosoftMailError(`O Microsoft 365 recusou o envio (${detalhe}).`);
  }
}
