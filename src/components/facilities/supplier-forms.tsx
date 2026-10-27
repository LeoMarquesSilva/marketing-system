"use client";

import { useState } from "react";
import { Building2, CircleDollarSign, Contact, FileUp, Link2, MapPinned, MessageSquareText, Paperclip } from "lucide-react";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StarRatingInput } from "@/components/eventos/star-rating-input";
import {
  CONTRACTING_PARTIES,
  DOCUMENT_KIND_LABEL,
  EXPIRING_DOCUMENT_KINDS,
  FISCAL_DOCUMENT_LABEL,
  PAYMENT_METHOD_LABEL,
  PERIODICITY_LABEL,
  SUPPLIER_AREAS,
  type DocumentKind,
  type FacilitiesPerson,
  type FacilitiesSupplier,
  type ServiceInput,
  type SupplierContract,
  type SupplierInput,
  type SupplierService,
} from "@/lib/facilities/types";
import { isValidCNPJ, isValidCPF, maskCpfCnpj, maskPhoneBR, onlyDigits } from "@/lib/masks-br";
import { supplierCategoriesFor } from "@/lib/suppliers/categories";
import { cn } from "@/lib/utils";
import { AreaChip, CategoryGlyph } from "./facilities-visuals";
import { Field, FormSection, LabelSelect, NONE, PersonSelect, Segmented, ToggleField } from "./form-parts";

/* -------------------------------------------------------------- fornecedor */

export function emptySupplierInput(): SupplierInput {
  return {
    name: "",
    legal_name: "",
    document: "",
    category: "",
    areas: [],
    contact_name: "",
    phone: "",
    email: "",
    website_link: "",
    whatsapp_link: "",
    city: "",
    rating: null,
    notes: "",
    active: true,
    responsible_user_id: null,
  };
}

export function supplierToInput(supplier: FacilitiesSupplier): SupplierInput {
  return {
    name: supplier.name,
    legal_name: supplier.legal_name ?? "",
    document: supplier.document ? maskCpfCnpj(supplier.document) : "",
    category: supplier.category,
    areas: supplier.areas,
    contact_name: supplier.contact_name ?? "",
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    website_link: supplier.website_link ?? "",
    whatsapp_link: supplier.whatsapp_link ?? "",
    city: supplier.city ?? "",
    rating: supplier.rating,
    notes: supplier.notes ?? "",
    active: supplier.active,
    responsible_user_id: supplier.responsible_user_id,
  };
}

export function supplierMissing(form: SupplierInput): string | null {
  if (!form.name.trim()) return "Informe o nome do fornecedor.";
  if (!form.category) return "Escolha a categoria.";
  const digits = onlyDigits(form.document);
  if (digits && digits.length !== 11 && digits.length !== 14) return "CNPJ ou CPF incompleto.";
  return null;
}

function documentHint(document: string): string | null {
  const digits = onlyDigits(document);
  if (digits.length === 14 && !isValidCNPJ(digits)) return "Os dígitos do CNPJ não conferem — vale checar.";
  if (digits.length === 11 && !isValidCPF(digits)) return "Os dígitos do CPF não conferem — vale checar.";
  return null;
}

