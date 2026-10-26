"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CalendarRange,
  Download,
  ExternalLink,
  FileSignature,
  FileText,
  Globe,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  PencilLine,
  Phone,
  Plus,
  RefreshCw,
  Ticket,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SupplierRatingStars } from "@/components/eventos/supplier-rating-stars";
import {
  contractAlerts,
  currentTermEnd,
  formatShortDate,
  monthlyCost,
  nextAdjustment,
  noticeDeadline,
  supplierAlerts,
  termProgress,
  todayIso,
} from "@/lib/facilities/alerts";
import { facilitiesApi, openSupplierDocument, uploadSupplierFile } from "@/lib/facilities/client";
import {
  ADJUSTMENT_INDEX_LABEL,
  CONTRACT_STATUS_LABEL,
  DOCUMENT_KIND_LABEL,
  FISCAL_DOCUMENT_LABEL,
  FORMALIZATION_LABEL,
  MONTH_LABELS,
  PAYMENT_METHOD_LABEL,
  PERIODICITY_LABEL,
  VALUE_PERIOD_LABEL,
  type ContractInput,
  type FacilitiesPerson,
  type FacilitiesSupplier,
  type ServiceInput,
  type SupplierContract,
  type SupplierDocument,
  type SupplierInput,
} from "@/lib/facilities/types";
import { supplierCategoryLabel } from "@/lib/suppliers/categories";
import { cn } from "@/lib/utils";
import { ContractForm, contractMissing, contractToInput, emptyContractInput } from "./contract-form";
import {
  AlertPill,
  AreaChip,
  CategoryGlyph,
  contractHeadline,
  displayLegalName,
  documentLabel,
  formatBrl,
  PersonAvatar,
  shortPersonName,
  StatusDot,
  SupplierMonogram,
  TermBar,
} from "./facilities-visuals";
import {
  DocumentForm,
  emptyDocumentDraft,
  emptyServiceInput,
  emptySupplierInput,
  serviceToInput,
  ServiceForm,
  SupplierForm,
  supplierMissing,
  supplierToInput,
  type DocumentDraft,
} from "./supplier-forms";

export type SupplierTab = "resumo" | "servicos" | "contratos" | "documentos";

export type SupplierView =
  | { kind: "supplier"; mode: "view" | "edit"; tab: SupplierTab }
  | { kind: "service"; serviceId: string | null }
  | { kind: "contract"; contractId: string | null; mode: "view" | "edit" }
  | { kind: "document"; contractId: string | null; back: SupplierView };

const TABS: Array<{ key: SupplierTab; label: string }> = [
  { key: "resumo", label: "Resumo" },
  { key: "servicos", label: "Serviços" },
  { key: "contratos", label: "Contratos" },
  { key: "documentos", label: "Documentos" },
];

/* ------------------------------------------------------------ peças comuns */

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
      {action}
    </div>
  );
}

