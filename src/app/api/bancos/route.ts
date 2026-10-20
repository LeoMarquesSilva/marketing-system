import { NextResponse } from "next/server";
import { normalizeBanks } from "@/lib/rh/registration/bancos";

/** A lista de bancos do Banco Central muda pouco: cache de 30 dias. */
export const revalidate = 2592000;

/** Bancos (código COMPE + nome) para o campo "Banco" da ficha cadastral. */
export async function GET() {
  try {
    const res = await fetch("https://brasilapi.com.br/api/banks/v1", { next: { revalidate: 2592000 } });
    if (!res.ok) throw new Error(`brasilapi ${res.status}`);
    const banks = normalizeBanks((await res.json()) as { code?: number | null; name?: string | null }[]);
    if (banks.length === 0) throw new Error("lista vazia");
    return NextResponse.json(
      { banks },
      { headers: { "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400" } }
    );
  } catch (error) {
    console.error("[bancos]", error);
    return NextResponse.json({ error: "Não foi possível carregar os bancos." }, { status: 502 });
  }
}
