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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inclusiveDayCount, LEAVE_KIND_LABEL } from "@/lib/ferias/balance";
import {
  isVacationCreditKind,
  type VacationLeave,
  type VacationLeaveKind,
} from "@/lib/ferias/types";

export interface LeaveFormValues {
  startDate: string;
  endDate: string;
  days: number;
  kind: VacationLeaveKind;
  notes: string;
}

interface CreditPreset {
  kind: VacationLeaveKind;
  /** Intervalo do lançamento de origem (recesso/férias). */
  rangeStart: string;
  rangeEnd: string;
  sourceLabel: string;
}

interface RegistrarFeriasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  leave: VacationLeave | null;
  /** Tipo pré-selecionado ao abrir um lançamento novo. */
  defaultKind?: VacationLeaveKind;
  /** Crédito a partir de um lançamento de recesso/férias. */
  creditPreset?: CreditPreset | null;
  onSubmit: (values: LeaveFormValues) => Promise<string | null>;
}

export function RegistrarFeriasDialog({
  open,
  onOpenChange,
  employeeName,
  leave,
  defaultKind = "ferias",
  creditPreset = null,
  onSubmit,
}: RegistrarFeriasDialogProps) {
  const kindForNew = leave?.kind ?? creditPreset?.kind ?? defaultKind;
  const isCredit = isVacationCreditKind(kindForNew);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {leave
              ? "Editar lançamento"
              : isCredit
                ? LEAVE_KIND_LABEL[kindForNew]
                : "Registrar lançamento"}
          </DialogTitle>
          <DialogDescription>
            {employeeName}.{" "}
            {creditPreset
              ? `Crédito referente a ${creditPreset.sourceLabel}. Informe o(s) dia(s) trabalhados nesse período.`
              : isCredit
                ? "Esse lançamento credita dias de volta no saldo de férias."
                : "Os dias são abatidos do período aquisitivo mais antigo com saldo."}
          </DialogDescription>
        </DialogHeader>
        {/* Remontar por lançamento evita arrastar o estado do formulário anterior. */}
        {open && (
          <LeaveForm
            key={`${leave?.id ?? "novo"}-${creditPreset?.kind ?? defaultKind}-${creditPreset?.rangeStart ?? ""}`}
            leave={leave}
            defaultKind={kindForNew}
            creditPreset={creditPreset}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            onSaved={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LeaveForm({
  leave,
  defaultKind,
  creditPreset,
  onSubmit,
  onCancel,
  onSaved,
}: {
  leave: VacationLeave | null;
  defaultKind: VacationLeaveKind;
  creditPreset: CreditPreset | null;
  onSubmit: (values: LeaveFormValues) => Promise<string | null>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [startDate, setStartDate] = useState(
    leave?.start_date ?? creditPreset?.rangeStart ?? ""
  );
  const [endDate, setEndDate] = useState(
    leave?.end_date ?? creditPreset?.rangeStart ?? ""
  );
  // Só existe quando o RH digita um total diferente do intervalo escolhido.
  const [daysOverride, setDaysOverride] = useState<string | null>(
    leave ? String(leave.days) : creditPreset ? "1" : null
  );
  const [kind, setKind] = useState<VacationLeaveKind>(leave?.kind ?? defaultKind);
  const [notes, setNotes] = useState(
    leave?.notes ??
      (creditPreset
        ? `Dia trabalhado em ${creditPreset.sourceLabel}`
        : "")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCredit = isVacationCreditKind(kind);

  const suggestedDays =
    startDate && endDate && endDate >= startDate ? inclusiveDayCount(startDate, endDate) : null;
  const days = daysOverride ?? (suggestedDays === null ? "" : String(suggestedDays));

  async function handleSubmit() {
    const parsedDays = Number(days);
    if (!startDate || !endDate) {
      setError(isCredit ? "Informe a data do dia trabalhado." : "Informe o período de férias.");
      return;
    }
    if (endDate < startDate) {
      setError("A data de retorno não pode ser anterior à data de início.");
      return;
    }
    if (
      creditPreset &&
      (startDate < creditPreset.rangeStart || endDate > creditPreset.rangeEnd)
    ) {
      setError(
        `Informe datas dentro do período (${creditPreset.rangeStart} a ${creditPreset.rangeEnd}).`
      );
      return;
    }
    if (!Number.isInteger(parsedDays) || parsedDays < 1) {
      setError(isCredit ? "Informe a quantidade de dias creditados." : "Informe a quantidade de dias gozados.");
      return;
    }
    setSaving(true);
    const result = await onSubmit({
      startDate,
      endDate,
      days: parsedDays,
      kind,
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
          <Label htmlFor="leave-inicio">Início</Label>
          <DatePickerField id="leave-inicio" value={startDate} onChange={setStartDate} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="leave-fim">Retorno</Label>
          <DatePickerField id="leave-fim" value={endDate} onChange={setEndDate} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="leave-dias">{isCredit ? "Dias creditados" : "Dias gozados"}</Label>
          <Input
            id="leave-dias"
            type="number"
            min={1}
            value={days}
            onChange={(event) => setDaysOverride(event.target.value)}
          />
        </div>
        {!creditPreset && (
          <div className="space-y-1.5">
            <Label htmlFor="leave-tipo">Tipo</Label>
            <Select value={kind} onValueChange={(value) => setKind(value as VacationLeaveKind)}>
              <SelectTrigger id="leave-tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ferias">Férias</SelectItem>
                <SelectItem value="recesso">Recesso</SelectItem>
                <SelectItem value="abono">Abono</SelectItem>
                <SelectItem value="trabalho_recesso">Dia trabalhado no recesso</SelectItem>
                <SelectItem value="trabalho_ferias">Dia trabalhado nas férias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {creditPreset && (
          <div className="space-y-1.5 sm:col-span-2">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Tipo: <strong>{LEAVE_KIND_LABEL[kind]}</strong> · período de referência{" "}
              {creditPreset.rangeStart.split("-").reverse().join("/")} a{" "}
              {creditPreset.rangeEnd.split("-").reverse().join("/")}
            </p>
          </div>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="leave-obs">Observação</Label>
          <Textarea
            id="leave-obs"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex.: recesso coletivo, retorno antecipado…"
            rows={3}
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