function EmptyLine({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-md border border-dashed border-[#dce9eb] px-4 py-5 text-sm text-muted-foreground">
      <Icon className="size-4 shrink-0 text-[#3e84a8]" aria-hidden />
      {children}
    </p>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function usePerson(people: FacilitiesPerson[], id: string | null): FacilitiesPerson | null {
  return useMemo(() => (id ? (people.find((person) => person.id === id) ?? null) : null), [people, id]);
}

function PersonFact({ people, id, empty = "Ninguém definido" }: { people: FacilitiesPerson[]; id: string | null; empty?: string }) {
  const person = usePerson(people, id);
  if (!person) return <span className="text-sm text-muted-foreground">{empty}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <PersonAvatar person={person} size="xs" />
      <span className="truncate text-sm font-medium text-foreground">{shortPersonName(person.name)}</span>
    </span>
  );
}

export function contractPeriod(contract: SupplierContract): string {
  if (!contract.start_date && !contract.end_date) return "Vigência não preenchida";
  // Contrato que renova sozinho: o período original confunde ao lado de "Renova em 2027".
  if (contract.auto_renew && contract.renewal_months) {
    return `${contract.start_date ? `Desde ${formatShortDate(contract.start_date)} · ` : ""}renova a cada ${contract.renewal_months} meses`;
  }
  if (!contract.end_date) return `Desde ${formatShortDate(contract.start_date!)} · prazo indeterminado`;
  return `${contract.start_date ? `${formatShortDate(contract.start_date)} → ` : "Até "}${formatShortDate(contract.end_date)}`;
}

export function contractValue(contract: SupplierContract): string | null {
  return contract.value == null ? null : `${formatBrl(contract.value)} ${VALUE_PERIOD_LABEL[contract.value_period]}`;
}

/* ------------------------------------------------------------- documentos */

function DocumentRow({
  doc,
  contractTitle,
  onDeleted,
  onError,
}: {
  doc: SupplierDocument;
  contractTitle?: string;
  onDeleted: (supplier: FacilitiesSupplier) => void;
  onError: (message: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayIso();
  const expired = doc.valid_until && doc.valid_until < today;
  const name = doc.title || doc.file_name || DOCUMENT_KIND_LABEL[doc.kind];

  async function open(download: boolean) {
    try {
      await openSupplierDocument(doc.id, download);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Não foi possível abrir o arquivo.");
    }
  }

  async function remove() {
    setBusy(true);
    try {
      onDeleted(await facilitiesApi.deleteDocument(doc.id));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Não foi possível remover.");
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#eef6f8] text-[#285f7a]" aria-hidden>
        {doc.has_file ? <FileText className="size-4" /> : <Link2 className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {[
            DOCUMENT_KIND_LABEL[doc.kind],
            contractTitle,
            doc.has_file ? null : "SharePoint",
          ]
            .filter(Boolean)
            .join(" · ")}
          {doc.valid_until && (
            <span className={cn(expired && "font-medium text-red-700")}> · validade {formatShortDate(doc.valid_until)}</span>
          )}
        </span>
      </span>
      {confirm ? (
        <span className="flex items-center gap-1">
          <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void remove()}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Remover
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>
            Manter
          </Button>
        </span>
      ) : (
        <span className="flex items-center">
          <Button type="button" size="icon" variant="ghost" aria-label={`Abrir ${name}`} onClick={() => void open(false)}>
            <ExternalLink className="size-4" />
          </Button>
          {doc.has_file && (
            <Button type="button" size="icon" variant="ghost" aria-label={`Baixar ${name}`} onClick={() => void open(true)}>
              <Download className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Remover ${name}`}
            className="text-red-700 hover:bg-red-50 hover:text-red-800"
            onClick={() => setConfirm(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </span>
      )}
    </li>
  );
}

/* ------------------------------------------------------------ abas (leitura) */

function SummaryTab({
  supplier,
  people,
  onOpenService,
  onOpenContract,
}: {
  supplier: FacilitiesSupplier;
  people: FacilitiesPerson[];
  onOpenService: (serviceId: string | null) => void;
  onOpenContract: (contractId: string | null) => void;
}) {
  const today = todayIso();
  const alerts = supplierAlerts(supplier, today);
  const monthly = monthlyCost(supplier.services);
  const activeServices = supplier.services
    .filter((s) => s.active)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  const openContracts = supplier.contracts.filter((c) => c.status !== "encerrado");
  const closedContracts = supplier.contracts.length - openContracts.length;
  const links: Array<{ href: string; label: string; icon: LucideIcon }> = [
    supplier.phone ? { href: `tel:${supplier.phone.replace(/\D/g, "")}`, label: supplier.phone, icon: Phone } : null,
    supplier.email ? { href: `mailto:${supplier.email}`, label: supplier.email, icon: Mail } : null,
    supplier.website_link ? { href: supplier.website_link, label: "Site", icon: Globe } : null,
    supplier.whatsapp_link ? { href: supplier.whatsapp_link, label: "WhatsApp", icon: MessageCircle } : null,
  ].filter((link): link is { href: string; label: string; icon: LucideIcon } => link !== null);

  return (
    <div className="space-y-6 px-6 py-5">
      {alerts.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>Pede atenção</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {alerts.map((alert, index) => (
              <AlertPill key={`${alert.kind}-${alert.contractId ?? alert.documentId}-${index}`} alert={alert} />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="rounded-md bg-[#f7fbfc] p-4 ring-1 ring-inset ring-[#e6eef0]">
          <p className="text-xs font-medium text-muted-foreground">Custo mensal</p>
          <p className="mt-1 text-[28px] font-semibold leading-8 text-[#10293a]">{monthly > 0 ? formatBrl(monthly) : "Eventual"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {activeServices.length
              ? `${activeServices.length} ${activeServices.length === 1 ? "serviço em uso" : "serviços em uso"}`
              : "Nenhum serviço registrado"}
          </p>
          {activeServices.length > 0 ? (
            <ul className="mt-3 space-y-0.5 border-t border-[#e6eef0] pt-2">
              {activeServices.slice(0, 3).map((service) => (
                <li key={service.id}>
                  <button
                    type="button"
                    onClick={() => onOpenService(service.id)}
                    className="flex w-full items-baseline gap-2 rounded px-1 py-1 text-left text-sm hover:bg-white focus-visible:bg-white focus-visible:outline-none"
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">{service.description}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {service.amount != null ? formatBrl(service.amount) : PERIODICITY_LABEL[service.periodicity]}
                    </span>
                  </button>
                </li>
              ))}
              {activeServices.length > 3 && <li className="px-1 text-xs text-muted-foreground">+{activeServices.length - 3} na aba Serviços</li>}
            </ul>
          ) : (
            <Button type="button" variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => onOpenService(null)}>
              <Plus className="size-4" />
              Registrar serviço
            </Button>
          )}
        </section>

        <section className="space-y-2">
          <SectionTitle>Contratos</SectionTitle>
          {openContracts.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#dce9eb] px-4 py-4">
              <p className="text-sm text-muted-foreground">
                {closedContracts ? `Nenhum contrato vigente (${closedContracts} encerrado${closedContracts > 1 ? "s" : ""}).` : "Nenhum contrato registrado."}
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => onOpenContract(null)}>
                <Plus className="size-4" />
                Cadastrar contrato
              </Button>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {openContracts.slice(0, 3).map((contract) => (
                <li key={contract.id}>
                  <button
                    type="button"
                    onClick={() => onOpenContract(contract.id)}
                    className="w-full rounded-md border border-[#e6eef0] px-3 py-2.5 text-left transition-colors hover:border-[#c9dde1] hover:bg-[#f6fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{contract.title}</span>
                      {contractValue(contract) && (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{contractValue(contract)}</span>
                      )}
                    </span>
                    <span className="mb-1.5 mt-0.5 block text-xs text-muted-foreground">{contractHeadline(contract, today)}</span>
                    <TermBar contract={contract} today={today} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="grid gap-4 border-t border-[#eef3f5] pt-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Responsável no escritório</p>
          <PersonFact people={people} id={supplier.responsible_user_id} />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Contato</p>
          {supplier.contact_name || links.length ? (
            <div className="space-y-1">
              {supplier.contact_name && <p className="text-sm font-medium text-foreground">{supplier.contact_name}</p>}
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[#285f7a] underline-offset-2 hover:underline"
                  >
                    <link.icon className="size-3.5" aria-hidden />
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem contato cadastrado</p>
          )}
        </div>
        {supplier.rating != null && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Avaliação</p>
            <SupplierRatingStars rating={supplier.rating} />
          </div>
        )}
        {supplier.city && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Cidade</p>
            <p className="text-sm font-medium text-foreground">{supplier.city}</p>
          </div>
        )}
        {supplier.events_count > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Eventos</p>
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Ticket className="size-3.5 text-[#48466e]" aria-hidden />
              Usado em {supplier.events_count} {supplier.events_count === 1 ? "evento" : "eventos"}
            </p>
          </div>
        )}
      </section>

      {supplier.notes && (
        <section className="space-y-2">
          <SectionTitle>Observações</SectionTitle>
          <p className="whitespace-pre-line rounded-md bg-[#f2f8f9] px-3 py-2 text-sm leading-6 text-foreground">{supplier.notes}</p>
        </section>
      )}
    </div>
  );
}

function ServicesTab({ supplier, onOpen }: { supplier: FacilitiesSupplier; onOpen: (serviceId: string | null) => void }) {
  const services = [...supplier.services].sort((a, b) => Number(b.active) - Number(a.active) || (b.amount ?? 0) - (a.amount ?? 0));
  return (
    <div className="space-y-3 px-6 py-5">
      <SectionTitle
        action={
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => onOpen(null)}>
            <Plus className="size-4" />
            Adicionar serviço
          </Button>
        }
      >
        O que é contratado
      </SectionTitle>
      {services.length === 0 ? (
        <EmptyLine icon={FileText}>Nenhum serviço registrado. Cadastre o que é pago a este fornecedor (valor, vencimento, área).</EmptyLine>
      ) : (
        <ul className="divide-y divide-[#eef3f5] rounded-md border border-[#e6eef0]">
          {services.map((service) => (
            <li key={service.id}>
              <button
                type="button"
                onClick={() => onOpen(service.id)}
                className={cn(
                  "flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-3 text-left transition-colors hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb] focus-visible:outline-none",
                  !service.active && "opacity-55"
                )}
              >
                <span className="min-w-0 flex-1 basis-56">
                  <span className="block truncate text-sm font-medium text-foreground">{service.description}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {service.area && <AreaChip area={service.area} />}
                    {service.shared_cost && (
                      <span className="rounded-full bg-[#eef3f5] px-2 py-0.5 text-xs text-muted-foreground">Rateado</span>
                    )}
                    {!service.active && <span className="text-xs text-muted-foreground">Encerrado</span>}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold tabular-nums text-foreground">
                    {service.amount != null ? formatBrl(service.amount) : "—"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {[
                      PERIODICITY_LABEL[service.periodicity],
                      service.due_day ? `dia ${service.due_day}` : null,
                      service.payment_method ? PAYMENT_METHOD_LABEL[service.payment_method] : null,
                      service.fiscal_document ? FISCAL_DOCUMENT_LABEL[service.fiscal_document] : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContractsTab({ supplier, onOpen }: { supplier: FacilitiesSupplier; onOpen: (contractId: string | null) => void }) {
  const today = todayIso();
  return (
    <div className="space-y-3 px-6 py-5">
      <SectionTitle
        action={
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => onOpen(null)}>
            <Plus className="size-4" />
            Novo contrato
          </Button>
        }
      >
        Contratos
      </SectionTitle>
      {supplier.contracts.length === 0 ? (
        <EmptyLine icon={FileSignature}>Nenhum contrato. Envie o PDF e a IA preenche as datas-chave.</EmptyLine>
      ) : (
        <ul className="divide-y divide-[#eef3f5] rounded-md border border-[#e6eef0]">
          {supplier.contracts.map((contract) => {
            const headline = contractHeadline(contract, today);
            const alerts = contractAlerts(contract, supplier.documents, today).filter((alert) => alert.title !== headline);
            const value = contractValue(contract);
            return (
              <li key={contract.id}>
                <button
                  type="button"
                  onClick={() => onOpen(contract.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb] focus-visible:outline-none",
                    contract.status === "encerrado" && "opacity-60"
                  )}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#eef6f8] text-[#285f7a]" aria-hidden>
                    <FileSignature className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="truncate text-sm font-medium text-foreground">{contract.title}</span>
                      {value && <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>}
                    </span>
                    <span className="mb-1.5 mt-0.5 block text-xs text-muted-foreground">
                      {headline} · {contractPeriod(contract)}
                    </span>
                    <TermBar contract={contract} today={today} />
                    {alerts.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {alerts.map((alert) => (
                          <AlertPill key={alert.kind} alert={alert} />
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DocumentsTab({
  supplier,
  onAdd,
  onSupplierChange,
  onError,
}: {
  supplier: FacilitiesSupplier;
  onAdd: () => void;
  onSupplierChange: (supplier: FacilitiesSupplier) => void;
  onError: (message: string) => void;
}) {
  const titles = new Map(supplier.contracts.map((contract) => [contract.id, contract.title]));
  return (
    <div className="space-y-3 px-6 py-5">
      <SectionTitle
        action={
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onAdd}>
            <Plus className="size-4" />
            Adicionar documento
          </Button>
        }
      >
        Documentos
      </SectionTitle>
      {supplier.documents.length === 0 ? (
        <EmptyLine icon={FileText}>Contratos, aditivos, cartão CNPJ, certidões — com validade, viram alerta.</EmptyLine>
      ) : (
        <ul className="divide-y divide-[#eef3f5] rounded-md border border-[#e6eef0]">
          {supplier.documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              contractTitle={doc.contract_id ? titles.get(doc.contract_id) : undefined}
              onDeleted={onSupplierChange}
              onError={onError}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------- contrato (leitura) */

function DateStep({
  icon: Icon,
  title,
  date,
  tone,
  children,
}: {
  icon: LucideIcon;
  title: string;
  date: string | null;
  tone: "done" | "next" | "muted";
  children?: ReactNode;
}) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      <span className="absolute bottom-0 left-[15px] top-8 w-px bg-[#dce9eb] [li:last-child_&]:hidden" aria-hidden />
      <span
        className={cn(
          "relative grid size-8 shrink-0 place-items-center rounded-full ring-1 ring-inset",
          tone === "done" && "bg-[#e8f8f8] text-[#285f7a] ring-[#47cdd0]/40",
          tone === "next" && "bg-amber-50 text-amber-700 ring-amber-200",
          tone === "muted" && "bg-white text-muted-foreground ring-[#dce9eb]"
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {date && <p className="text-xs tabular-nums text-muted-foreground">{formatShortDate(date)}</p>}
        </div>
        {children && <div className="mt-0.5 text-xs text-muted-foreground">{children}</div>}
      </div>
    </li>
  );
}

function ContractDetail({
  supplier,
  contract,
  people,
  onAddDocument,
  onSupplierChange,
  onError,
}: {
  supplier: FacilitiesSupplier;
  contract: SupplierContract;
  people: FacilitiesPerson[];
  onAddDocument: () => void;
  onSupplierChange: (supplier: FacilitiesSupplier) => void;
  onError: (message: string) => void;
}) {
  const today = todayIso();
  const alerts = contractAlerts(contract, supplier.documents, today);
  const end = currentTermEnd(contract, today);
  const deadline = noticeDeadline(contract, today);
  const adjustment = nextAdjustment(contract, today);
  const documents = supplier.documents.filter((doc) => doc.contract_id === contract.id);
  const value = contractValue(contract);
  const term = termProgress(contract, today);

  return (
    <div className="space-y-6 px-6 py-5">
      <section className="rounded-md bg-[#f7fbfc] p-4 ring-1 ring-inset ring-[#e6eef0]">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{CONTRACT_STATUS_LABEL[contract.status]}</p>
            <p className="text-xl font-semibold text-[#10293a]">{contractHeadline(contract, today)}</p>
          </div>
          {contract.status === "vigente" && term.daysLeft !== null && (
            <p className="text-sm tabular-nums text-muted-foreground">
              {term.daysLeft >= 0 ? `faltam ${term.daysLeft} ${term.daysLeft === 1 ? "dia" : "dias"}` : `há ${-term.daysLeft} dias`}
            </p>
          )}
        </div>
        <TermBar contract={contract} today={today} size="lg" className="mt-3" />
        {term.notice !== null && contract.status === "vigente" && deadline && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-3 w-0.5 rounded-full bg-[#10293a]" aria-hidden />
            Prazo de aviso prévio: {formatShortDate(deadline)}
          </p>
        )}
        {alerts.some((alert) => alert.title !== contractHeadline(contract, today)) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {alerts
              .filter((alert) => alert.title !== contractHeadline(contract, today))
              .map((alert) => (
                <AlertPill key={alert.kind} alert={alert} />
              ))}
          </div>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md bg-[#fafcfc] px-4 py-3 ring-1 ring-inset ring-[#e6eef0] sm:grid-cols-3">
        <Fact label="Valor">{value ?? "—"}</Fact>
        <Fact label="Formalização">{FORMALIZATION_LABEL[contract.formalization]}</Fact>
        <Fact label="Contratante">{contract.contracting_party ?? "—"}</Fact>
        <Fact label="Reajuste">
          {contract.adjustment_index
            ? `${ADJUSTMENT_INDEX_LABEL[contract.adjustment_index]}${contract.adjustment_month ? ` em ${MONTH_LABELS[contract.adjustment_month - 1]}` : ""}`
            : "—"}
        </Fact>
        <div className="col-span-2 min-w-0">
          <dt className="text-xs text-muted-foreground">Gestor do contrato</dt>
          <dd className="mt-0.5">
            <PersonFact people={people} id={contract.responsible_user_id} />
          </dd>
        </div>
      </dl>

      {contract.object && (
        <section className="space-y-2">
          <SectionTitle>Objeto</SectionTitle>
          <p className="text-sm leading-6 text-foreground">{contract.object}</p>
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle>Datas-chave</SectionTitle>
        {!contract.start_date && !contract.end_date ? (
          <EmptyLine icon={CalendarRange}>Vigência não preenchida. Edite o contrato ou envie o PDF para a IA ler.</EmptyLine>
        ) : (
          <ol>
            {contract.start_date && <DateStep icon={CalendarRange} title="Início da vigência" date={contract.start_date} tone="done" />}
            {deadline && end && (
              <DateStep
                icon={CalendarClock}
                title={contract.auto_renew ? "Último dia para avisar que não vai renovar" : "Último dia para avisar o encerramento"}
                date={deadline}
                tone={deadline >= today ? "next" : "muted"}
              >
                Aviso prévio de {contract.notice_days} dias.
              </DateStep>
            )}
            {adjustment && (
              <DateStep icon={RefreshCw} title={`Reajuste anual em ${MONTH_LABELS[adjustment.month - 1]}`} date={null} tone="muted">
                {adjustment.monthsAhead === 0 ? "Neste mês." : `Daqui a ${adjustment.monthsAhead} ${adjustment.monthsAhead === 1 ? "mês" : "meses"}.`}
              </DateStep>
            )}
            <DateStep
              icon={contract.auto_renew ? RefreshCw : CalendarRange}
              title={end ? (contract.auto_renew ? "Renova automaticamente" : "Fim da vigência") : "Prazo indeterminado"}
              date={end}
              tone={end && end >= today ? "next" : "muted"}
            >
              {contract.auto_renew && contract.renewal_months ? `Por mais ${contract.renewal_months} meses a cada renovação.` : null}
            </DateStep>
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle
          action={
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onAddDocument}>
              <Plus className="size-4" />
              Arquivo
            </Button>
          }
        >
          Arquivos
        </SectionTitle>
        {contract.sharepoint_url && (
          <a
            href={contract.sharepoint_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md border border-[#e6eef0] px-3 py-2.5 text-sm text-[#285f7a] hover:bg-[#f6fafb]"
          >
            <Link2 className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">Arquivo no SharePoint</span>
            <ExternalLink className="size-4 shrink-0" aria-hidden />
          </a>
        )}
        {documents.length > 0 ? (
          <ul className="divide-y divide-[#eef3f5] rounded-md border border-[#e6eef0]">
            {documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} onDeleted={onSupplierChange} onError={onError} />
            ))}
          </ul>
        ) : (
          !contract.sharepoint_url && <EmptyLine icon={FileText}>Sem arquivo. Envie o PDF ou cole o link do SharePoint.</EmptyLine>
        )}
      </section>

      {contract.notes && (
        <section className="space-y-2">
          <SectionTitle>Observações</SectionTitle>
          <p className="whitespace-pre-line rounded-md bg-[#f2f8f9] px-3 py-2 text-sm leading-6 text-foreground">{contract.notes}</p>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- modal */

export function SupplierDialog({
  supplier: initialSupplier,
  initialView,
  people,
  onClose,
  onSaved,
  onDeleted,
}: {
  /** null = novo fornecedor. */
  supplier: FacilitiesSupplier | null;
  initialView?: SupplierView;
  people: FacilitiesPerson[];
  onClose: () => void;
  onSaved: (supplier: FacilitiesSupplier) => void;
  onDeleted: (id: string) => void;
}) {
  const [supplier, setSupplier] = useState(initialSupplier);
  const [view, setView] = useState<SupplierView>(
    initialView ?? (initialSupplier ? { kind: "supplier", mode: "view", tab: "resumo" } : { kind: "supplier", mode: "edit", tab: "resumo" })
  );
  const [supplierForm, setSupplierForm] = useState<SupplierInput>(() =>
    initialSupplier ? supplierToInput(initialSupplier) : emptySupplierInput()
  );
  const [serviceForm, setServiceForm] = useState<ServiceInput | null>(() => {
    if (initialView?.kind !== "service" || !initialSupplier) return null;
    const service = initialSupplier.services.find((s) => s.id === initialView.serviceId);
    return service ? serviceToInput(service) : emptyServiceInput(initialSupplier);
  });
  const [contractForm, setContractForm] = useState<ContractInput | null>(() => {
    if (initialView?.kind !== "contract" || !initialSupplier) return null;
    const contract = initialSupplier.contracts.find((c) => c.id === initialView.contractId);
    return contract ? contractToInput(contract) : emptyContractInput(initialSupplier);
  });
  const [attachIds, setAttachIds] = useState<string[]>([]);
  const [documentDraft, setDocumentDraft] = useState<DocumentDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function go(next: SupplierView) {
    setView(next);
    setConfirmDelete(false);
    setError(null);
  }

  function applySupplier(next: FacilitiesSupplier) {
    setSupplier(next);
    onSaved(next);
  }

  function openService(serviceId: string | null) {
    if (!supplier) return;
    const service = serviceId ? supplier.services.find((s) => s.id === serviceId) : null;
    setServiceForm(service ? serviceToInput(service) : emptyServiceInput(supplier));
    go({ kind: "service", serviceId });
  }

  function openContract(contractId: string | null, mode: "view" | "edit" = contractId ? "view" : "edit") {
    if (!supplier) return;
    const contract = contractId ? supplier.contracts.find((c) => c.id === contractId) : null;
    setContractForm(contract ? contractToInput(contract) : emptyContractInput(supplier));
    setAttachIds([]);
    go({ kind: "contract", contractId, mode });
  }

  function openDocument(contractId: string | null) {
    setDocumentDraft(emptyDocumentDraft(contractId));
    go({ kind: "document", contractId, back: view });
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

  const saveSupplier = () =>
    run(async () => {
      const missing = supplierMissing(supplierForm);
      if (missing) throw new Error(missing);
      const saved = supplier
        ? await facilitiesApi.updateSupplier(supplier.id, supplierForm)
        : await facilitiesApi.createSupplier(supplierForm);
      applySupplier(saved);
      setSupplierForm(supplierToInput(saved));
      go({ kind: "supplier", mode: "view", tab: "resumo" });
    });

  const deleteSupplier = () =>
    run(async () => {
      if (!supplier) return;
      await facilitiesApi.deleteSupplier(supplier.id);
      onDeleted(supplier.id);
    });

  const saveService = () =>
    run(async () => {
      if (!supplier || !serviceForm || view.kind !== "service") return;
      if (!serviceForm.description.trim()) throw new Error("Descreva o serviço.");
      const saved = view.serviceId
        ? await facilitiesApi.updateService(view.serviceId, serviceForm)
        : await facilitiesApi.createService(supplier.id, serviceForm);
      applySupplier(saved);
      go({ kind: "supplier", mode: "view", tab: "servicos" });
    });

  const deleteService = () =>
    run(async () => {
      if (view.kind !== "service" || !view.serviceId) return;
      applySupplier(await facilitiesApi.deleteService(view.serviceId));
      go({ kind: "supplier", mode: "view", tab: "servicos" });
    });

  const saveContract = () =>
    run(async () => {
      if (!supplier || !contractForm || view.kind !== "contract") return;
      const missing = contractMissing(contractForm);
      if (missing) throw new Error(missing);
      const before = new Set(supplier.contracts.map((c) => c.id));
      const saved = view.contractId
        ? await facilitiesApi.updateContract(view.contractId, contractForm, attachIds)
        : await facilitiesApi.createContract(supplier.id, contractForm, attachIds);
      applySupplier(saved);
      setAttachIds([]);
      const id = view.contractId ?? saved.contracts.find((c) => !before.has(c.id))?.id ?? null;
      const contract = saved.contracts.find((c) => c.id === id);
      if (contract) {
        setContractForm(contractToInput(contract));
        go({ kind: "contract", contractId: contract.id, mode: "view" });
      } else {
        go({ kind: "supplier", mode: "view", tab: "contratos" });
      }
    });

  const deleteContract = () =>
    run(async () => {
      if (view.kind !== "contract" || !view.contractId) return;
      applySupplier(await facilitiesApi.deleteContract(view.contractId));
      go({ kind: "supplier", mode: "view", tab: "contratos" });
    });

  const saveDocument = () =>
    run(async () => {
      if (!supplier || !documentDraft || view.kind !== "document") return;
      const base = {
        supplier_id: supplier.id,
        contract_id: documentDraft.contract_id,
        kind: documentDraft.kind,
        title: documentDraft.title,
        valid_until: documentDraft.valid_until,
      };
      let result: { supplier: FacilitiesSupplier };
      if (documentDraft.mode === "arquivo") {
        if (!documentDraft.file) throw new Error("Escolha o arquivo.");
        result = await uploadSupplierFile({
          supplierId: supplier.id,
          contractId: base.contract_id,
          kind: base.kind,
          title: base.title,
          validUntil: base.valid_until,
          file: documentDraft.file,
        });
      } else {
        if (!/^https?:\/\//i.test(documentDraft.external_url.trim())) throw new Error("Cole o link completo (https://...).");
        result = await facilitiesApi.addLink({ ...base, external_url: documentDraft.external_url.trim() });
      }
      applySupplier(result.supplier);
      go(view.back);
    });

  /* --------------------------------------------------------------- render */

  const currentContract =
    view.kind === "contract" && supplier && view.contractId ? supplier.contracts.find((c) => c.id === view.contractId) : null;

  const backToSupplier = (tab: SupplierTab) => go({ kind: "supplier", mode: "view", tab });

  let header: ReactNode;
  let body: ReactNode;
  let footer: ReactNode;

  const deleteControls = (label: string, onConfirm: () => void) =>
    confirmDelete ? (
      <div className="flex items-center gap-2">
        <Button type="button" variant="destructive" disabled={saving} onClick={onConfirm}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Confirmar exclusão
        </Button>
        <Button type="button" variant="ghost" disabled={saving} onClick={() => setConfirmDelete(false)}>
          Manter
        </Button>
      </div>
    ) : (
      <Button
        type="button"
        variant="ghost"
        aria-label={label}
        className="gap-2 px-3 text-red-700 hover:bg-red-50 hover:text-red-800"
        disabled={saving}
        onClick={() => setConfirmDelete(true)}
      >
        <Trash2 className="size-4" />
        <span className="hidden sm:inline">Excluir</span>
      </Button>
    );

  const saveButtons = (label: string, onSave: () => void, onCancel: () => void) => (
    <div className="flex gap-2">
      <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="button" disabled={saving || confirmDelete} onClick={onSave}>
        {saving && !confirmDelete && <Loader2 className="size-4 animate-spin" />}
        {label}
      </Button>
    </div>
  );

  const subHeader = (title: string, description: string, back: () => void) => (
    <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-4 pr-14 text-left">
      <button
        type="button"
        onClick={back}
        disabled={saving}
        className="-ml-1 inline-flex w-fit items-center gap-1 rounded px-1 text-xs font-medium text-[#285f7a] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {supplier?.name}
      </button>
      <DialogTitle className="text-lg">{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
  );

  if (view.kind === "supplier" && (view.mode === "edit" || !supplier)) {
    header = (
      <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
        <DialogTitle className="text-lg">{supplier ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
        <DialogDescription>Um cadastro por CNPJ/CPF. Serviços, contratos e documentos entram depois de salvar.</DialogDescription>
      </DialogHeader>
    );
    body = <SupplierForm form={supplierForm} people={people} onChange={setSupplierForm} />;
    footer = (
      <>
        <div />
        {saveButtons(supplier ? "Salvar alterações" : "Cadastrar fornecedor", () => void saveSupplier(), () => {
          if (!supplier) return onClose();
          setSupplierForm(supplierToInput(supplier));
          go({ kind: "supplier", mode: "view", tab: "resumo" });
        })}
      </>
    );
  } else if (view.kind === "supplier" && supplier) {
    header = (
      <DialogHeader className="gap-0 border-b border-[#e6eef0] px-6 pb-0 pt-5 pr-14 text-left">
        <div className="flex items-start gap-4">
          <SupplierMonogram name={supplier.name} category={supplier.category} size="lg" />
          <div className="min-w-0 space-y-1.5">
            <DialogTitle className="truncate text-lg">{supplier.name}</DialogTitle>
            <DialogDescription className="mt-0 truncate">
              {[displayLegalName(supplier.legal_name), documentLabel(supplier.document)].filter(Boolean).join(" · ") ||
                supplierCategoryLabel(supplier.category)}
            </DialogDescription>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eef3f5] px-2 py-0.5 text-xs font-medium text-[#285f7a]">
                <CategoryGlyph category={supplier.category} className="size-3" />
                {supplierCategoryLabel(supplier.category)}
              </span>
              {supplier.areas.map((area) => (
                <AreaChip key={area} area={area} />
              ))}
              {!supplier.active && <StatusDot tone="muted" label="Inativo" />}
              {supplier.events_count > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Ticket className="size-3" aria-hidden />
                  {supplier.events_count} {supplier.events_count === 1 ? "evento" : "eventos"}
                </span>
              )}
            </div>
          </div>
        </div>
        <div role="tablist" aria-label="Seções do fornecedor" className="-mb-px mt-4 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const count =
              tab.key === "servicos"
                ? supplier.services.length
                : tab.key === "contratos"
                  ? supplier.contracts.length
                  : tab.key === "documentos"
                    ? supplier.documents.length
                    : null;
            const selected = view.tab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => go({ kind: "supplier", mode: "view", tab: tab.key })}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]/50",
                  selected ? "border-[#347796] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {count !== null && <span className="rounded-full bg-[#eef3f5] px-1.5 text-xs tabular-nums text-muted-foreground">{count}</span>}
              </button>
            );
          })}
        </div>
      </DialogHeader>
    );
    body =
      view.tab === "resumo" ? (
        <SummaryTab supplier={supplier} people={people} onOpenService={openService} onOpenContract={(id) => openContract(id)} />
      ) : view.tab === "servicos" ? (
        <ServicesTab supplier={supplier} onOpen={openService} />
      ) : view.tab === "contratos" ? (
        <ContractsTab supplier={supplier} onOpen={(id) => openContract(id)} />
      ) : (
        <DocumentsTab supplier={supplier} onAdd={() => openDocument(null)} onSupplierChange={applySupplier} onError={setError} />
      );
    footer = (
      <>
        {deleteControls("Excluir fornecedor", () => void deleteSupplier())}
        <Button type="button" className="gap-2" disabled={confirmDelete} onClick={() => go({ kind: "supplier", mode: "edit", tab: view.tab })}>
          <PencilLine className="size-4" />
          Editar cadastro
        </Button>
      </>
    );
  } else if (view.kind === "service" && supplier && serviceForm) {
    header = subHeader(
      view.serviceId ? "Editar serviço" : "Novo serviço",
      "Linha de custo: o que é pago, quanto, quando e de qual área.",
      () => backToSupplier("servicos")
    );
    body = <ServiceForm form={serviceForm} onChange={setServiceForm} />;
    footer = (
      <>
        {view.serviceId ? deleteControls("Excluir serviço", () => void deleteService()) : <div />}
        {saveButtons(view.serviceId ? "Salvar serviço" : "Adicionar serviço", () => void saveService(), () => backToSupplier("servicos"))}
      </>
    );
  } else if (view.kind === "contract" && supplier && contractForm) {
    if (view.mode === "view" && currentContract) {
      header = subHeader(
        currentContract.title,
        `${CONTRACT_STATUS_LABEL[currentContract.status]} · ${contractPeriod(currentContract)}`,
        () => backToSupplier("contratos")
      );
      body = (
        <ContractDetail
          supplier={supplier}
          contract={currentContract}
          people={people}
          onAddDocument={() => openDocument(currentContract.id)}
          onSupplierChange={applySupplier}
          onError={setError}
        />
      );
      footer = (
        <>
          {deleteControls("Excluir contrato", () => void deleteContract())}
          <Button type="button" className="gap-2" disabled={confirmDelete} onClick={() => go({ ...view, mode: "edit" })}>
            <PencilLine className="size-4" />
            Editar contrato
          </Button>
        </>
      );
    } else {
      header = subHeader(
        view.contractId ? "Editar contrato" : "Novo contrato",
        "Datas-chave viram alertas: aviso prévio, vencimento e reajuste.",
        () => (view.contractId ? go({ ...view, mode: "view" }) : backToSupplier("contratos"))
      );
      body = (
        <ContractForm
          supplier={supplier}
          contractId={view.contractId}
          form={contractForm}
          people={people}
          onChange={setContractForm}
          onSupplierChange={applySupplier}
          onAttach={(id) => setAttachIds((ids) => [...ids, id])}
        />
      );
      footer = (
        <>
          <div />
          {saveButtons(view.contractId ? "Salvar contrato" : "Cadastrar contrato", () => void saveContract(), () => {
            if (currentContract) {
              setContractForm(contractToInput(currentContract));
              go({ ...view, mode: "view" });
            } else backToSupplier("contratos");
          })}
        </>
      );
    }
  } else if (view.kind === "document" && supplier && documentDraft) {
    header = subHeader("Adicionar documento", "Arquivo no sistema ou link do SharePoint enquanto ele não é migrado.", () => go(view.back));
    body = <DocumentForm draft={documentDraft} contracts={supplier.contracts} onChange={setDocumentDraft} />;
    footer = (
      <>
        <div />
        {saveButtons("Adicionar", () => void saveDocument(), () => go(view.back))}
      </>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      {/* Altura mínima: trocar de aba não faz o modal pular de tamanho. */}
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:min-h-[min(34rem,90dvh)] sm:max-w-2xl" showCloseButton={!saving}>
        {header}
        {/* key: trocar de tela no modal volta a rolagem para o topo. */}
        <div key={JSON.stringify(view)} className="min-h-0 flex-1 overflow-y-auto">
          {body}
        </div>
        {error && (
          <p role="alert" className="mx-6 mb-3 mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6eef0] bg-[#fafcfc] px-6 py-4">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}
