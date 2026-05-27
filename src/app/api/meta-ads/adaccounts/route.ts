import { NextResponse } from "next/server";
import {
  fetchAdAccounts,
  getConfiguredAdAccountId,
  verifyAdsToken,
} from "@/lib/meta-ads";
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** Lista contas de anúncios disponíveis (útil para configurar META_AD_ACCOUNT_ID). */
export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    await requireAdminUser(user.id);

    const tokenStatus = await verifyAdsToken();
    const accounts = tokenStatus.hasAdsRead ? await fetchAdAccounts() : [];
    return NextResponse.json({
      configuredAccountId: getConfiguredAdAccountId(),
      tokenStatus,
      accounts,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Não autenticado.") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (
      err instanceof Error &&
      err.message === "Apenas administradores podem executar esta ação."
    ) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const msg =
      err instanceof Error ? err.message : "Erro ao listar contas de anúncios.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
