import { NextResponse } from "next/server";
import {
  createNfcAssets,
  listNfcAssetInventory,
  toApiError,
} from "@/lib/nfc/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ data: await listNfcAssetInventory() });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function POST(request: Request) {
  try {
    const result = await createNfcAssets(await request.json());
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
