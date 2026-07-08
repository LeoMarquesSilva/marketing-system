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
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { DialogHeaderIcon, DialogSectionHeading } from "@/components/eventos/dialog-section-heading";
import type {
  ClientGroupGestorStatus,
  InativoEncerramentoTipo,
} from "@/lib/client-group-gestor-status";
import type { ClientGroupBucket } from "./meus-clientes-ui";

interface GroupStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ClientGroupBucket | null;
  gestorStatus?: ClientGroupGestorStatus | null;
  onSaved: (clientGroupId: string, status: ClientGroupGestorStatus) => void;
}

export function GroupStatusDialog({
  open,
  onOpenChange,
  group,
  gestorStatus,
  onSaved,
}: GroupStatusDialogProps) {
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [encerramentoTipo, setEncerramentoTipo] = useState<InativoEncerramentoTipo | null>(null);
  const [vigenciaTermino, setVigenciaTermino] = useState("");
  const [rescisaoData, setRescisaoData] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !group) return;
    if (gestorStatus?.gestorAtividade === "ativo") {
      setIsActive(true);
      setEncerramentoTipo(null);
      setVigenciaTermino("");
      setRescisaoData("");
    } else if (gestorStatus?.gestorAtividade === "inativo") {
      setIsActive(false);
      setEncerramentoTipo(gestorStatus.inativoEncerramentoTipo);
      setVigenciaTermino(gestorStatus.contratoVigenciaTermino ?? "");
      setRescisaoData(gestorStatus.rescisaoContratualData ?? "");
    } else {
      setIsActive(null);
      setEncerramentoTipo(null);
      setVigenciaTermino("");
      setRescisaoData("");
    }
    setError(null);
  }, [open, group, gestorStatus]);

  if (!group?.clientGroupId) return null;

  const handleSave = async () => {
    if (isActive === null) {
      setError("Selecione se o grupo está ativo ou inativo.");
      return;
    }
    if (!isActive && !encerramentoTipo) {
      setError("Selecione término da vigência ou rescisão contratual.");
      return;
    }
    if (!isActive && encerramentoTipo === "termino_vigencia" && !vigenciaTermino.trim()) {
      setError("Informe a data do término da vigência (dd/mm/aaaa).");
      return;
    }
    if (!isActive && encerramentoTipo === "rescisao_contratual" && !rescisaoData.trim()) {
      setError("Informe a data da rescisão contratual (dd/mm/aaaa).");
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
                Escolha uma das opções abaixo e informe a data correspondente.
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
                  <Label htmlFor="vigencia-termino">Data do término da vigência</Label>
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
