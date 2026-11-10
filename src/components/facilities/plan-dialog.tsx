"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck2,
  Download,
  ExternalLink,
  FileText,
  History,
  Link2,
  Loader2,
  Paperclip,
  PencilLine,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatShortDate, todayIso } from "@/lib/facilities/alerts";
import { maintenanceApi, openMaintenanceDocument, uploadMaintenanceFile } from "@/lib/facilities/client";
import { MAINTENANCE_TYPE_LABEL, nextDueAfter, PERIODICITY_INFO, planSituation } from "@/lib/facilities/maintenance";
import {
  ASSET_CATEGORY_LABEL,
  FACILITIES_SUPPLIERS_PATH,
  MAINTENANCE_DOCUMENT_KINDS,
  MAINTENANCE_DOCUMENT_LABEL,
  type FacilitiesPerson,
  type FacilityAsset,
  type MaintenanceDocument,
  type MaintenanceDocumentKind,
  type MaintenancePlan,
  type MaintenanceSupplierOption,
  type PlanInput,
  type RecordInput,
} from "@/lib/facilities/types";
import { cn } from "@/lib/utils";
import { formatBrl, PersonAvatar, SupplierMonogram } from "./facilities-visuals";
import { Field, FormSection, Segmented } from "./form-parts";
import { emptyPlanInput, emptyRecordInput, PlanForm, planMissing, planToInput, SupplierPicker } from "./maintenance-forms";
import { AssetTile, dateOrDash, periodicityText, SituationBadge } from "./maintenance-visuals";

type View = "view" | "edit" | "record" | "document";

interface DocumentDraft {
  kind: MaintenanceDocumentKind;
  title: string;
  mode: "arquivo" | "link";
  file: File | null;
  external_url: string;
}

const emptyDocument = (): DocumentDraft => ({ kind: "laudo", title: "", mode: "arquivo", file: null, external_url: "" });

