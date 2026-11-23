import { NextResponse } from "next/server";
import { unsubscribeContactByToken } from "@/lib/email-marketing-server";

export const dynamic = "force-dynamic";

const FONT = "'Century Gothic',CenturyGothic,AppleGothic,Arial,sans-serif";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function htmlPage(title: string, message: string, action?: { token: string }) {
  const form = action
    ? `<form method="post" action="?token=${encodeURIComponent(action.token)}" style="margin:24px 0 0;">
        <button type="submit" style="font-family:${FONT};font-size:15px;font-weight:bold;color:#FCF9F5;background:#0D1E2E;border:0;border-radius:6px;padding:14px 28px;cursor:pointer;">Confirmar descadastro</button>
      </form>`
    : "";
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${title} · Bismarchi | Pires</title>
  </head>
  <body style="margin:0;padding:24px;background-color:#EFE8DD;font-family:${FONT};display:flex;align-items:center;justify-content:center;min-height:100vh;box-sizing:border-box;">
    <div style="background:#FCF9F5;padding:40px 32px;max-width:440px;width:100%;text-align:center;border-radius:8px;">
      <p style="margin:0 0 20px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#9C7434;">Bismarchi | Pires</p>
      <h1 style="font-size:20px;color:#0D1E2E;margin:0 0 12px;">${title}</h1>
      <p style="font-size:15px;color:#212529;line-height:1.6;margin:0;">${message}</p>
      ${form}
    </div>
  </body>
</html>`;
}

const html = (body: string, status = 200) =>
  new NextResponse(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

/**
 * Descadastro público (sem login), link do rodapé dos e-mails.
 * GET só mostra a confirmação: os filtros de segurança de e-mail corporativo abrem os links
 * sozinhos para checar, e um GET que descadastra tiraria clientes da base sem eles pedirem.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (token === "teste") {
    return html(htmlPage("Link de teste", "Este é um envio de teste; nenhuma ação é necessária."));
  }
  if (!token) {
    return html(htmlPage("Link inválido", "Não foi possível identificar seu cadastro. O link pode estar incompleto."), 400);
  }
  return html(
    htmlPage(
      "Deixar de receber nossos e-mails?",
      "Ao confirmar, você não recebe mais comunicados e conteúdos do Bismarchi | Pires neste endereço.",
      { token }
    )
  );
}

/** Confirma o descadastro (botão da página e o descadastro de um clique do Gmail/Outlook). */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || token === "teste") {
    return html(htmlPage("Link de teste", "Este é um envio de teste; nenhuma ação é necessária."));
  }
  const result = await unsubscribeContactByToken(token);
  if (!result) {
    return html(htmlPage("Link inválido", "Não encontramos um cadastro correspondente a este link."), 404);
  }
  return html(
    htmlPage(
      "Descadastro confirmado",
      `O e-mail ${escapeHtml(result.email)} não receberá mais nossos comunicados. Se mudar de ideia, é só falar com a gente.`
    )
  );
}
