/**
 * Modelos prontos de e-mail + wrapper de marca usado tanto na pré-visualização
 * (client-side) quanto no envio real (server-side, via email-marketing-server.ts).
 * Mantido sem dependências de servidor para poder ser importado por componentes client.
 */

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  html: string;
  /** Abre o editor visual estruturado em vez do textarea HTML. */
  editor?: "newsletter-trabalhista";
}

const BUTTON_STYLE =
  "display:inline-block;background:#101f2e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:8px;font-size:14px;";

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "blank",
    name: "Em branco",
    description: "Comece do zero, sem conteúdo pré-definido.",
    html: `<h2 style="margin:0 0 12px;color:#101f2e;">Título do e-mail</h2>
<p style="margin:0 0 16px;color:#374151;">Escreva aqui o conteúdo do seu e-mail.</p>`,
  },
  {
    id: "newsletter",
    name: "Newsletter simples",
    description: "Título, texto e um botão de destaque.",
    html: `<h2 style="margin:0 0 12px;color:#101f2e;font-size:22px;">Título da newsletter</h2>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">Olá! Aqui vai um resumo das novidades deste mês. Conte um pouco do contexto e do que é mais importante para quem está lendo.</p>
<p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">Você pode adicionar quantos parágrafos quiser, além de listas e imagens.</p>
<p style="margin:0 0 8px;"><a href="https://seusite.com.br" style="${BUTTON_STYLE}">Saiba mais</a></p>`,
  },
  {
    id: "promo",
    name: "Anúncio / Promoção",
    description: "Banner de destaque para uma oferta ou lançamento.",
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="background:#101f2e;border-radius:10px;padding:32px 24px;text-align:center;">
      <p style="margin:0 0 8px;color:#93c5fd;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Novidade</p>
      <h2 style="margin:0 0 12px;color:#ffffff;font-size:24px;">Nome da oferta ou lançamento</h2>
      <p style="margin:0 0 20px;color:#cbd5e1;font-size:14px;line-height:1.6;">Uma frase curta explicando o benefício principal para quem está recebendo este e-mail.</p>
      <a href="https://seusite.com.br" style="display:inline-block;background:#ffffff;color:#101f2e;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:8px;font-size:14px;">Aproveitar agora</a>
    </td>
  </tr>
</table>
<p style="margin:20px 0 0;color:#374151;font-size:14px;line-height:1.6;">Detalhes adicionais, condições ou prazo da oferta podem entrar aqui.</p>`,
  },
  {
    id: "comunicado",
    name: "Comunicado",
    description: "Aviso institucional, direto e formal.",
    html: `<h2 style="margin:0 0 12px;color:#101f2e;font-size:20px;">Comunicado</h2>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">Prezado(a),</p>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">Escreva aqui o corpo do comunicado, com as informações relevantes de forma objetiva.</p>
<p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">Atenciosamente,<br />Equipe</p>`,
  },
  {
    id: "evento",
    name: "Convite para evento",
    description: "Data, local e botão de confirmação.",
    html: `<h2 style="margin:0 0 12px;color:#101f2e;font-size:22px;">Você está convidado(a)!</h2>
<p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">Escreva aqui uma breve descrição do evento e por que vale a pena participar.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;border-radius:8px;margin-bottom:20px;">
  <tr>
    <td style="padding:16px 20px;">
      <p style="margin:0 0 6px;color:#101f2e;font-size:14px;"><strong>Data:</strong> dd/mm/aaaa às hh:mm</p>
      <p style="margin:0 0 6px;color:#101f2e;font-size:14px;"><strong>Local:</strong> endereço ou link do evento online</p>
      <p style="margin:0;color:#101f2e;font-size:14px;"><strong>Duração:</strong> aproximadamente X horas</p>
    </td>
  </tr>
</table>
<p style="margin:0;"><a href="https://seusite.com.br" style="${BUTTON_STYLE}">Confirmar presença</a></p>`,
  },
  {
    id: "boasvindas",
    name: "Boas-vindas",
    description: "Mensagem de boas-vindas para novos contatos.",
    html: `<h2 style="margin:0 0 12px;color:#101f2e;font-size:22px;">Seja bem-vindo(a)!</h2>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">Ficamos felizes em ter você por aqui. A partir de agora, você vai receber nossas novidades e conteúdos direto no seu e-mail.</p>
<p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">Enquanto isso, que tal conhecer mais sobre o nosso trabalho?</p>
<p style="margin:0;"><a href="https://seusite.com.br" style="${BUTTON_STYLE}">Conhecer agora</a></p>`,
  },
  {
    id: "newsletter-trabalhista",
    name: "Newsletter Trabalhista BP",
    description: "Layout oficial da newsletter semanal — capa, 4 notícias, rodapé e redes sociais.",
    html: "",
    editor: "newsletter-trabalhista",
  },
];

/**
 * Preheader oculto — texto que aparece ao lado do assunto na caixa de entrada
 * (Gmail/Outlook/Apple Mail), sem aparecer visualmente no corpo do e-mail.
 */
function buildPreheaderHtml(previewText?: string | null): string {
  const text = previewText?.trim();
  if (!text) return "";
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Espaços invisíveis extras evitam que clientes de e-mail "completem" o preheader
  // com o início do corpo do e-mail.
  const padding = "&nbsp;&zwnj;&nbsp;&zwnj;".repeat(15);
  return `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${safe}${padding}</div>`;
}

function injectPreheader(html: string, previewText?: string | null): string {
  const preheader = buildPreheaderHtml(previewText);
  if (!preheader) return html;
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/(<body[^>]*>)/i, `$1${preheader}`);
  }
  return `${preheader}${html}`;
}

/** Envolve o conteúdo da campanha no template de marca + rodapé com descadastro. */
export function wrapCampaignHtml(
  bodyHtml: string,
  unsubscribeUrl: string,
  previewText?: string | null
): string {
  if (/^\s*<!doctype html/i.test(bodyHtml) || /<html[\s>]/i.test(bodyHtml)) {
    return injectPreheader(bodyHtml.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl), previewText);
  }
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial, Helvetica, sans-serif;">
    ${buildPreheaderHtml(previewText)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
            <tr>
              <td style="padding:28px 32px;color:#101f2e;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background-color:#f4f5f7;text-align:center;font-size:11px;color:#8a8f98;">
                Você está recebendo este e-mail porque faz parte da nossa base de contatos.
                <br />
                <a href="${unsubscribeUrl}" style="color:#8a8f98;text-decoration:underline;">Descadastrar-se desta lista</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Versão para pré-visualização no navegador (link de descadastro fictício). */
export function wrapEmailPreviewHtml(bodyHtml: string, previewText?: string | null): string {
  const stripped = bodyHtml.replace(/^<!-- newsletter-bp:[A-Za-z0-9+/=]+ -->\n?/, "");
  if (/^\s*<!doctype html/i.test(stripped) || /<html[\s>]/i.test(stripped)) {
    return injectPreheader(stripped.replace(/\{\{unsubscribe_url\}\}/g, "#"), previewText);
  }
  return wrapCampaignHtml(
    bodyHtml || "<p style=\"color:#9ca3af;\">Comece a escrever para ver a pré-visualização aqui...</p>",
    "#",
    previewText
  );
}
