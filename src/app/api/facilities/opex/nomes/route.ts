import { facilitiesResponse } from "@/lib/facilities/api";
import { listOpexNames } from "@/lib/facilities/server";

export const dynamic = "force-dynamic";

/** Nomes de fornecedor do OPEX (12 meses) para ligar ao cadastro. */
export async function GET() {
  return facilitiesResponse(async () => listOpexNames());
}
