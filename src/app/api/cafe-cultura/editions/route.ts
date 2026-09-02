import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireCafeCulturaAccess } from "@/lib/api-auth";
import {
  CafeCulturaError,
  listCafeAdminEditions,
} from "@/lib/cafe-cultura/server";

export async function GET() {
  try {
    const authUser = await requireAuthenticatedUser();
    await requireCafeCulturaAccess(authUser.id);
    return NextResponse.json({ editions: await listCafeAdminEditions() });
  } catch (error) {
    if (error instanceof CafeCulturaError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    const message = error instanceof Error ? error.message : "";
    const status = /não autenticado/i.test(message)
      ? 401
      : /administrador|café com cultura/i.test(message)
        ? 403
        : 500;
    return NextResponse.json(
      {
        error:
          status === 500
            ? "Não foi possível carregar as edições do Café com Cultura."
            : message,
      },
      { status }
    );
  }
}
