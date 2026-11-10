/**
 * E-mail de boas-vindas ao colaborador novo, com a identidade do escritório
 * (papel, azul-marinho e dourado do site da Bismarchi | Pires; títulos em caixa
 * baixa; Montserrat no lugar da Gotham, Arial no Outlook). É curto de propósito:
 * leva só ao acesso. Os links e as explicações ficam no ORQESTRAI, em Meus
 * links, sempre atualizados (decisão do usuário em 09/11/2026). Texto-base da
 * Isadora e da Catharina (ticket do Responsum). Função pura: a mesma montagem
 * serve a prévia do modal e o envio.
 */

import { WELCOME_SETUP_VALIDITY_DAYS } from "./types";

/** Imagens do e-mail: direto no www (o domínio sem www responde 308). */
export const WELCOME_EMAIL_ASSET_BASE_URL = "https://www.orqestrai.com.br";

export interface WelcomeEmailInput {
  fullName: string;
  /** Login do ORQESTRAI (e-mail corporativo). */
  loginEmail: string;
  /** `setup` = criar a senha pelo link; `login` = já tem senha, só entrar. */
  access: { kind: "setup" | "login"; url: string };
  assetBaseUrl?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

const NAVY = "#0D1E2E";
const PAPER = "#FCF9F5";
const GOLD = "#E1B16D";
const GOLD_TEXT = "#9C7434";
const TEXT = "#212529";
const MUTED = "#5F6B76";
const LINE = "#E9E1D4";

/** O que a pessoa encontra no primeiro acesso (Meus links). */
const WHAT_YOU_FIND = [
  "Os links e ferramentas da sua área, com uma explicação de cada um",
  "Os acessos de uso interno, que não circulam por e-mail",
  "Tudo sempre atualizado por Pessoas e Cultura",
];

export function buildWelcomeEmail(input: WelcomeEmailInput): { subject: string; html: string } {
  const firstName = firstNameOf(input.fullName);
  const name = escapeHtml(firstName || input.fullName.trim());
  const login = escapeHtml(input.loginEmail);
  const accessUrl = escapeHtml(input.access.url);
  const assets = `${(input.assetBaseUrl ?? WELCOME_EMAIL_ASSET_BASE_URL).replace(/\/+$/, "")}/rh/boas-vindas/email`;
  const font = "'Montserrat', Arial, Helvetica, sans-serif";
  const isSetup = input.access.kind === "setup";

  const accessIntro = isSetup
    ? "Crie a sua senha para entrar. Assim que você entrar, a página <strong style=\"color:" +
      NAVY +
      ";\">Meus links</strong> abre com tudo o que você precisa para começar."
    : "Entre com o seu login. A página <strong style=\"color:" +
      NAVY +
      ";\">Meus links</strong> reúne tudo o que você precisa para começar.";
  const accessButton = isSetup ? "Criar minha senha" : "Entrar no ORQESTRAI";
  const accessNote = isSetup
    ? `Seu login: <strong style="color:${TEXT};">${login}</strong><br>O link vale por ${WELCOME_SETUP_VALIDITY_DAYS} dias e funciona uma vez só.`
    : `Seu login: <strong style="color:${TEXT};">${login}</strong><br>Se não lembrar a senha, use “Esqueci minha senha” na tela de entrada.`;

  const findRows = WHAT_YOU_FIND.map(
    (item) => `<tr>
      <td width="18" valign="top" style="padding:3px 0 7px 0;font-family:${font};font-size:14px;line-height:22px;font-weight:700;color:${GOLD_TEXT};">&#8250;</td>
      <td valign="top" style="padding:3px 0 7px 0;font-family:${font};font-size:14px;line-height:22px;color:#3A4248;">${item}</td>
    </tr>`
  ).join("");

  const html = `<!doctype html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Boas-vindas ao time BP</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700&display=swap" rel="stylesheet">
<!--[if mso]><style>* { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
<style>
  @media (max-width: 620px) {
    .px { padding-left: 24px !important; padding-right: 24px !important; }
    .titulo { font-size: 25px !important; line-height: 32px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F3EEE6;" bgcolor="#F3EEE6">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F3EEE6;opacity:0;">Seu acesso ao ORQESTRAI, onde estão os links e ferramentas da sua rotina no escritório.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F3EEE6" style="background:#F3EEE6;">
<tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;" bgcolor="#ffffff">
    <tr><td class="px" bgcolor="${PAPER}" style="background:${PAPER};padding:28px 44px;border-bottom:1px solid ${GOLD};">
      <img src="${assets}/logo-bismarchi-pires.png" width="230" alt="Bismarchi | Pires Sociedade de Advogados" style="display:block;width:230px;max-width:100%;height:auto;border:0;color:${NAVY};font-family:Arial, Helvetica, sans-serif;font-size:18px;font-weight:bold;">
    </td></tr>

    <tr><td class="px" bgcolor="${NAVY}" style="background:${NAVY};padding:40px 44px 42px 44px;font-family:${font};">
      <p style="margin:0 0 12px 0;font-size:14px;line-height:20px;font-weight:600;color:${GOLD};">Olá, ${name}!</p>
      <h1 class="titulo" style="margin:0;font-size:30px;line-height:38px;font-weight:300;letter-spacing:0.5px;text-transform:lowercase;color:#ffffff;">seja muito bem-vindo(a)<br>ao time bp</h1>
    </td></tr>

    <tr><td class="px" style="padding:36px 44px 0 44px;font-family:${font};color:${TEXT};">
      <p style="margin:0 0 14px 0;font-size:15px;line-height:25px;">Para apoiar seu início no escritório, reunimos os <strong>links e ferramentas importantes para a sua rotina</strong> no ORQESTRAI, o sistema interno do escritório.</p>
      <p style="margin:0;font-size:15px;line-height:25px;color:#3A4248;">Durante a sua integração, apresentamos cada ferramenta e as suas funcionalidades, de acordo com as atividades da sua área. Agora elas estão todas em um só lugar.</p>
    </td></tr>

    <tr><td class="px" style="padding:28px 44px 0 44px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" style="background:${PAPER};border:1px solid ${LINE};border-radius:12px;">
        <tr><td style="padding:24px 24px 8px 24px;font-family:${font};">
          <p style="margin:0 0 6px 0;font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${GOLD_TEXT};">Seu acesso ao ORQESTRAI</p>
          <p style="margin:0 0 18px 0;font-size:14px;line-height:22px;color:#3A4248;">${accessIntro}</p>
          <a href="${accessUrl}" style="display:inline-block;background:${NAVY};border-radius:8px;padding:14px 28px;font-family:${font};font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;mso-padding-alt:0;">
            <!--[if mso]><i style="letter-spacing:28px;mso-font-width:-100%;mso-text-raise:28pt" hidden>&nbsp;</i><![endif]-->
            <span style="mso-text-raise:14pt;">${accessButton}</span>
            <!--[if mso]><i style="letter-spacing:28px;mso-font-width:-100%" hidden>&nbsp;</i><![endif]-->
          </a>
        </td></tr>
        <tr><td style="padding:12px 24px 22px 24px;font-family:${font};">
          <p style="margin:0;font-size:12px;line-height:19px;color:${MUTED};">${accessNote}</p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td class="px" style="padding:28px 44px 0 44px;">
      <p style="margin:0 0 8px 0;font-family:${font};font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${GOLD_TEXT};">O que você encontra lá</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${findRows}</table>
      <p style="margin:8px 0 0 0;font-family:${font};font-size:14px;line-height:22px;color:#3A4248;">Depois, é só voltar quando precisar: Meus links fica no menu do seu perfil. Se ficar alguma dúvida, responda este e-mail.</p>
    </td></tr>

    <tr><td class="px" style="padding:32px 44px 0 44px;font-family:${font};color:${TEXT};">
      <p style="margin:0 0 10px 0;font-size:15px;line-height:25px;">Desejamos a você uma excelente jornada no time BP, com muito aprendizado, desenvolvimento e novas conquistas!</p>
      <p style="margin:0;font-size:15px;line-height:22px;font-weight:700;color:${GOLD_TEXT};">#SomosÚnicos</p>
    </td></tr>

    <tr><td class="px" style="padding:28px 44px 40px 44px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="border-top:1px solid ${LINE};padding-top:20px;font-family:${font};">
          <p style="margin:0;font-size:14px;line-height:20px;font-weight:600;color:${NAVY};">Pessoas e Cultura</p>
          <p style="margin:2px 0 0 0;font-size:13px;line-height:20px;color:${MUTED};">Bismarchi | Pires Sociedade de Advogados</p>
          <p style="margin:16px 0 0 0;font-size:11px;line-height:17px;color:#98A1A9;">Se o botão não abrir, copie e cole este endereço no navegador:<br><a href="${accessUrl}" style="color:${GOLD_TEXT};word-break:break-all;">${accessUrl}</a></p>
        </td>
      </tr></table>
    </td></tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td align="center" style="padding:20px 24px 8px 24px;font-family:${font};font-size:11px;line-height:17px;color:#8A8F94;">
      Uso interno. Este e-mail foi enviado pelo ORQESTRAI a pedido de Pessoas e Cultura.
    </td></tr>
  </table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;

  const subject = firstName ? `Boas-vindas ao time BP, ${firstName}!` : "Boas-vindas ao time BP!";
  return { subject, html };
}
