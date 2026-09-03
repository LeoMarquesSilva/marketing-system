import {
  resolveClienteAtividade,
  resolveClienteCategoriaAtividade,
  type SioeClienteAtividade,
  type SioeClienteAtividadeIndex,
} from "@/lib/sioe-cliente-atividade";

export type GestorAtividade = "ativo" | "inativo";

/** Motivo do encerramento quando o grupo está inativo (opções distintas). */
export type InativoEncerramentoTipo = "termino_vigencia" | "rescisao_contratual";

export interface ClientGroupGestorStatus {
  gestorAtividade: GestorAtividade | null;
  inativoEncerramentoTipo: InativoEncerramentoTipo | null;
  contratoVigenciaTermino: string | null;
  rescisaoContratualData: string | null;
  confirmedAt: string | null;
  confirmedByUserId: string | null;
}

function parseEncerramentoTipo(value: unknown): InativoEncerramentoTipo | null {
  if (value === "termino_vigencia" || value === "rescisao_contratual") return value;
  return null;
}

export function mapClientGroupGestorStatus(
  row: Record<string, unknown> | null | undefined
): ClientGroupGestorStatus {
  if (!row) {
    return {
      gestorAtividade: null,
      inativoEncerramentoTipo: null,
      contratoVigenciaTermino: null,
      rescisaoContratualData: null,
      confirmedAt: null,
      confirmedByUserId: null,
    };
  }
  const rawAtividade = row.gestor_atividade as string | null | undefined;
  const gestorAtividade =
    rawAtividade === "ativo" || rawAtividade === "inativo" ? rawAtividade : null;

  let inativoEncerramentoTipo = parseEncerramentoTipo(row.inativo_encerramento_tipo);
  if (!inativoEncerramentoTipo && gestorAtividade === "inativo") {
    if (row.contrato_vigencia_termino) inativoEncerramentoTipo = "termino_vigencia";
    else if (row.rescisao_contratual) inativoEncerramentoTipo = "rescisao_contratual";
  }

  return {
    gestorAtividade,
    inativoEncerramentoTipo,
    contratoVigenciaTermino: (row.contrato_vigencia_termino as string | null) ?? null,
    rescisaoContratualData: (row.rescisao_contratual_data as string | null) ?? null,
    confirmedAt: (row.gestor_atividade_confirmed_at as string | null) ?? null,
    confirmedByUserId: (row.gestor_atividade_confirmed_by_user_id as string | null) ?? null,
  };
}

export function isGestorStatusPending(status: ClientGroupGestorStatus | null | undefined): boolean {
  return !status?.gestorAtividade;
}

/** Classificar NPS só depois de confirmar ativo ou inativo. */
export function canEditNpsContactsForGroup(
  status: ClientGroupGestorStatus | null | undefined
): boolean {
  return Boolean(status?.gestorAtividade);
}

/** Prioriza confirmação do gestor; fallback no índice comercial (SIOE). */
export function resolveGroupAtividade(
  group: { name: string; clientGroupId?: string | null },
  gestorStatus: ClientGroupGestorStatus | null | undefined,
  sioeIndex: SioeClienteAtividadeIndex | null | undefined
): SioeClienteAtividade | null {
  if (gestorStatus?.gestorAtividade) return gestorStatus.gestorAtividade;
  if (!sioeIndex) return null;
  return resolveClienteAtividade(sioeIndex, { grupoName: group.name });
}

/** Mesma regra do filtro Status em Meus Clientes: gestor, senão categoria SIOE. */
export function isClientGroupInactiveForOutreach(
  group: { name: string; gestorAtividade?: GestorAtividade | null },
  sioeIndex: SioeClienteAtividadeIndex | null | undefined
): boolean {
  if (group.gestorAtividade === "inativo") return true;
  if (group.gestorAtividade === "ativo") return false;
  if (!sioeIndex) return false;
  return resolveClienteCategoriaAtividade(sioeIndex, { grupoName: group.name }) === "inativo";
}

