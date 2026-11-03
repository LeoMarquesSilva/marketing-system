/** E-mail do "Esqueci minha senha" (link para /redefinir-senha), com a identidade do ORQESTRAI. */

/** Imagens do e-mail: direto no www (o domínio sem www responde 308). */
export const EMAIL_ASSET_BASE_URL = "https://www.orqestrai.com.br";

/** Mesmo prazo do "Email OTP expiration" do Supabase Auth (mailer_otp_exp = 3600 s). */
export const PASSWORD_RESET_LINK_VALIDITY = "1 hora";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function passwordResetLink(origin: string, tokenHash: string): string {
  return `${origin.replace(/\/+$/, "")}/redefinir-senha?token=${encodeURIComponent(tokenHash)}`;
}

/** Ex.: "3 de novembro de 2026, às 09:41 (horário de Brasília)". */
export function formatRequestedAt(date: Date): string {
  const zone = { timeZone: "America/Sao_Paulo" } as const;
  const day = new Intl.DateTimeFormat("pt-BR", { ...zone, day: "numeric", month: "long", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("pt-BR", { ...zone, hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day}, às ${time} (horário de Brasília)`;
}

export function buildPasswordResetEmail(params: {
  name: string | null;
  link: string;
  requestedAt?: Date;
  assetBaseUrl?: string;
}): { subject: string; html: string } {
  const firstName = params.name?.trim().split(/\s+/)[0] ?? "";
  const greeting = firstName ? `Olá, ${escapeHtml(firstName)}.` : "Olá.";
  const link = escapeHtml(params.link);
  const requestedAt = formatRequestedAt(params.requestedAt ?? new Date());
  const assets = `${(params.assetBaseUrl ?? EMAIL_ASSET_BASE_URL).replace(/\/+$/, "")}/ORQESTRAI/identidade-visual/email`;
  // Baloo Bhaijaan 2 é a fonte de texto da marca; quem não carrega web font cai na Arial.
  const font = "'Baloo Bhaijaan 2', Arial, Helvetica, sans-serif";

  const html = `<!doctype html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Redefinir senha</title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+Bhaijaan+2:wght@400;600;700&display=swap" rel="stylesheet">
<!--[if mso]><style>* { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
<style>
  @media (max-width: 620px) {
    .px { padding-left: 24px !important; padding-right: 24px !important; }
    .titulo { font-size: 23px !important; line-height: 30px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#eef1f3;" bgcolor="#eef1f3">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#eef1f3;opacity:0;">Use o botão para criar uma nova senha. O link vale por ${PASSWORD_RESET_LINK_VALIDITY} e funciona uma vez só.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef1f3" style="background:#eef1f3;">
<tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;" bgcolor="#ffffff">
    <tr><td bgcolor="#03070c" style="background:#03070c;line-height:0;font-size:0;">
      <img src="${assets}/topo-orqestrai.jpg" width="600" alt="ORQESTRAI" style="display:block;width:100%;max-width:600px;height:auto;border:0;color:#47cdd0;font-family:Arial, Helvetica, sans-serif;font-size:22px;font-weight:bold;line-height:180px;text-align:center;">
    </td></tr>

    <tr><td class="px" style="padding:40px 44px 0 44px;font-family:${font};color:#1c1c1c;">
      <p style="margin:0 0 10px 0;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#3e84a8;">Segurança da conta</p>
      <h1 class="titulo" style="margin:0 0 20px 0;font-size:26px;line-height:32px;font-weight:700;color:#1c1c1c;">Redefinir sua senha</h1>
      <p style="margin:0 0 12px 0;font-size:16px;line-height:25px;">${greeting}</p>
      <p style="margin:0 0 28px 0;font-size:16px;line-height:25px;color:#3a4248;">Recebemos um pedido para redefinir a senha da sua conta no ORQESTRAI. Para criar uma nova, clique no botão abaixo.</p>
    </td></tr>

    <tr><td class="px" style="padding:0 44px;">
      <a href="${link}" style="display:inline-block;background:#347796;background-image:linear-gradient(135deg,#3e84a8 0%,#347796 50%,#48466e 100%);border-radius:10px;padding:15px 32px;font-family:${font};font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;mso-padding-alt:0;text-underline-color:#347796;">
        <!--[if mso]><i style="letter-spacing:32px;mso-font-width:-100%;mso-text-raise:30pt" hidden>&nbsp;</i><![endif]-->
        <span style="mso-text-raise:15pt;">Criar nova senha</span>
        <!--[if mso]><i style="letter-spacing:32px;mso-font-width:-100%" hidden>&nbsp;</i><![endif]-->
      </a>
    </td></tr>

    <tr><td class="px" style="padding:32px 44px 0 44px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#edfafa" style="background:#edfafa;border:1px solid #cdeeef;border-radius:12px;">
        <tr><td style="padding:16px 20px 6px 20px;font-family:${font};">
          <p style="margin:0;font-size:12px;line-height:16px;color:#5b6670;">Pedido feito em</p>
          <p style="margin:2px 0 0 0;font-size:14px;line-height:21px;color:#1c1c1c;">${requestedAt}</p>
        </td></tr>
        <tr><td style="padding:10px 20px 16px 20px;font-family:${font};">
          <p style="margin:0;font-size:12px;line-height:16px;color:#5b6670;">Validade do link</p>
          <p style="margin:2px 0 0 0;font-size:14px;line-height:21px;color:#1c1c1c;">${PASSWORD_RESET_LINK_VALIDITY}, uso único</p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td class="px" style="padding:24px 44px 0 44px;font-family:${font};">
      <p style="margin:0;font-size:14px;line-height:22px;color:#3a4248;"><strong style="color:#1c1c1c;">Não foi você?</strong> Pode ignorar este e-mail: sua senha atual continua valendo. Se tiver dúvida, é só responder esta mensagem.</p>
    </td></tr>

    <tr><td class="px" style="padding:28px 44px 40px 44px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="border-top:1px solid #e3e8eb;padding-top:20px;font-family:${font};">
          <p style="margin:0;font-size:12px;line-height:19px;color:#6b7680;">Se o botão não abrir, copie e cole este endereço no navegador:<br><a href="${link}" style="color:#347796;word-break:break-all;">${link}</a></p>
        </td>
      </tr></table>
    </td></tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td align="center" style="padding:24px 24px 8px 24px;">
      <img src="${assets}/simbolo-orqestrai.png" width="36" height="28" alt="" style="display:block;width:36px;height:28px;border:0;">
    </td></tr>
    <tr><td align="center" style="padding:0 24px 8px 24px;font-family:${font};font-size:12px;line-height:18px;color:#8a949c;">
      <span style="color:#3a4248;font-weight:700;">ORQESTRAI</span> · by Bismarchi Pires<br>Uso interno. Este e-mail foi enviado automaticamente pelo sistema.
    </td></tr>
  </table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;

  return { subject: "Redefinição de senha do ORQESTRAI", html };
}
