import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { applyFeedzImport, latestFeedzImport } from "@/lib/rh/boas-praticas/server";

export const dynamic = "force-dynamic";

/** Última importação do relatório do Feedz. */
export async function GET() {
  try {
    return NextResponse.json({ log: await latestFeedzImport() });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

/** Aplica as linhas confirmadas na prévia (o arquivo é lido no navegador). */
export async function POST(request: Request) {
  try {
    return NextResponse.json(await applyFeedzImport(await request.json()));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
