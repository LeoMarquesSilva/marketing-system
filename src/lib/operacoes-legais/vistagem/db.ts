import "server-only";

import { getAdminClient } from "@/lib/email-marketing-server";
import {
  OperacoesLegaisHttpError,
  requireOperacoesLegaisAccess,
} from "@/lib/operacoes-legais/server";

export async function requireVistagemAccess() {
  const actor = await requireOperacoesLegaisAccess();
  return { actor, supabase: getAdminClient() };
}

export { OperacoesLegaisHttpError };
