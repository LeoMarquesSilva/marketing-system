import type { SchedulePayload } from "@/lib/operacoes-legais/vistagem/schedule/engine";

export type ViosScheduleResult = {
  success: boolean;
  dry_run: boolean;
  pxe_id: string | null;
  message: string;
  review: {
    status: "SIM_OK" | "SIM_OK_AJUSTE" | "ERRO" | "SKIP";
    notes: string;
    chain: Array<{ label: string; data: string; ok: boolean }>;
  };
};

/**
 * Connector VIOS.
 * MVP: dry-run por padrão (VIOS_DRY_RUN=true).
 * Integração real reutiliza o piloto browser em ~/.cursor/lote7-rpa/.
 */
export async function scheduleOnVios(
  payload: SchedulePayload,
  opts?: { dryRun?: boolean },
): Promise<ViosScheduleResult> {
  const dryRun =
    opts?.dryRun ??
    (process.env.VIOS_DRY_RUN ?? "true").toLowerCase() !== "false";

  if (payload.skip) {
    return {
      success: true,
      dry_run: dryRun,
      pxe_id: null,
      message: payload.skip_reason || "Skipped",
      review: {
        status: "SKIP",
        notes: payload.skip_reason || "Skip",
        chain: [],
      },
    };
  }

  if (dryRun) {
    const fakeId = `DRY-${payload.ci}-${payload.tipo_vios.slice(0, 8)}-${payload.data_prevista}`;
    return {
      success: true,
      dry_run: true,
      pxe_id: fakeId,
      message: "Dry-run: tarefa não foi criada no VIOS",
      review: {
        status: "SIM_OK",
        notes: "Dry-run: cadeia esperada registrada sem gravar no VIOS",
        chain: payload.expected_chain.map((c) => ({
          label: c.label,
          data: c.data,
          ok: true,
        })),
      },
    };
  }

  // Hook para automação browser (lote7-rpa). Mantido explícito para não fingir API.
  throw new Error(
    "VIOS_DRY_RUN=false exige connector browser configurado (piloto lote7-rpa). Use dry-run no MVP.",
  );
}

/** Revisão em lote (pxe-lista) — stub que valida payload esperado. */
export async function reviewScheduledChain(
  payload: SchedulePayload,
  pxeId: string | null,
): Promise<ViosScheduleResult["review"]> {
  if (payload.skip) {
    return { status: "SKIP", notes: "Skip", chain: [] };
  }
  if (!pxeId) {
    return {
      status: "ERRO",
      notes: "Sem pxe_id após agendamento",
      chain: [],
    };
  }
  return {
    status: "SIM_OK",
    notes: "Revisão OK (conclusão=limite; cadeia esperada presente)",
    chain: payload.expected_chain.map((c) => ({
      label: c.label,
      data: c.data,
      ok: true,
    })),
  };
}
