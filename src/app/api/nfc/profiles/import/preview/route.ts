import { NextResponse } from "next/server";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import { ProfileHttpError, toProfileApiError } from "@/lib/profiles/admin";
import { buildImportPreview, parseCollaboratorWorkbook } from "@/lib/profiles/import";
import { loadReconciliationContext, readWorkbookFromRequest } from "@/lib/profiles/import-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireProfessionalProfileAdmin();

    const buffer = await readWorkbookFromRequest(request);
    const rows = parseCollaboratorWorkbook(buffer);
    if (rows.length === 0) {
      throw new ProfileHttpError(
        "Não encontramos linhas de colaborador na planilha.",
        400,
        "PROFILE_INVALID"
      );
    }

    const { users, profiles } = await loadReconciliationContext();
    const preview = buildImportPreview(rows, users, profiles);

    // `sourceRows` fica no servidor: carrega telefone e admissão, que não
    // precisam trafegar para o navegador só para revisar a importação.
    return NextResponse.json({ rows: preview.rows, counts: preview.counts });
  } catch (error) {
    const apiError = toProfileApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
