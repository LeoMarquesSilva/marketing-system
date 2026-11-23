import { NextResponse } from "next/server";
import { runDocAction, toDocApiError } from "@/lib/documentario/server";

export const dynamic = "force-dynamic";

/** Todas as alterações do documentário passam por aqui (o servidor confere o acesso de cada ação). */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const result = await runDocAction(body);
    return NextResponse.json(result);
  } catch (error) {
    const apiError = toDocApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
