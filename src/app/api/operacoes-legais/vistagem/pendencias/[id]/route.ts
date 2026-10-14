import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { resolverPendencia } from "@/lib/vistagem/server";
import type { ResolucaoPendencia } from "@/lib/vistagem/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim().slice(0, 200) : undefined;
}

/** Resolve a pendência: pasta escolhida (CI) e/ou escritório, grupo e demanda de risco. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const authUserId = await exigirAcessoVistagem();
    const { id } = await context.params;
    const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const entrada: ResolucaoPendencia = {
      ci: texto(corpo?.ci),
      escritorio: texto(corpo?.escritorio),
      grupo: texto(corpo?.grupo),
      demandaRisco: typeof corpo?.demandaRisco === "boolean" ? corpo.demandaRisco : undefined,
    };
    return NextResponse.json({ publicacao: await resolverPendencia(id, entrada, authUserId) });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível resolver a pendência.");
  }
}
