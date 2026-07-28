import { NextResponse } from "next/server";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import { ProfileHttpError, createProfileAdminClient, toProfileApiError } from "@/lib/profiles/admin";
import { buildImportPayload, buildImportPreview, parseCollaboratorWorkbook } from "@/lib/profiles/import";
import { loadReconciliationContext, readWorkbookFromRequest } from "@/lib/profiles/import-server";
import type { ProfessionalProfileImportResult } from "@/lib/profiles/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const admin = await requireProfessionalProfileAdmin();

    const form = await request.clone().formData().catch(() => null);
    const rawEmails = form?.get("emails");
    const overwrite = String(form?.get("overwrite") ?? "false") === "true";

    let selectedEmails: string[] = [];
    try {
      const parsed = JSON.parse(String(rawEmails ?? "[]"));
      if (Array.isArray(parsed)) selectedEmails = parsed.map((value) => String(value));
    } catch {
      selectedEmails = [];
    }

    if (selectedEmails.length === 0) {
      throw new ProfileHttpError(
        "Selecione ao menos um colaborador para importar.",
        400,
        "PROFILE_INVALID"
      );
    }

    // O arquivo é reprocessado e reconciliado no servidor: o preview que o
    // navegador recebeu é só para revisão humana, nunca fonte de verdade.
    const buffer = await readWorkbookFromRequest(request);
    const rows = parseCollaboratorWorkbook(buffer);
    const { users, profiles } = await loadReconciliationContext();
    const preview = buildImportPreview(rows, users, profiles);

    const payload = buildImportPayload(preview, selectedEmails, overwrite);
    if (payload.length === 0) {
      throw new ProfileHttpError(
        "Nenhuma das linhas selecionadas pode ser importada.",
        400,
        "PROFILE_INVALID"
      );
    }

    const db = createProfileAdminClient();
    const { data, error } = await db.rpc("apply_professional_profile_import", {
      p_rows: payload,
      p_actor_id: admin.userId,
    });

    if (error) {
      throw new ProfileHttpError(
        "Não foi possível concluir a importação.",
        500,
        "PROFILE_IMPORT_FAILED"
      );
    }

    const result = (data ?? {}) as Partial<ProfessionalProfileImportResult>;
    return NextResponse.json({
      created: result.created ?? 0,
      updated: result.updated ?? 0,
      skipped: result.skipped ?? 0,
      unmatched: result.unmatched ?? 0,
    });
  } catch (error) {
    const apiError = toProfileApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
