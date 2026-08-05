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
import { Textarea } from "@/components/ui/textarea";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { inclusiveDayCount } from "@/lib/ferias/balance";
import type { CompanyRecess } from "@/lib/ferias/types";

export interface RecessFormValues {
  year: number;
  startDate: string;
  endDate: string;
  days: number;
  notes: string;
}

interface RecessoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recess: CompanyRecess | null;
  onSubmit: (values: RecessFormValues) => Promise<string | null>;
}

export function RecessoFormDialog({
  open,
  onOpenChange,
  recess,
  onSubmit,
}: RecessoFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{recess ? "Editar recesso coletivo" : "Novo recesso coletivo"}</DialogTitle>
          <DialogDescription>
            Calendário de recesso de fim de ano da empresa. Se o ano já existir, o registro é
            atualizado.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <RecessForm
            key={recess?.id ?? "novo"}
            recess={recess}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            onSaved={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecessForm({
  recess,
  onSubmit,
  onCancel,
  onSaved,
}: {
  recess: CompanyRecess | null;
  onSubmit: (values: RecessFormValues) => Promise<string | null>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [year, setYear] = useState(
    String(recess?.year ?? new Date().getFullYear())
  );
  const [startDate, setStartDate] = useState(recess?.start_date ?? "");
  const [endDate, setEndDate] = useState(recess?.end_date ?? "");
  const [daysOverride, setDaysOverride] = useState<string | null>(
    recess ? String(recess.days) : null
  );
  const [notes, setNotes] = useState(recess?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedDays =
    startDate && endDate && endDate >= startDate ? inclusiveDayCount(startDate, endDate) : null;
  const days = daysOverride ?? (suggestedDays === null ? "" : String(suggestedDays));

  async function handleSubmit() {
    const parsedYear = Number(year);
    const parsedDays = Number(days);
    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      setError("Informe um ano válido.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Informe o período do recesso.");
      return;
    }
    if (endDate < startDate) {
      setError("A data de retorno não pode ser anterior à data de início.");
      return;
    }
    if (!Number.isInteger(parsedDays) || parsedDays < 1) {
      setError("Informe a quantidade de dias.");
      return;
    }
    setSaving(true);
    const result = await onSubmit({
      year: parsedYear,
      startDate,
      endDate,
      days: parsedDays,
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="recess-year">Ano</Label>
          <Input
            id="recess-year"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recess-days">Dias</Label>
          <Input
            id="recess-days"
            type="number"
            min={1}
            value={days}
            onChange={(event) => setDaysOverride(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recess-inicio">Início</Label>
          <DatePickerField id="recess-inicio" value={startDate} onChange={setStartDate} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recess-fim">Retorno</Label>
          <DatePickerField id="recess-fim" value={endDate} onChange={setEndDate} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="recess-obs">Observação</Label>
          <Textarea
            id="recess-obs"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex.: recesso coletivo"
            rows={2}
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
