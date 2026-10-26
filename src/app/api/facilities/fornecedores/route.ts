import { facilitiesResponse } from "@/lib/facilities/api";
import { createSupplier, listSuppliers } from "@/lib/facilities/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return facilitiesResponse(async () => ({ items: await listSuppliers() }));
}

export async function POST(request: Request) {
  return facilitiesResponse(async () => ({ supplier: await createSupplier(await request.json()) }));
}