export function groupAtividadeTooltip(
  status: SioeClienteAtividade | null,
  gestorStatus: ClientGroupGestorStatus | null | undefined,
  mesReferencia?: string,
  previstoDate?: string | null,
  categoriaStatus?: SioeClienteAtividade | null,
  ultimoFaturamentoDate?: string | null,
  proximoPrevistoDate?: string | null
): string | undefined {
  if (!status) return undefined;
  if (gestorStatus?.gestorAtividade) {
    if (status === "inativo") {
      const parts = ["Inativo (confirmado pelo gestor)"];
      if (
        gestorStatus.inativoEncerramentoTipo === "termino_vigencia" &&
        gestorStatus.contratoVigenciaTermino
      ) {
        parts.push(
          `Término da vigência: ${formatDateBr(gestorStatus.contratoVigenciaTermino)}`
        );
      }
      if (
        gestorStatus.inativoEncerramentoTipo === "rescisao_contratual" &&
        gestorStatus.rescisaoContratualData
      ) {
        parts.push(`Rescisão contratual: ${formatDateBr(gestorStatus.rescisaoContratualData)}`);
      }
      return parts.join(" · ");
    }
    return "Ativo (confirmado pelo gestor)";
  }
  const [year, month] = (mesReferencia ?? "").split("-");
  const mesLabel = month && year ? `${month}/${year}` : mesReferencia;
  const faturamentoText = formatFaturamentoIndicios(
    ultimoFaturamentoDate,
    proximoPrevistoDate,
    mesLabel
  );
  const hasFaturamento = Boolean(ultimoFaturamentoDate || proximoPrevistoDate || previstoDate);
  if (categoriaStatus === "ativo" && !hasFaturamento) {
    return `Cadastro: ativo. ${faturamentoText} Use os indícios para confirmar o status final antes de salvar.`;
  }
  if (categoriaStatus === "inativo" && hasFaturamento) {
    return `Cadastro: inativo. ${faturamentoText} Verifique a divergência antes de salvar o status final.`;
  }
  const categoriaText = categoriaStatus
    ? `Cadastro: ${categoriaStatus}.`
    : "Cadastro: sem status localizado.";
  return `${categoriaText} ${faturamentoText} Use os indícios para confirmar o status final antes de salvar.`;
}

export function formatFaturamentoIndicios(
  ultimoFaturamentoDate?: string | null,
  proximoPrevistoDate?: string | null,
  mesLabel?: string | null
): string {
  const prefix = "Indícios faturamento:";
  if (ultimoFaturamentoDate && proximoPrevistoDate) {
    return `${prefix} faturamento localizado no mês anterior em ${formatDateBr(ultimoFaturamentoDate)} e faturamento previsto localizado para ${formatDateBr(proximoPrevistoDate)}.`;
  }
  if (ultimoFaturamentoDate) {
    return `${prefix} faturamento localizado no mês anterior em ${formatDateBr(ultimoFaturamentoDate)}.`;
  }
  if (proximoPrevistoDate) {
    return `${prefix} faturamento previsto localizado para ${formatDateBr(proximoPrevistoDate)}.`;
  }
  return `${prefix} nenhum faturamento localizado no mês anterior${
    mesLabel ? ` (${mesLabel})` : ""
  }, e nenhum faturamento previsto localizado para os próximos meses.`;
}

function formatDateBr(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export interface UpdateClientGroupGestorStatusInput {
  gestorAtividade: GestorAtividade;
  inativoEncerramentoTipo?: InativoEncerramentoTipo | null;
  contratoVigenciaTermino?: string | null;
  rescisaoContratualData?: string | null;
}

export function validateClientGroupGestorStatusInput(
  input: UpdateClientGroupGestorStatusInput
): string | null {
  if (input.gestorAtividade === "ativo") return null;

  if (!input.inativoEncerramentoTipo) {
    return "Selecione término da vigência ou rescisão contratual.";
  }

  if (input.inativoEncerramentoTipo === "termino_vigencia") {
    const date = input.contratoVigenciaTermino?.trim();
    if (date && !isIsoDate(date)) return "Data do término da vigência inválida.";
    return null;
  }

  const date = input.rescisaoContratualData?.trim();
  if (!date) return "Informe a data da rescisão contratual.";
  if (!isIsoDate(date)) return "Data da rescisão contratual inválida.";
  return null;
}