function DocumentKindSelect({ value, onChange }: { value: MaintenanceDocumentKind; onChange: (value: MaintenanceDocumentKind) => void }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as MaintenanceDocumentKind)}>
      <SelectTrigger className="h-10 w-full bg-white text-sm" aria-label="Tipo de documento">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MAINTENANCE_DOCUMENT_KINDS.map((kind) => (
          <SelectItem key={kind} value={kind}>
            {MAINTENANCE_DOCUMENT_LABEL[kind]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FileInput({ file, onChange }: { file: File | null; onChange: (file: File | null) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-[#c9dde1] bg-white px-3 py-3 text-sm hover:bg-[#f6fafb] focus-within:ring-2 focus-within:ring-[#47cdd0]/50">
      <Paperclip className="size-4 shrink-0 text-[#3e84a8]" aria-hidden />
      <span className={cn("min-w-0 flex-1 truncate", file ? "text-foreground" : "text-muted-foreground")}>
        {file ? file.name : "Escolher arquivo (PDF, imagem ou Word, até 50 MB)"}
      </span>
      <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </label>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function DocumentLine({ doc, onDelete, busy }: { doc: MaintenanceDocument; onDelete: () => void; busy: boolean }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#eef3f5] text-[#285f7a]">
        {doc.has_file ? <FileText className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{doc.title || doc.file_name || MAINTENANCE_DOCUMENT_LABEL[doc.kind]}</span>
        <span className="block text-xs text-muted-foreground">
          {MAINTENANCE_DOCUMENT_LABEL[doc.kind]} · enviado em {formatShortDate(doc.created_at.slice(0, 10))}
          {error && <span className="text-red-700"> · {error}</span>}
        </span>
      </span>
      {doc.has_file ? (
        <>
          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Abrir" onClick={() => openMaintenanceDocument(doc.id).catch((e) => setError(e.message))}>
            <ExternalLink className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Baixar" onClick={() => openMaintenanceDocument(doc.id, true).catch((e) => setError(e.message))}>
            <Download className="size-4" />
          </Button>
        </>
      ) : (
        doc.external_url && (
          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Abrir link" asChild>
            <a href={doc.external_url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )
      )}
      <Button type="button" variant="ghost" size="icon" className="size-8 text-red-700 hover:bg-red-50" aria-label="Excluir documento" disabled={busy} onClick={onDelete}>
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}

export function PlanDialog({
  plan: initialPlan,
  preset,
  assets,
  suppliers,
  people,
  onClose,
  onSaved,
  onDeleted,
  onAssetCreated,
  onSupplierCreated,
}: {
  plan: MaintenancePlan | null;
  preset?: Partial<PlanInput>;
  assets: FacilityAsset[];
  suppliers: MaintenanceSupplierOption[];
  people: FacilitiesPerson[];
  onClose: () => void;
  onSaved: (plan: MaintenancePlan) => void;
  onDeleted: (id: string) => void;
  onAssetCreated: (asset: FacilityAsset) => void;
  onSupplierCreated: (supplier: MaintenanceSupplierOption) => void;
}) {
  const [plan, setPlan] = useState(initialPlan);
  const [view, setView] = useState<View>(initialPlan ? "view" : "edit");
  const [form, setForm] = useState<PlanInput>(() => (initialPlan ? planToInput(initialPlan) : emptyPlanInput(preset)));
  const [record, setRecord] = useState<RecordInput | null>(null);
  const [recordFile, setRecordFile] = useState<{ kind: MaintenanceDocumentKind; file: File | null }>({ kind: "ordem_servico", file: null });
  const [doc, setDoc] = useState<DocumentDraft>(emptyDocument);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayIso();

  const asset = plan?.asset_id ? assets.find((a) => a.id === plan.asset_id) : form.asset_id ? assets.find((a) => a.id === form.asset_id) : undefined;
  const supplier = plan?.supplier_id ? suppliers.find((s) => s.id === plan.supplier_id) : undefined;
  const contract = supplier?.contracts.find((c) => c.id === plan?.contract_id);
  const owner = plan?.responsible_user_id ? people.find((p) => p.id === plan.responsible_user_id) : undefined;

  function go(next: View) {
    setView(next);
    setConfirmDelete(false);
    setError(null);
  }

  function apply(next: MaintenancePlan) {
    setPlan(next);
    onSaved(next);
  }

  async function run(task: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await task();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const savePlan = () =>
    run(async () => {
      const missing = planMissing(form);
      if (missing) throw new Error(missing);
      const saved = plan ? await maintenanceApi.updatePlan(plan.id, form) : await maintenanceApi.createPlan(form);
      apply(saved);
      setForm(planToInput(saved));
      go("view");
    });

  const deletePlan = () =>
    run(async () => {
      if (!plan) return;
      await maintenanceApi.deletePlan(plan.id);
      onDeleted(plan.id);
    });

  const saveRecord = () =>
    run(async () => {
      if (!plan || !record) return;
      if (!record.done_on) throw new Error("Informe a data em que foi feita.");
      const before = new Set(plan.records.map((r) => r.id));
      let saved = await maintenanceApi.createRecord(plan.id, record);
      const created = saved.records.find((r) => !before.has(r.id));
      if (recordFile.file) {
        saved = await uploadMaintenanceFile({
          planId: plan.id,
          recordId: created?.id ?? null,
          kind: recordFile.kind,
          title: `${MAINTENANCE_DOCUMENT_LABEL[recordFile.kind]} de ${formatShortDate(record.done_on)}`,
          file: recordFile.file,
        });
      }
      apply(saved);
      setForm(planToInput(saved));
      go("view");
    });

  const deleteRecord = (id: string) =>
    run(async () => {
      const saved = await maintenanceApi.deleteRecord(id);
      apply(saved);
      setForm(planToInput(saved));
    });

  const saveDocument = () =>
    run(async () => {
      if (!plan) return;
      if (doc.mode === "arquivo") {
        if (!doc.file) throw new Error("Escolha o arquivo.");
        apply(await uploadMaintenanceFile({ planId: plan.id, recordId: null, kind: doc.kind, title: doc.title, file: doc.file }));
      } else {
        if (!/^https?:\/\//i.test(doc.external_url.trim())) throw new Error("Cole o link completo (https://...).");
        apply(await maintenanceApi.addLink({ plan_id: plan.id, record_id: null, kind: doc.kind, title: doc.title, external_url: doc.external_url.trim() }));
      }
      go("view");
    });

  const deleteDocument = (id: string) => run(async () => apply(await maintenanceApi.deleteDocument(id)));

  /* -------------------------------------------------------------- render */

  let header: ReactNode;
  let body: ReactNode;
  let footer: ReactNode;

  const back = (title: string, description: string) => (
    <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-4 pr-14 text-left">
      <button
        type="button"
        onClick={() => go("view")}
        disabled={saving}
        className="-ml-1 inline-flex w-fit items-center gap-1 rounded px-1 text-xs font-medium text-[#285f7a] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {plan?.title}
      </button>
      <DialogTitle className="text-lg">{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
  );

  const actions = (label: string, onSave: () => void, onCancel: () => void) => (
    <div className="flex gap-2">
      <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="button" disabled={saving} onClick={onSave}>
        {saving && <Loader2 className="size-4 animate-spin" />}
        {label}
      </Button>
    </div>
  );

  if (view === "edit" || !plan) {
    header = (
      <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
        <DialogTitle className="text-lg">{plan ? "Editar plano de manutenção" : "Novo plano de manutenção"}</DialogTitle>
        <DialogDescription>O que será feito, em qual equipamento, por quem, com qual periodicidade e quando.</DialogDescription>
      </DialogHeader>
    );
    body = (
      <PlanForm
        form={form}
        onChange={setForm}
        assets={assets}
        suppliers={suppliers}
        people={people}
        isNew={!plan}
        onAssetCreated={onAssetCreated}
        onSupplierCreated={onSupplierCreated}
      />
    );
    footer = (
      <>
        <div />
        {actions(plan ? "Salvar alterações" : "Cadastrar plano", () => void savePlan(), () => {
          if (!plan) return onClose();
          setForm(planToInput(plan));
          go("view");
        })}
      </>
    );
  } else if (view === "record" && record) {
    const next = nextDueAfter(record.done_on || today, plan.periodicity, plan.custom_interval_days);
    header = back("Registrar execução", "A data vira a última manutenção e a próxima é recalculada.");
    body = (
      <>
        <FormSection icon={CalendarCheck2} title="Execução">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Feita em *"
              htmlFor="rec-date"
              hint={next ? `Próxima passa a ser ${formatShortDate(next)}.` : "Pontual: o plano fica concluído."}
            >
              <DatePickerField id="rec-date" value={record.done_on} onChange={(value) => setRecord({ ...record, done_on: value })} />
            </Field>
            <Field label="Custo" htmlFor="rec-cost">
              <CurrencyInput
                id="rec-cost"
                value={record.cost == null ? "" : String(record.cost)}
                onChange={(value) => setRecord({ ...record, cost: value === "" ? null : Number(value) })}
              />
            </Field>
            <Field label="Prestador" className="sm:col-span-2">
              <SupplierPicker
                value={record.supplier_id}
                suppliers={suppliers}
                onChange={(id) => setRecord({ ...record, supplier_id: id })}
                onCreated={onSupplierCreated}
              />
            </Field>
            <Field label="O que foi feito" htmlFor="rec-notes" className="sm:col-span-2">
              <Textarea id="rec-notes" rows={3} value={record.notes} onChange={(e) => setRecord({ ...record, notes: e.target.value })} placeholder="Peças trocadas, pendências, número da OS…" />
            </Field>
          </div>
        </FormSection>
        <FormSection icon={Paperclip} title="Comprovante (opcional)">
          <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <DocumentKindSelect value={recordFile.kind} onChange={(kind) => setRecordFile({ ...recordFile, kind })} />
            <FileInput file={recordFile.file} onChange={(file) => setRecordFile({ ...recordFile, file })} />
          </div>
        </FormSection>
      </>
    );
    footer = (
      <>
        <div />
        {actions("Registrar", () => void saveRecord(), () => go("view"))}
      </>
    );
  } else if (view === "document") {
    header = back("Adicionar documento", "Laudo, nota fiscal, ordem de serviço, certificado ou PMOC.");
    body = (
      <FormSection icon={Paperclip} title="Documento">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <DocumentKindSelect value={doc.kind} onChange={(kind) => setDoc({ ...doc, kind })} />
          </Field>
          <Field label="Título" htmlFor="mdoc-title">
            <Input id="mdoc-title" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} placeholder="Ex.: PMOC 2026" />
          </Field>
          <Field label="Onde está" className="sm:col-span-2">
            <Segmented<DocumentDraft["mode"]>
              label="Onde está"
              value={doc.mode}
              options={[
                { value: "arquivo", label: "Subir arquivo" },
                { value: "link", label: "Link (SharePoint)" },
              ]}
              onChange={(mode) => setDoc({ ...doc, mode })}
            />
          </Field>
          <div className="sm:col-span-2">
            {doc.mode === "arquivo" ? (
              <FileInput file={doc.file} onChange={(file) => setDoc({ ...doc, file })} />
            ) : (
              <Input value={doc.external_url} onChange={(e) => setDoc({ ...doc, external_url: e.target.value })} placeholder="https://" aria-label="Link do documento" />
            )}
          </div>
        </div>
      </FormSection>
    );
    footer = (
      <>
        <div />
        {actions("Adicionar", () => void saveDocument(), () => go("view"))}
      </>
    );
  } else {
    const { situation, days } = planSituation(plan, today);
    const records = [...plan.records].sort((a, b) => b.done_on.localeCompare(a.done_on));
    const spent = records.reduce((sum, r) => sum + (r.cost ?? 0), 0);
    const generalDocs = plan.documents.filter((d) => !d.record_id);
    header = (
      <DialogHeader className="gap-0 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
        <div className="flex items-start gap-4">
          {asset ? (
            <AssetTile category={asset.category} size="lg" />
          ) : (
            <span className="grid size-14 shrink-0 place-items-center rounded-md bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200">
              <Wrench className="size-6" aria-hidden />
            </span>
          )}
          <div className="min-w-0 space-y-1.5">
            <DialogTitle className="text-lg">{plan.title}</DialogTitle>
            <DialogDescription className="mt-0">
              {asset ? [asset.name, asset.location, ASSET_CATEGORY_LABEL[asset.category]].filter(Boolean).join(" · ") : "Serviço geral, sem equipamento"}
            </DialogDescription>
            <div className="flex flex-wrap items-center gap-1.5">
              <SituationBadge situation={situation} days={days} />
              <span className="rounded-full bg-[#eef3f5] px-2 py-0.5 text-xs font-medium text-[#285f7a]">{MAINTENANCE_TYPE_LABEL[plan.maintenance_type]}</span>
              <span className="rounded-full bg-[#eeedf5] px-2 py-0.5 text-xs font-medium text-[#48466e]" title={PERIODICITY_INFO[plan.periodicity].hint}>
                {periodicityText(plan)}
              </span>
            </div>
          </div>
        </div>
      </DialogHeader>
    );
    body = (
      <div className="space-y-6 px-6 py-5">
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-[#e6eef0] ring-1 ring-[#e6eef0] sm:grid-cols-3">
          <div className="bg-[#f7fbfc] p-4">
            <p className="text-xs text-muted-foreground">Próxima manutenção</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[#10293a]">{dateOrDash(plan.next_due_on)}</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-xs text-muted-foreground">Última</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[#10293a]">{dateOrDash(plan.last_done_on)}</p>
          </div>
          <div className="col-span-2 bg-white p-4 sm:col-span-1">
            <p className="text-xs text-muted-foreground">Custo estimado</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[#10293a]">{plan.estimated_cost != null ? formatBrl(plan.estimated_cost) : "—"}</p>
            {spent > 0 && <p className="text-xs text-muted-foreground">{formatBrl(spent)} gastos no histórico</p>}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Fact label="Prestador">
            {supplier ? (
              <Link href={`${FACILITIES_SUPPLIERS_PATH}?fornecedor=${supplier.id}`} className="flex items-center gap-2 hover:underline">
                <SupplierMonogram name={supplier.name} category={supplier.category} size="sm" />
                <span className="truncate">{supplier.name}</span>
              </Link>
            ) : (
              <span className="text-muted-foreground">Não definido</span>
            )}
          </Fact>
          <Fact label="Contrato vinculado">{contract ? contract.title : <span className="text-muted-foreground">Sem contrato</span>}</Fact>
          <Fact label="Responsável interno">
            {owner ? (
              <span className="flex items-center gap-2">
                <PersonAvatar person={owner} size="xs" />
                <span className="truncate">{owner.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Ninguém definido</span>
            )}
          </Fact>
        </section>

        {plan.notes && <p className="whitespace-pre-line rounded-md bg-[#f2f8f9] px-3 py-2 text-sm leading-6 text-foreground">{plan.notes}</p>}

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <History className="size-4 text-[#3e84a8]" aria-hidden />
              Histórico de execuções
            </h3>
          </div>
          {records.length === 0 ? (
            <p className="rounded-md border border-dashed border-[#dce9eb] px-4 py-4 text-sm text-muted-foreground">
              Nenhuma execução registrada. Ao registrar, a data vira a última manutenção e a próxima é recalculada.
            </p>
          ) : (
            <ol className="divide-y divide-[#eef3f5] rounded-md ring-1 ring-[#e6eef0]">
              {records.map((r) => {
                const who = r.supplier_id ? suppliers.find((s) => s.id === r.supplier_id) : undefined;
                const docs = plan.documents.filter((d) => d.record_id === r.id);
                return (
                  <li key={r.id} className="flex items-start gap-3 px-3 py-2.5">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#e8f8f8] text-[#1f6f72]">
                      <CalendarCheck2 className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium tabular-nums text-foreground">{formatShortDate(r.done_on)}</span>
                        {r.cost != null && <span className="text-sm tabular-nums text-muted-foreground">{formatBrl(r.cost)}</span>}
                        {who && <span className="truncate text-xs text-muted-foreground">{who.name}</span>}
                      </span>
                      {r.notes && <span className="block whitespace-pre-line text-sm text-foreground">{r.notes}</span>}
                      {docs.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => (d.has_file ? openMaintenanceDocument(d.id).catch((e) => setError(e.message)) : d.external_url && window.open(d.external_url, "_blank"))}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#285f7a] hover:underline"
                        >
                          <Paperclip className="size-3" aria-hidden />
                          {d.title || MAINTENANCE_DOCUMENT_LABEL[d.kind]}
                        </button>
                      ))}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-red-700"
                      aria-label={`Excluir execução de ${formatShortDate(r.done_on)}`}
                      disabled={saving}
                      onClick={() => void deleteRecord(r.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <FileText className="size-4 text-[#3e84a8]" aria-hidden />
              Documentos
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => {
                setDoc(emptyDocument());
                go("document");
              }}
            >
              <Plus className="size-3.5" />
              Adicionar
            </Button>
          </div>
          {generalDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Laudos, notas fiscais, ordens de serviço, certificados e PMOC ficam aqui.</p>
          ) : (
            <ul className="divide-y divide-[#eef3f5] rounded-md ring-1 ring-[#e6eef0]">
              {generalDocs.map((d) => (
                <DocumentLine key={d.id} doc={d} busy={saving} onDelete={() => void deleteDocument(d.id)} />
              ))}
            </ul>
          )}
        </section>
      </div>
    );
    footer = (
      <>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <Button type="button" variant="destructive" disabled={saving} onClick={() => void deletePlan()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Confirmar exclusão
            </Button>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setConfirmDelete(false)}>
              Manter
            </Button>
          </div>
        ) : (
          <Button type="button" variant="ghost" className="gap-2 px-3 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
            <span className="hidden sm:inline">Excluir</span>
          </Button>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="gap-1.5" disabled={saving} onClick={() => go("edit")}>
            <PencilLine className="size-4" />
            Editar
          </Button>
          {plan.status !== "concluido" && (
            <Button
              type="button"
              className="gap-1.5"
              disabled={saving}
              onClick={() => {
                setRecord(emptyRecordInput(plan));
                setRecordFile({ kind: "ordem_servico", file: null });
                go("record");
              }}
            >
              <CalendarCheck2 className="size-4" />
              Registrar execução
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:min-h-[min(32rem,90dvh)] sm:max-w-2xl" showCloseButton={!saving}>
        {header}
        <div key={view} className="min-h-0 flex-1 overflow-y-auto">
          {body}
        </div>
        {error && <p className="border-t border-red-100 bg-red-50 px-6 py-2 text-sm text-red-800">{error}</p>}
        <div className="flex items-center justify-between gap-2 border-t border-[#e6eef0] px-6 py-3">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}
