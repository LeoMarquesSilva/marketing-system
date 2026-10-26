"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, FileSignature, Loader2, Percent, Sparkles, UserRound } from "lucide-react";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatShortDate, noticeDeadline, todayIso } from "@/lib/facilities/alerts";
import { facilitiesApi, uploadSupplierFile } from "@/lib/facilities/client";
import {
  ADJUSTMENT_INDEX_LABEL,
  CONTRACTING_PARTIES,
  CONTRACT_STATUS_LABEL,
  FORMALIZATION_LABEL,
  MONTH_LABELS,
  VALUE_PERIOD_LABEL,
  type ContractExtraction,
  type ContractInput,
  type FacilitiesPerson,
  type FacilitiesSupplier,
  type SupplierContract,
} from "@/lib/facilities/types";
import { onlyDigits } from "@/lib/masks-br";
import { cn } from "@/lib/utils";
import { Field, FormSection, LabelSelect, NONE, PersonSelect, Segmented, ToggleField } from "./form-parts";

export function emptyContractInput(supplier: FacilitiesSupplier): ContractInput {
  return {
    title: "",
    object: "",
    status: "vigente",
    formalization: "contrato_assinado",
    contracting_party: CONTRACTING_PARTIES[0],
    start_date: "",
    end_date: "",
    auto_renew: false,
    renewal_months: null,
    notice_days: null,
    adjustment_index: "",
    adjustment_month: null,
    value: null,
    value_period: "mensal",
    responsible_user_id: supplier.responsible_user_id,
    sharepoint_url: "",
    notes: "",
  };
}

export function contractToInput(contract: SupplierContract): ContractInput {
  return {
    title: contract.title,
    object: contract.object ?? "",
    status: contract.status,
    formalization: contract.formalization,
    contracting_party: contract.contracting_party ?? "",
    start_date: contract.start_date ?? "",
    end_date: contract.end_date ?? "",
    auto_renew: contract.auto_renew,
    renewal_months: contract.renewal_months,
    notice_days: contract.notice_days,
    adjustment_index: contract.adjustment_index ?? "",
    adjustment_month: contract.adjustment_month,
    value: contract.value,
    value_period: contract.value_period,
    responsible_user_id: contract.responsible_user_id,
    sharepoint_url: contract.sharepoint_url ?? "",
    notes: contract.notes ?? "",
  };
}

/** Só preenche o que a IA achou; o resto fica como a pessoa deixou. */
function applyExtraction(form: ContractInput, found: ContractExtraction): ContractInput {
  return {
    ...form,
    title: found.title ?? form.title,
    object: found.object ?? form.object,
    start_date: found.start_date ?? form.start_date,
    end_date: found.end_date ?? form.end_date,
    auto_renew: found.auto_renew ?? form.auto_renew,
    renewal_months: found.renewal_months ?? form.renewal_months,
    notice_days: found.notice_days ?? form.notice_days,
    adjustment_index: found.adjustment_index ?? form.adjustment_index,
    adjustment_month: found.adjustment_month ?? form.adjustment_month,
    value: found.value ?? form.value,
    value_period: found.value_period ?? form.value_period,
  };
}

function numberField(raw: string, max: number): number | null {
  const digits = onlyDigits(raw).slice(0, 3);
  if (!digits) return null;
  return Math.min(Number(digits), max);
}

