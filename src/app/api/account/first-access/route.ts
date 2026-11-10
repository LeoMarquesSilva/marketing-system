import { NextResponse } from "next/server";
import { completeFirstAccess, FirstAccessError, inspectFirstAccess } from "@/lib/first-access-server";

export const dynamic = "force-dynamic";

/** Só consulta o link (não gasta): nome e login para a tela de primeiro acesso. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  try {
    const result = await inspectFirstAccess(token);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[first-access] GET", error);
    return NextResponse.json({ error: "Não foi possível abrir o link agora." }, { status: 500 });
  }
}

/** Cria a senha e gasta o link. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  try {
    const result = await completeFirstAccess(token, password);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FirstAccessError) {
      return NextResponse.json({ error: error.message, reason: error.reason ?? null }, { status: error.status });
    }
    console.error("[first-access] POST", error);
    return NextResponse.json({ error: "Não foi possível criar a senha agora. Tente de novo." }, { status: 500 });
  }
}
