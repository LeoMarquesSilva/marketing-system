/**
 * E-mail curto que acompanha um aviso do sino (quando Pessoas e Cultura liga o
 * envio por e-mail). Leva só o aviso e o botão para abrir no ORQESTRAI: o texto
 * do feedback fica no sistema, porque e-mail pode ser encaminhado. Mesma
 * identidade do e-mail de boas-vindas (papel, azul-marinho e dourado; títulos em
 * caixa baixa; Montserrat, Arial no Outlook). Função pura, testável.
 */

export const NOTIFICATION_EMAIL_BASE_URL = "https://www.orqestrai.com.br";

const NAVY = "#0D1E2E";
const PAPER = "#FCF9F5";
const GOLD = "#E1B16D";
const GOLD_TEXT = "#9C7434";
const TEXT = "#212529";
const MUTED = "#5F6B76";
const LINE = "#E9E1D4";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface NotificationEmailInput {
  /** Nome de quem recebe (usa o primeiro). */
  recipientName: string;
  /** O mesmo título do aviso no sino. */
  title: string;
  /** Uma frase de contexto, sem conteúdo sensível. */
  intro: string;
  /** Caminho no sistema (ex.: /feedback?f=...). */
  link: string;
  button?: string;
  baseUrl?: string;
}

export function buildNotificationEmail(input: NotificationEmailInput): { subject: string; html: string } {
  const base = (input.baseUrl ?? NOTIFICATION_EMAIL_BASE_URL).replace(/\/+$/, "");
  const url = escapeHtml(input.link.startsWith("http") ? input.link : `${base}${input.link.startsWith("/") ? "" : "/"}${input.link}`);
  const first = escapeHtml(input.recipientName.trim().split(/\s+/)[0] ?? "");
  const title = escapeHtml(input.title);
  const intro = escapeHtml(input.intro);
  const button = escapeHtml(input.button ?? "Abrir no ORQESTRAI");
  const assets = `${base}/rh/boas-vindas/email`;
  const font = "'Montserrat', Arial, Helvetica, sans-serif";

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700&display=swap" rel="stylesheet">
<!--[if mso]><style>* { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
<style>
  @media (max-width: 620px) {
    .px { padding-left: 24px !important; padding-right: 24px !important; }
    .titulo { font-size: 22px !important; line-height: 29px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F3EEE6;" bgcolor="#F3EEE6">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F3EEE6;opacity:0;">${intro}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F3EEE6" style="background:#F3EEE6;">
<tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;" bgcolor="#ffffff">
    <tr><td class="px" bgcolor="${PAPER}" style="background:${PAPER};padding:24px 44px;border-bottom:1px solid ${GOLD};">
      <img src="${assets}/logo-bismarchi-pires.png" width="200" alt="Bismarchi | Pires Sociedade de Advogados" style="display:block;width:200px;max-width:100%;height:auto;border:0;color:${NAVY};font-family:Arial, Helvetica, sans-serif;font-size:16px;font-weight:bold;">
    </td></tr>
    <tr><td class="px" bgcolor="${NAVY}" style="background:${NAVY};padding:32px 44px 34px 44px;font-family:${font};">
      ${first ? `<p style="margin:0 0 10px 0;font-size:14px;line-height:20px;font-weight:600;color:${GOLD};">Olá, ${first}!</p>` : ""}
      <h1 class="titulo" style="margin:0;font-size:25px;line-height:33px;font-weight:300;letter-spacing:0.3px;text-transform:lowercase;color:#ffffff;">${title}</h1>
    </td></tr>
    <tr><td class="px" style="padding:30px 44px 0 44px;font-family:${font};color:${TEXT};">
      <p style="margin:0 0 22px 0;font-size:15px;line-height:25px;color:#3A4248;">${intro}</p>
      <a href="${url}" style="display:inline-block;background:${NAVY};border-radius:8px;padding:14px 28px;font-family:${font};font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;">${button}</a>
    </td></tr>
    <tr><td class="px" style="padding:30px 44px 36px 44px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="border-top:1px solid ${LINE};padding-top:18px;font-family:${font};">
          <p style="margin:0;font-size:14px;line-height:20px;font-weight:600;color:${NAVY};">ORQESTRAI</p>
          <p style="margin:2px 0 0 0;font-size:13px;line-height:20px;color:${MUTED};">Bismarchi | Pires Sociedade de Advogados</p>
          <p style="margin:14px 0 0 0;font-size:11px;line-height:17px;color:#98A1A9;">Se o botão não abrir, copie e cole este endereço no navegador:<br><a href="${url}" style="color:${GOLD_TEXT};word-break:break-all;">${url}</a></p>
        </td>
      </tr></table>
    </td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td align="center" style="padding:20px 24px 8px 24px;font-family:${font};font-size:11px;line-height:17px;color:#8A8F94;">
      Uso interno. E-mail automático do ORQESTRAI; o aviso também está no sino do sistema.<br>Não responda: as respostas não são lidas. Dúvidas, fale com Pessoas e Cultura.
    </td></tr>
  </table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;

  return { subject: input.title, html };
}
