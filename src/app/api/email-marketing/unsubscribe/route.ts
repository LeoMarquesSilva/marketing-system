import { NextResponse } from "next/server";
import { unsubscribeContactByToken } from "@/lib/email-marketing-server";

export const dynamic = "force-dynamic";

function htmlPage(title: string, message: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial, Helvetica, sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
    <div style="background:#ffffff;padding:40px;border-radius:12px;max-width:420px;text-align:center;box-shadow:0 2px 20px rgba(0,0,0,0.08);">
      <h1 style="font-size:18px;color:#101f2e;margin:0 0 12px;">${title}</h1>
      <p style="font-size:14px;color:#4b5563;line-height:1.5;margin:0;">${message}</p>
    </div>
  </body>
</html>`;
}

/** Descadastro público (sem autenticação) — link enviado no rodapé dos e-mails. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token || token === "teste") {
    return new NextResponse(
      htmlPage(
        token === "teste" ? "Link de teste" : "Link inválido",
        token === "teste"
          ? "Este é um envio de teste — nenhuma ação foi necessária."
          : "Não foi possível identificar seu cadastro. O link pode estar incompleto."
      ),
      { status: token === "teste" ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const result = await unsubscribeContactByToken(token);

  if (!result) {
    return new NextResponse(
      htmlPage("Link inválido", "Não encontramos um cadastro correspondente a este link."),
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return new NextResponse(
    htmlPage(
      "Descadastro confirmado",
      `O e-mail ${result.email} não receberá mais nossas newsletters e comunicados. Se mudar de ideia, é só entrar em contato com a gente.`
    ),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

/** Suporte a descadastro one-click (List-Unsubscribe-Post) via POST. */
export async function POST(request: Request) {
  return GET(request);
}
