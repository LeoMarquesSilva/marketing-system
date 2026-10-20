import { NextResponse } from "next/server";
import { isBrazilUf } from "@/lib/rh/registration/format";
import { titleCaseCity } from "@/lib/rh/registration/municipios";

/** Municípios mudam raramente: cache de 30 dias. */
export const revalidate = 2592000;

const ONE_MONTH = 2592000;

async function fetchIbge(uf: string): Promise<string[] | null> {
  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`,
    { next: { revalidate: ONE_MONTH } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { nome?: string }[];
  const names = data.map((item) => item.nome ?? "").filter(Boolean);
  return names.length ? names : null;
}

/** Reserva: a BrasilAPI devolve os nomes em caixa alta. */
async function fetchBrasilApi(uf: string): Promise<string[] | null> {
  const res = await fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`, {
    next: { revalidate: ONE_MONTH },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { nome?: string }[];
  const names = data.map((item) => titleCaseCity(item.nome ?? "")).filter(Boolean);
  return names.length ? names : null;
}

/** Lista de municípios da UF (IBGE), para a pessoa escolher em vez de digitar. */
export async function GET(_request: Request, context: { params: Promise<{ uf: string }> }) {
  const { uf: raw } = await context.params;
  const uf = raw.toUpperCase();
  if (!isBrazilUf(uf)) return NextResponse.json({ error: "UF inválida" }, { status: 400 });

  let cities: string[] | null = null;
  try {
    cities = await fetchIbge(uf);
  } catch {
    cities = null;
  }
  if (!cities) {
    try {
      cities = await fetchBrasilApi(uf);
    } catch {
      cities = null;
    }
  }
  if (!cities) {
    return NextResponse.json({ error: "Não foi possível carregar os municípios." }, { status: 502 });
  }

  cities.sort((a, b) => a.localeCompare(b, "pt-BR"));
  return NextResponse.json(
    { uf, cities },
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400" } }
  );
}
