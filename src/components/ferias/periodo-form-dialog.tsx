"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatISODateBR } from "@/lib/ferias/balance";
import type { VacationPeriod } from "@/lib/ferias/types";

/** Direitos previstos no art. 130 da CLT (faltas injustificadas no aquisitivo). */
const ENTITLED_OPTIONS = [
  { value: 30, label: "30 dias — até 5 faltas" },
  { value: 24, label: "24 dias — 6 a 14 faltas" },
  { value: 18, label: "18 dias — 15 a 23 faltas" },
  { value: 12, label: "12 dias — 24 a 32 faltas" },
  { value: 0, label: "0 dias — 33 ou mais faltas" },
] as const;

export interface PeriodFormValues {
  entitledDays: number;
  notes: string;
}

interface PeriodoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: VacationPeriod | null;
  onSubmit: (values: PeriodFormValues) => Promise<string | null>;
}

export function PeriodoFormDialog({
  open,
  onOpenChange,
  period,
  onSubmit,
}: PeriodoFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar direito do período</DialogTitle>
          <DialogDescription>
            {period
              ? `Aquisitivo ${formatISODateBR(period.period_start)} a ${formatISODateBR(period.period_end)}. Use o art. 130 da CLT quando houver faltas.`
              : "Selecione um período."}
          </DialogDescription>
        </DialogHeader>
        {open && period && (
          <PeriodoForm
            key={period.id}
            period={period}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            onSaved={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PeriodoForm({
  period,
  onSubmit,
  onCancel,
  onSaved,
}: {
  period: VacationPeriod;
  onSubmit: (values: PeriodFormValues) => Promise<string | null>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const knownOption = ENTITLED_OPTIONS.some((option) => option.value === period.entitled_days);
  const [entitledDays, setEntitledDays] = useState(period.entitled_days);
  const [customMode, setCustomMode] = useState(!knownOption);
  const [notes, setNotes] = useState(period.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (entitledDays < 0 || entitledDays > 30) {
      setError("O direito deve ficar entre 0 e 30 dias.");
      return;
    }
    setSaving(true);
    const result = await onSubmit({
      entitledDays,
      notes: notes.trim(),
    });
    setSaving(false);
    if (result) {
      setError(result);
      return;
    }
    onSaved();
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="period-entitled">Dias de direito</Label>
          {customMode ? (
            <Input
              id="period-entitled"
              type="number"
              min={0}
              max={30}
              value={entitledDays}
              onChange={(event) => setEntitledDays(Number(event.target.value))}
            />
          ) : (
            <Select
              value={String(entitledDays)}
              onValueChange={(value) => {
                if (value === "custom") {
                  setCustomMode(true);
                  return;
                }
                setEntitledDays(Number(value));
              }}
            >
              <SelectTrigger id="period-entitled" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITLED_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Outro valor (0–30)…</SelectItem>
              </SelectContent>
            </Select>
          )}
          {customMode && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => {
                setCustomMode(false);
                const nearest = ENTITLED_OPTIONS.find((option) => option.value === entitledDays);
                if (!nearest) setEntitledDays(30);
              }}
            >
              Voltar às faixas do art. 130
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="period-notes">Observação</Label>
          <Input
            id="period-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex.: 8 faltas no aquisitivo"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
        </Button>
      </DialogFooter>
    </>
  );
}
