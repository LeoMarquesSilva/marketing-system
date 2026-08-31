"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Circle, Loader2, Scale } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { DialogHeaderIcon, DialogSectionHeading } from "@/components/eventos/dialog-section-heading";
import type {
  ClientGroupGestorStatus,
  InativoEncerramentoTipo,
} from "@/lib/client-group-gestor-status";
import { formatFaturamentoIndicios } from "@/lib/client-group-gestor-status";
import type { SioeClienteAtividade } from "@/lib/sioe-cliente-atividade";
import type { ClientGroupBucket } from "./meus-clientes-ui";

interface GroupStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ClientGroupBucket | null;
  gestorStatus?: ClientGroupGestorStatus | null;
  sioeAtividadeIndicio?: SioeClienteAtividade | null;
  categoriaAtividadeIndicio?: SioeClienteAtividade | null;
  ultimoFaturamentoDate?: string | null;
  proximoPrevistoDate?: string | null;
  previstoDate?: string | null;
  onSaved: (clientGroupId: string, status: ClientGroupGestorStatus) => void;
}

export function GroupStatusDialog({
  open,
  onOpenChange,
  group,
  gestorStatus,
  sioeAtividadeIndicio,
  categoriaAtividadeIndicio,
  ultimoFaturamentoDate,
  proximoPrevistoDate,
  previstoDate,
  onSaved,
}: GroupStatusDialogProps) {
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [encerramentoTipo, setEncerramentoTipo] = useState<InativoEncerramentoTipo | null>(null);
  const [vigenciaTermino, setVigenciaTermino] = useState("");
  const [rescisaoData, setRescisaoData] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupId = group?.clientGroupId ?? null;
  const savedAtividade = gestorStatus?.gestorAtividade ?? null;
  const savedEncerramento = gestorStatus?.inativoEncerramentoTipo ?? null;
  const savedVigencia = gestorStatus?.contratoVigenciaTermino ?? "";
  const savedRescisao = gestorStatus?.rescisaoContratualData ?? "";

  useEffect(() => {
    if (!open) return;
    if (savedAtividade === "ativo") {
      setIsActive(true);
      setEncerramentoTipo(null);
      setVigenciaTermino("");
      setRescisaoData("");
    } else if (savedAtividade === "inativo") {
      setIsActive(false);
      setEncerramentoTipo(savedEncerramento);
      setVigenciaTermino(savedVigencia);
      setRescisaoData(savedRescisao);
    } else {
      setIsActive(null);
      setEncerramentoTipo(null);
      setVigenciaTermino("");
      setRescisaoData("");
    }
    setError(null);
  }, [open, groupId, savedAtividade, savedEncerramento, savedVigencia, savedRescisao]);

  if (!group?.clientGroupId) return null;
  const hasIndicio = Boolean(
    sioeAtividadeIndicio ||
      categoriaAtividadeIndicio ||
      previstoDate ||
      ultimoFaturamentoDate ||
      proximoPrevistoDate
  );
  const categoriaAtivo = categoriaAtividadeIndicio === "ativo";
  const categoriaInativo = categoriaAtividadeIndicio === "inativo";
  const indicioAtivo =
    sioeAtividadeIndicio === "ativo" ||
    (!sioeAtividadeIndicio && (categoriaAtivo || Boolean(previstoDate)));
  const hasFaturamentoIndicio = Boolean(ultimoFaturamentoDate || proximoPrevistoDate);
  const activeWithoutBilling = categoriaAtivo && !hasFaturamentoIndicio;
  const inactiveWithBilling = categoriaInativo && hasFaturamentoIndicio;
  const faturamentoIndicioText = formatFaturamentoIndicios(
    ultimoFaturamentoDate,
    proximoPrevistoDate
  );
  const indicioPanelClass = activeWithoutBilling
    ? "border-amber-200 bg-amber-50 text-amber-950"
    : indicioAtivo
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-red-200 bg-red-50 text-red-900";
  const indicioBadgeClass = activeWithoutBilling
    ? "border-amber-300 bg-white/60 text-amber-800"
    : indicioAtivo
      ? "border-emerald-300 bg-white/60 text-emerald-800"
      : "border-red-300 bg-white/60 text-red-800";
  const indicioBadgeLabel = activeWithoutBilling
    ? "Cliente sem faturamento no último mês"
    : `Indício geral: ${indicioAtivo ? "ativo" : "inativo"}`;
  const indicioHelperText = activeWithoutBilling
    ? "Cadastro ativo, mas não há faturamento localizado no mês anterior nem previsão para os próximos meses."
    : inactiveWithBilling
      ? "Cadastro inativo, mas existe indício de faturamento."
      : "Use os sinais abaixo para definir o status final.";

  const handleSave = async () => {
    if (isActive === null) {
      setError("Selecione se o grupo está ativo ou inativo.");
      return;
    }
    if (!isActive && !encerramentoTipo) {
      setError("Selecione término da vigência ou rescisão contratual.");
      return;
    }
    if (!isActive && encerramentoTipo === "rescisao_contratual" && !rescisaoData.trim()) {
      setError("Informe a data da rescisão contratual.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/meus-clientes/groups/${group.clientGroupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gestorAtividade: isActive ? "ativo" : "inativo",
          inativoEncerramentoTipo: isActive ? null : encerramentoTipo,
          contratoVigenciaTermino:
            !isActive && encerramentoTipo === "termino_vigencia" ? vigenciaTermino.trim() : null,
          rescisaoContratualData:
            !isActive && encerramentoTipo === "rescisao_contratual" ? rescisaoData.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar.");

      onSaved(group.clientGroupId!, data.status);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar status do grupo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,620px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="shrink-0 border-b bg-gradient-to-br from-violet-500/10 via-background to-background px-4 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
          <DialogHeader className="space-y-2 text-left sm:space-y-3">
            <div className="flex items-start gap-3">
              <DialogHeaderIcon icon={Building2} />
              <div className="min-w-0 flex-1 space-y-1">
                <DialogTitle className="text-base sm:text-lg">Status do grupo</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Informe se <span className="font-medium text-foreground">{group.name}</span>{" "}
                  está ativo ou inativo.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-3">
            <DialogSectionHeading icon={Building2}>Situação comercial</DialogSectionHeading>
            {hasIndicio && (
              <div
                className={`rounded-xl border px-3 py-2.5 text-sm ${indicioPanelClass}`}
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={indicioBadgeClass}
                    >
                      {indicioBadgeLabel}
                    </Badge>
                    <span className="text-xs opacity-80">
                      {indicioHelperText}
                    </span>
                  </div>
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-lg border border-white/60 bg-white/50 px-2.5 py-2">
                      <p className="font-medium">Cadastro</p>
                      <p
                        className={`mt-1 ${
                          categoriaAtivo
                            ? "text-emerald-800"
                            : categoriaInativo
                              ? "text-red-800"
                              : "opacity-75"
                        }`}
                      >
                        {categoriaAtividadeIndicio
                          ? `Categoria indica cliente ${categoriaAtividadeIndicio}.`
                          : "Sem status cadastral localizado."}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/60 bg-white/50 px-2.5 py-2">
                      <p className="font-medium">Faturamento</p>
                      <p
                        className={`mt-1 ${
                          hasFaturamentoIndicio ? "text-emerald-800" : "opacity-75"
                        }`}
                      >
                        {faturamentoIndicioText}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsActive(true);
                  setEncerramentoTipo(null);
                  setVigenciaTermino("");
                  setRescisaoData("");
                  setError(null);
                }}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                  isActive === true
                    ? "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200"
                    : "border-border/80 bg-background hover:bg-muted/30"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  {isActive === true ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  Ativo
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Cliente com contrato vigente.
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsActive(false);
                  setError(null);
                }}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                  isActive === false
                    ? "border-slate-300 bg-slate-50 ring-1 ring-slate-200"
                    : "border-border/80 bg-background hover:bg-muted/30"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  {isActive === false ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  Inativo
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Contrato encerrado ou sem vigência.
                </span>
              </button>
            </div>
          </div>

          {isActive === false && (
            <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4">
              <DialogSectionHeading icon={Scale}>Motivo do inativo</DialogSectionHeading>
              <p className="text-xs text-muted-foreground">
                Escolha uma das opções abaixo. A data da rescisão é obrigatória.
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setEncerramentoTipo("termino_vigencia");
                    setRescisaoData("");
                    setError(null);
                  }}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    encerramentoTipo === "termino_vigencia"
                      ? "border-violet-300 bg-violet-50 ring-1 ring-violet-200"
                      : "border-border/80 bg-background hover:bg-muted/30"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {encerramentoTipo === "termino_vigencia" ? (
                      <CheckCircle2 className="h-4 w-4 text-violet-700" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    Término da vigência
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEncerramentoTipo("rescisao_contratual");
                    setVigenciaTermino("");
                    setError(null);
                  }}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    encerramentoTipo === "rescisao_contratual"
                      ? "border-violet-300 bg-violet-50 ring-1 ring-violet-200"
                      : "border-border/80 bg-background hover:bg-muted/30"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {encerramentoTipo === "rescisao_contratual" ? (
                      <CheckCircle2 className="h-4 w-4 text-violet-700" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    Rescisão contratual
                  </span>
                </button>
              </div>

              {encerramentoTipo === "termino_vigencia" && (
                <div className="space-y-2">
                  <Label htmlFor="vigencia-termino">Data do término da vigência (opcional)</Label>
                  <DatePickerField
                    id="vigencia-termino"
                    value={vigenciaTermino}
                    onChange={setVigenciaTermino}
                    placeholder="dd/mm/aaaa"
                  />
                </div>
              )}

              {encerramentoTipo === "rescisao_contratual" && (
                <div className="space-y-2">
                  <Label htmlFor="rescisao-data">Data da rescisão contratual</Label>
                  <DatePickerField
                    id="rescisao-data"
                    value={rescisaoData}
                    onChange={setRescisaoData}
                    placeholder="dd/mm/aaaa"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t bg-muted/20 px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando
              </>
            ) : (
              "Salvar status"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
