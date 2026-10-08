import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { syncIcpCnpjs } from "@/lib/icp/cnpj-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron — consulta o cadastro da Receita (OpenCNPJ/BrasilAPI) dos CNPJs dos grupos de clientes (ICP). */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const limit = Number(new URL(request.url).searchParams.get("limit")) || undefined;

  try {
    const result = await syncIcpCnpjs({ limit });
    return NextResponse.json({ success: true, ...result, finishedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao consultar CNPJs.";
    console.error("[cron/icp-cnpj-sync]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
