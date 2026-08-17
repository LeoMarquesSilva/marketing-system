import { NextResponse } from "next/server";
import { onlyDigits } from "@/lib/masks-br";

export const revalidate = 86400;

type CepResult = {
  street: string;
  district: string;
  city: string;
  state: string;
};

async function fetchViaCep(cep: string): Promise<CepResult | null> {
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    erro?: boolean;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (data.erro) return null;
  return {
    street: data.logradouro ?? "",
    district: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
  };
}

async function fetchBrasilApi(cep: string): Promise<CepResult | null> {
  const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    street?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
  return {
    street: data.street ?? "",
    district: data.neighborhood ?? "",
    city: data.city ?? "",
    state: data.state ?? "",
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ cep: string }> }
) {
  const { cep: raw } = await context.params;
  const cep = onlyDigits(raw);
  if (cep.length !== 8) {
    return NextResponse.json({ error: "CEP inválido" }, { status: 400 });
  }

  try {
    const result = (await fetchViaCep(cep)) ?? (await fetchBrasilApi(cep));
    if (!result) {
      return NextResponse.json({ error: "CEP não encontrado" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Falha ao consultar CEP" }, { status: 502 });
  }
}