export function CategorySelect({ id, value, onChange }: { id?: string; value: string; onChange: (value: string) => void }) {
  const groups = [
    { label: "Escritório (Facilities)", items: supplierCategoriesFor("facilities") },
    { label: "Eventos", items: supplierCategoriesFor("eventos").filter((c) => c.group === "eventos") },
  ];
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-10 w-full bg-white text-sm">
        <SelectValue placeholder="Escolha a categoria" />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {groups.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.items.map((category) => (
              <SelectItem key={category.key} value={category.key}>
                <span className="flex items-center gap-2">
                  <CategoryGlyph category={category.key} className="size-4 text-[#285f7a]" />
                  {category.label}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AreaPicker({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Áreas atendidas">
      {SUPPLIER_AREAS.map((area) => {
        const selected = value.includes(area);
        return (
          <button
            key={area}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? value.filter((a) => a !== area) : [...value, area])}
            className={cn(
              "rounded-full transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
              selected ? "opacity-100" : "opacity-45 grayscale hover:opacity-80"
            )}
          >
            <AreaChip area={area} className="py-1" />
          </button>
        );
      })}
    </div>
  );
}

export function SupplierForm({
  form,
  people,
  onChange,
}: {
  form: SupplierInput;
  people: FacilitiesPerson[];
  onChange: (form: SupplierInput) => void;
}) {
  const set = <K extends keyof SupplierInput>(key: K, value: SupplierInput[K]) => onChange({ ...form, [key]: value });
  const hint = documentHint(form.document);
  return (
    <div>
      <FormSection icon={Building2} title="Identificação">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome *" htmlFor="sup-name" hint="Como o escritório chama o fornecedor.">
            <Input id="sup-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Claro" />
          </Field>
          <Field label="Categoria *" htmlFor="sup-category">
            <CategorySelect id="sup-category" value={form.category} onChange={(value) => set("category", value)} />
          </Field>
          <Field label="Razão social" htmlFor="sup-legal">
            <Input id="sup-legal" value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} />
          </Field>
          <Field
            label="CNPJ ou CPF"
            htmlFor="sup-doc"
            hint={hint ? <span className="text-amber-700">{hint}</span> : "Um CNPJ/CPF por cadastro: o sistema avisa se já existir."}
          >
            <Input
              id="sup-doc"
              inputMode="numeric"
              value={form.document}
              onChange={(e) => set("document", maskCpfCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
            />
          </Field>
          <Field label="Cidade" htmlFor="sup-city">
            <Input id="sup-city" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Campinas" />
          </Field>
          <Field label="Situação">
            <ToggleField
              label={form.active ? "Ativo" : "Inativo"}
              description={form.active ? "Aparece nas buscas e nos eventos." : "Fica no histórico, fora das listas."}
              checked={form.active}
              onChange={(checked) => set("active", checked)}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection icon={MapPinned} title="Quem usa e quem cuida">
        <Field label="Áreas atendidas / centro de custo">
          <AreaPicker value={form.areas} onChange={(areas) => set("areas", areas)} />
        </Field>
        <Field label="Responsável no escritório" htmlFor="sup-owner" hint="Quem acompanha o fornecedor e recebe os alertas.">
          <PersonSelect id="sup-owner" value={form.responsible_user_id} people={people} onChange={(id) => set("responsible_user_id", id)} />
        </Field>
      </FormSection>

      <FormSection icon={Contact} title="Contato">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pessoa de contato" htmlFor="sup-contact">
            <Input id="sup-contact" value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
          </Field>
          <Field label="Telefone" htmlFor="sup-phone">
            <Input id="sup-phone" inputMode="tel" value={form.phone} onChange={(e) => set("phone", maskPhoneBR(e.target.value))} />
          </Field>
          <Field label="E-mail" htmlFor="sup-email">
            <Input id="sup-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Site" htmlFor="sup-site">
            <Input id="sup-site" value={form.website_link} onChange={(e) => set("website_link", e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Link do WhatsApp" htmlFor="sup-wa" className="sm:col-span-2">
            <Input id="sup-wa" value={form.whatsapp_link} onChange={(e) => set("whatsapp_link", e.target.value)} placeholder="https://wa.me/55..." />
          </Field>
        </div>
      </FormSection>

      <FormSection icon={MessageSquareText} title="Avaliação e observações">
        <Field label="Avaliação">
          <StarRatingInput value={form.rating} onChange={(rating) => set("rating", rating)} />
        </Field>
        <Field label="Observações" htmlFor="sup-notes">
          <Textarea id="sup-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </FormSection>
    </div>
  );
}

/* ----------------------------------------------------------------- serviço */

export function emptyServiceInput(supplier: FacilitiesSupplier): ServiceInput {
  return {
    description: "",
    area: supplier.areas[0] ?? "",
    shared_cost: false,
    payer: CONTRACTING_PARTIES[0],
    periodicity: "mensal",
    due_day: null,
    amount: null,
    payment_method: "",
    payment_details: "",
    fiscal_document: "",
    notes: "",
    active: true,
  };
}

export function serviceToInput(service: SupplierService): ServiceInput {
  return {
    description: service.description,
    area: service.area ?? "",
    shared_cost: service.shared_cost,
    payer: service.payer ?? "",
    periodicity: service.periodicity,
    due_day: service.due_day,
    amount: service.amount,
    payment_method: service.payment_method ?? "",
    payment_details: service.payment_details ?? "",
    fiscal_document: service.fiscal_document ?? "",
    notes: service.notes ?? "",
    active: service.active,
  };
}

export function ServiceForm({ form, onChange }: { form: ServiceInput; onChange: (form: ServiceInput) => void }) {
  const set = <K extends keyof ServiceInput>(key: K, value: ServiceInput[K]) => onChange({ ...form, [key]: value });
  return (
    <div>
      <FormSection icon={Paperclip} title="O que é contratado">
        <Field label="Descrição *" htmlFor="svc-desc" hint="Ex.: Internet fibra, Celular da recepção, Licença do Legal One.">
          <Input id="svc-desc" value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Área / centro de custo" htmlFor="svc-area">
            <Select value={form.area || NONE} onValueChange={(value) => set("area", value === NONE ? "" : value)}>
              <SelectTrigger id="svc-area" className="h-10 w-full bg-white text-sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {SUPPLIER_AREAS.map((area) => (
                  <SelectItem key={area} value={area}>
                    {area}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Rateio">
            <ToggleField
              label="Rateado entre as áreas"
              checked={form.shared_cost}
              onChange={(checked) => set("shared_cost", checked)}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection icon={CircleDollarSign} title="Valor e pagamento">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Valor" htmlFor="svc-amount">
            <CurrencyInput
              id="svc-amount"
              value={form.amount == null ? "" : String(form.amount)}
              onChange={(value) => set("amount", value === "" ? null : Number(value))}
            />
          </Field>
          <Field label="Periodicidade" htmlFor="svc-period">
            <LabelSelect
              id="svc-period"
              value={form.periodicity}
              labels={PERIODICITY_LABEL}
              placeholder="Mensal"
              onChange={(value) => set("periodicity", value || "mensal")}
            />
          </Field>
          <Field label="Dia do vencimento" htmlFor="svc-due">
            <Input
              id="svc-due"
              inputMode="numeric"
              value={form.due_day ?? ""}
              onChange={(e) => {
                const day = Number(onlyDigits(e.target.value).slice(0, 2));
                set("due_day", day >= 1 && day <= 31 ? day : null);
              }}
              placeholder="10"
            />
          </Field>
          <Field label="Forma de pagamento" htmlFor="svc-method">
            <LabelSelect
              id="svc-method"
              value={form.payment_method}
              labels={PAYMENT_METHOD_LABEL}
              placeholder="—"
              allowEmpty
              onChange={(value) => set("payment_method", value)}
            />
          </Field>
          <Field label="Documento fiscal" htmlFor="svc-fiscal">
            <LabelSelect
              id="svc-fiscal"
              value={form.fiscal_document}
              labels={FISCAL_DOCUMENT_LABEL}
              placeholder="—"
              allowEmpty
              onChange={(value) => set("fiscal_document", value)}
            />
          </Field>
          <Field label="Quem paga" htmlFor="svc-payer">
            <Input id="svc-payer" list="facilities-payers" value={form.payer} onChange={(e) => set("payer", e.target.value)} />
            <datalist id="facilities-payers">
              {CONTRACTING_PARTIES.map((party) => (
                <option key={party} value={party} />
              ))}
            </datalist>
          </Field>
          <Field label="Dados para pagamento" htmlFor="svc-details" className="sm:col-span-3" hint="Chave Pix ou banco, agência e conta.">
            <Input id="svc-details" value={form.payment_details} onChange={(e) => set("payment_details", e.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection icon={MessageSquareText} title="Observações">
        <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} aria-label="Observações do serviço" />
        <ToggleField
          label={form.active ? "Em uso" : "Encerrado"}
          description="Encerrado sai do custo mensal, mas fica no histórico."
          checked={form.active}
          onChange={(checked) => set("active", checked)}
        />
      </FormSection>
    </div>
  );
}

/* --------------------------------------------------------------- documento */

export interface DocumentDraft {
  kind: DocumentKind;
  title: string;
  contract_id: string | null;
  valid_until: string;
  mode: "arquivo" | "link";
  file: File | null;
  external_url: string;
}

export function emptyDocumentDraft(contractId: string | null): DocumentDraft {
  return {
    kind: contractId ? "aditivo" : "cartao_cnpj",
    title: "",
    contract_id: contractId,
    valid_until: "",
    mode: "arquivo",
    file: null,
    external_url: "",
  };
}

export function DocumentForm({
  draft,
  contracts,
  onChange,
}: {
  draft: DocumentDraft;
  contracts: SupplierContract[];
  onChange: (draft: DocumentDraft) => void;
}) {
  const set = <K extends keyof DocumentDraft>(key: K, value: DocumentDraft[K]) => onChange({ ...draft, [key]: value });
  const [dragging, setDragging] = useState(false);
  const expiring = EXPIRING_DOCUMENT_KINDS.includes(draft.kind);
  return (
    <div>
      <FormSection icon={Paperclip} title="Documento">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" htmlFor="doc-kind">
            <LabelSelect
              id="doc-kind"
              value={draft.kind}
              labels={DOCUMENT_KIND_LABEL}
              placeholder="Tipo"
              onChange={(value) => set("kind", value || "outro")}
            />
          </Field>
          <Field label="Contrato" htmlFor="doc-contract">
            <Select value={draft.contract_id ?? NONE} onValueChange={(value) => set("contract_id", value === NONE ? null : value)}>
              <SelectTrigger id="doc-contract" className="h-10 w-full bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Do fornecedor (sem contrato)</SelectItem>
                {contracts.map((contract) => (
                  <SelectItem key={contract.id} value={contract.id}>
                    {contract.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Título" htmlFor="doc-title" hint="Opcional. Ex.: 1º aditivo — reajuste 2026.">
            <Input id="doc-title" value={draft.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label={expiring ? "Validade" : "Validade (se houver)"} htmlFor="doc-valid" hint={expiring ? "Vira alerta 30 dias antes." : undefined}>
            <DatePickerField id="doc-valid" value={draft.valid_until} onChange={(value) => set("valid_until", value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection icon={draft.mode === "arquivo" ? FileUp : Link2} title="Onde está">
        <Segmented
          label="Origem do documento"
          value={draft.mode}
          options={[
            { value: "arquivo", label: "Enviar arquivo", icon: FileUp },
            { value: "link", label: "Link do SharePoint", icon: Link2 },
          ]}
          onChange={(mode) => set("mode", mode)}
        />
        {draft.mode === "arquivo" ? (
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
              if (file) set("file", file);
            }}
            className={cn(
              "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-6 text-center transition-colors",
              dragging ? "border-[#47cdd0] bg-[#e8f8f8]" : "border-[#c9dde1] bg-[#fafcfc] hover:bg-[#f2f8f9]"
            )}
          >
            <FileUp className="size-5 text-[#3e84a8]" aria-hidden />
            <span className="text-sm font-medium text-foreground">{draft.file ? draft.file.name : "Arraste o arquivo ou clique para escolher"}</span>
            <span className="text-xs text-muted-foreground">PDF, imagem ou Word, até 50 MB</span>
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={(e) => set("file", e.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <Field label="Link" htmlFor="doc-link" hint="Enquanto o arquivo não sobe para o sistema, o link do SharePoint/OneDrive resolve.">
            <Input id="doc-link" value={draft.external_url} onChange={(e) => set("external_url", e.target.value)} placeholder="https://bismarchipires.sharepoint.com/..." />
          </Field>
        )}
      </FormSection>
    </div>
  );
}
