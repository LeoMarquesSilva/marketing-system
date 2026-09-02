import "server-only";

import { createClient } from "@/utils/supabase/server";
import { getAdminClient } from "@/lib/email-marketing-server";
import {
  hasOperacoesLegaisAccess,
  type OperacoesLegaisAccessProfile,
} from "@/lib/operacoes-legais/access";

export class OperacoesLegaisHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = "OperacoesLegaisHttpError";
  }
}

export function toOperacoesLegaisApiError(error: unknown): {
  status: number;
  body: { error: string; code: string };
} {
  if (error instanceof OperacoesLegaisHttpError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  const message = error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
  return { status: 500, body: { error: message, code: "INTERNAL_ERROR" } };
}

export async function requireOperacoesLegaisAccess(): Promise<OperacoesLegaisAccessProfile & { id: string }> {
  const ssr = await createClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) {
    throw new OperacoesLegaisHttpError("Não autenticado.", 401, "UNAUTHENTICATED");
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, role, permissions, department")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (error) {
    throw new OperacoesLegaisHttpError(
      "Não foi possível validar o acesso.",
      500,
      "ACCESS_LOOKUP_FAILED"
    );
  }
  if (!data) {
    throw new OperacoesLegaisHttpError(
      "Você não tem acesso ao módulo de Operações Legais.",
      403,
      "FORBIDDEN"
    );
  }

  const profile = {
    id: data.id as string,
    role: (data.role as string | null) ?? null,
    department: (data.department as string | null) ?? null,
    permissions: (data.permissions as string[] | null) ?? null,
  };
  if (!hasOperacoesLegaisAccess(profile)) {
    throw new OperacoesLegaisHttpError(
      "Você não tem acesso ao módulo de Operações Legais.",
      403,
      "FORBIDDEN"
    );
  }
  return profile;
}