export function ContractForm({
  supplier,
  contractId,
  form,
  people,
  onChange,
  onSupplierChange,
  onAttach,
}: {
  supplier: FacilitiesSupplier;
  contractId: string | null;
  form: ContractInput;
  people: FacilitiesPerson[];
  onChange: (form: ContractInput) => void;
  /** O upload devolve o fornecedor atualizado (o arquivo já aparece nos documentos). */
  onSupplierChange: (supplier: FacilitiesSupplier) => void;
  /** Arquivo enviado aqui que deve ficar ligado ao contrato quando ele for salvo. */
  onAttach: (documentId: string) => void;
}) {
  const set = <K extends keyof ContractInput>(key: K, value: ContractInput[K]) => onChange({ ...form, [key]: value });
  const [step, setStep] = useState<"idle" | "upload" | "read">("idle");
  const [aiNote, setAiNote] = useState<{ tone: "ok" | "error"; text: string; summary?: string | null } | null>(null);
  const [dragging, setDragging] = useState(false);
  // A leitura leva alguns segundos; o que a pessoa digitar nesse meio-tempo não pode se perder.
  const latestForm = useRef(form);
  useEffect(() => {
    latestForm.current = form;
  }, [form]);

  async function handleFile(file: File) {
    setAiNote(null);
    setStep("upload");
    try {
      const { supplier: updated, documentId } = await uploadSupplierFile({
        supplierId: supplier.id,
        contractId,
        kind: "contrato",
        title: "",
        validUntil: "",
        file,
      });
      onSupplierChange(updated);
      onAttach(documentId);
      const readable = /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
      if (!readable) {
        setAiNote({ tone: "ok", text: `"${file.name}" anexado. A leitura automática funciona com PDF ou foto; preencha os campos abaixo.` });
        return;
      }
      setStep("read");
      const found = await facilitiesApi.readContract(documentId);
      onChange(applyExtraction(latestForm.current, found));
      const filled = [found.start_date, found.end_date, found.value, found.notice_days, found.adjustment_index].filter(
        (value) => value !== null
      ).length;
      const docMismatch =
        found.supplier_document && supplier.document && found.supplier_document !== supplier.document
          ? " O CNPJ/CPF do contrato é diferente do cadastro — confira se é o fornecedor certo."
          : "";
      setAiNote({
        tone: "ok",
        text:
          (filled
            ? `Li "${file.name}" e preenchi o que encontrei. Confira antes de salvar.`
            : `Anexei "${file.name}", mas não achei datas nem valores no texto. Preencha à mão.`) + docMismatch,
        summary: found.summary,
      });
    } catch (cause) {
      setAiNote({ tone: "error", text: cause instanceof Error ? cause.message : "Não foi possível ler o arquivo." });
    } finally {
      setStep("idle");
    }
  }

  const today = todayIso();
  const deadline = form.end_date
    ? noticeDeadline(
        { end_date: form.end_date, auto_renew: form.auto_renew, renewal_months: form.renewal_months ?? 12, notice_days: form.notice_days },
        today
      )
    : null;
  const busy = step !== "idle";

  return (
    <div>
      <section className="space-y-3 border-b border-[#eef3f5] bg-[#fafcfc] px-6 py-5">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file && !busy) void handleFile(file);
          }}
          className={cn(
            "flex cursor-pointer items-center gap-4 rounded-md border border-dashed bg-white px-4 py-4 transition-colors",
            dragging ? "border-[#47cdd0] bg-[#e8f8f8]" : "border-[#c9dde1] hover:bg-[#f6fafb]",
            busy && "pointer-events-none opacity-80"
          )}
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[#e8f8f8] text-[#285f7a]">
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">
              {step === "upload" ? "Enviando o arquivo…" : step === "read" ? "Lendo o contrato…" : "Enviar o PDF do contrato e preencher com IA"}
            </span>
            <span className="block text-xs text-muted-foreground">
              Arraste ou clique. A IA lê vigência, renovação, aviso prévio, reajuste e valor — você confere antes de salvar.
            </span>
          </span>
          <input
            type="file"
            className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleFile(file);
            }}
          />
        </label>
        {aiNote && (
          <div
            role="status"
            className={cn(
              "rounded-md px-3 py-2 text-sm ring-1 ring-inset",
              aiNote.tone === "ok" ? "bg-[#f2f8f9] text-[#1f4a5e] ring-[#dce9eb]" : "bg-red-50 text-red-700 ring-red-200"
            )}
          >
            <p>{aiNote.text}</p>
            {aiNote.summary && <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Resumo da IA: {aiNote.summary}</p>}
          </div>
        )}
        <Field label="Ou o link do arquivo no SharePoint" htmlFor="ctr-link">
          <Input
            id="ctr-link"
            value={form.sharepoint_url}
            onChange={(e) => set("sharepoint_url", e.target.value)}
            placeholder="https://bismarchipires.sharepoint.com/..."
          />
        </Field>
      </section>

      <FormSection icon={FileSignature} title="Contrato">
        <Field label="Título *" htmlFor="ctr-title" hint="Ex.: Locação do escritório, Licença do Legal One.">
          <Input id="ctr-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Objeto" htmlFor="ctr-object">
          <Textarea id="ctr-object" rows={2} value={form.object} onChange={(e) => set("object", e.target.value)} />
        </Field>
        <Field label="Situação">
          <Segmented
            label="Situação do contrato"
            value={form.status}
            options={(Object.keys(CONTRACT_STATUS_LABEL) as ContractInput["status"][]).map((status) => ({
              value: status,
              label: CONTRACT_STATUS_LABEL[status],
            }))}
            onChange={(status) => set("status", status)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Formalização" htmlFor="ctr-formal">
            <LabelSelect
              id="ctr-formal"
              value={form.formalization}
              labels={FORMALIZATION_LABEL}
              placeholder="Contrato assinado"
              onChange={(value) => set("formalization", value || "contrato_assinado")}
            />
          </Field>
          <Field label="Contratante" htmlFor="ctr-party">
            <Input id="ctr-party" list="facilities-parties" value={form.contracting_party} onChange={(e) => set("contracting_party", e.target.value)} />
            <datalist id="facilities-parties">
              {CONTRACTING_PARTIES.map((party) => (
                <option key={party} value={party} />
              ))}
            </datalist>
          </Field>
        </div>
      </FormSection>

      <FormSection icon={CalendarClock} title="Vigência e renovação">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Início" htmlFor="ctr-start">
            <DatePickerField id="ctr-start" value={form.start_date} onChange={(value) => set("start_date", value)} />
          </Field>
          <Field label="Fim da vigência" htmlFor="ctr-end" hint="Em branco = prazo indeterminado.">
            <DatePickerField id="ctr-end" value={form.end_date} onChange={(value) => set("end_date", value)} />
          </Field>
        </div>
        <ToggleField
          label="Renova automaticamente"
          description="Sem aviso no prazo, o contrato continua por mais um período."
          checked={form.auto_renew}
          onChange={(checked) => onChange({ ...form, auto_renew: checked, renewal_months: checked ? (form.renewal_months ?? 12) : null })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {form.auto_renew && (
            <Field label="Renova por (meses)" htmlFor="ctr-renew">
              <Input
                id="ctr-renew"
                inputMode="numeric"
                value={form.renewal_months ?? ""}
                onChange={(e) => set("renewal_months", numberField(e.target.value, 120))}
              />
            </Field>
          )}
          <Field label="Aviso prévio (dias)" htmlFor="ctr-notice" hint="Antecedência para avisar que não vai renovar ou para rescindir.">
            <Input
              id="ctr-notice"
              inputMode="numeric"
              value={form.notice_days ?? ""}
              onChange={(e) => set("notice_days", numberField(e.target.value, 365))}
              placeholder="30"
            />
          </Field>
        </div>
        {deadline && (
          <p className="rounded-md bg-[#f2f8f9] px-3 py-2 text-sm text-[#1f4a5e] ring-1 ring-inset ring-[#dce9eb]">
            {form.auto_renew ? "Para não renovar, avisar o fornecedor até " : "Para encerrar sem multa, avisar até "}
            <strong className="font-semibold tabular-nums">{formatShortDate(deadline)}</strong>. O alerta aparece 60 dias antes.
          </p>
        )}
      </FormSection>

      <FormSection icon={Percent} title="Valor e reajuste">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor" htmlFor="ctr-value">
            <div className="flex gap-2">
              <CurrencyInput
                id="ctr-value"
                className="flex-1"
                value={form.value == null ? "" : String(form.value)}
                onChange={(value) => set("value", value === "" ? null : Number(value))}
              />
              <div className="w-32 shrink-0">
                <LabelSelect
                  value={form.value_period}
                  labels={VALUE_PERIOD_LABEL}
                  placeholder="por mês"
                  onChange={(value) => set("value_period", value || "mensal")}
                />
              </div>
            </div>
          </Field>
          <Field label="Índice de reajuste" htmlFor="ctr-index">
            <LabelSelect
              id="ctr-index"
              value={form.adjustment_index}
              labels={ADJUSTMENT_INDEX_LABEL}
              placeholder="Sem reajuste"
              allowEmpty
              onChange={(value) => set("adjustment_index", value)}
            />
          </Field>
          <Field label="Mês do reajuste" htmlFor="ctr-month" hint="Aniversário do contrato; vira lembrete no mês anterior.">
            <Select
              value={form.adjustment_month ? String(form.adjustment_month) : NONE}
              onValueChange={(value) => set("adjustment_month", value === NONE ? null : Number(value))}
            >
              <SelectTrigger id="ctr-month" className="h-10 w-full bg-white text-sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {MONTH_LABELS.map((month, index) => (
                  <SelectItem key={month} value={String(index + 1)}>
                    {month.charAt(0).toUpperCase() + month.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormSection icon={UserRound} title="Responsável e observações">
        <Field label="Gestor do contrato" htmlFor="ctr-owner" hint="Quem decide renovar ou encerrar.">
          <PersonSelect id="ctr-owner" value={form.responsible_user_id} people={people} onChange={(id) => set("responsible_user_id", id)} />
        </Field>
        <Field label="Observações" htmlFor="ctr-notes" hint="Multa de rescisão, garantias, contatos do contrato.">
          <Textarea id="ctr-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </FormSection>
    </div>
  );
}

export function contractMissing(form: ContractInput): string | null {
  if (!form.title.trim()) return "Dê um título ao contrato.";
  if (form.start_date && form.end_date && form.end_date < form.start_date) return "O fim da vigência não pode ser antes do início.";
  if (form.sharepoint_url && !/^https?:\/\//i.test(form.sharepoint_url)) return "O link precisa começar com http:// ou https://.";
  return null;
}
