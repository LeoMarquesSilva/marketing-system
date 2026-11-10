"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Armchair,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  Flower2,
  Gift,
  Hourglass,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeGuestText } from "@/lib/event-guest-import";
import { BUDGET_PAYMENT_LABEL, formatBrl, type BudgetManagedBy, type EventBudgetItem, type EventInvite } from "@/lib/eventos";
import {
  attentionPoints,
  budgetTotals,
  groupBudget,
  paymentState,
  paymentTotals,
  sortPayments,
  transportPlan,
  type BudgetCategoryGroup,
  type BudgetScopeGroup,
  type BudgetVendorGroup,
  type EventPayment,
  type PaymentState,
} from "@/lib/eventos-orcamento";
import { deleteEventPayment, fetchEventPayments, saveEventPayment, type PaymentInput } from "@/lib/eventos-orcamento-db";
import { cn } from "@/lib/utils";
import { EventoPagamentoDialog } from "./evento-pagamento-dialog";
import { EventoTransporteCard } from "./evento-transporte-card";
import { TermLabel } from "./term-hint";

const CARD = "rounded-lg border border-[#dce9eb] bg-card shadow-[0_1px_2px_rgba(3,32,47,0.05)]";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  catering: UtensilsCrossed,
  decoracao: Flower2,
  locacao: Armchair,
  fornecedor: Users,
  brindes: Gift,
  outros: Package,
};

const SCOPE_TEXT: Record<BudgetManagedBy, { title: string; hint: string; icon: LucideIcon; tone: string }> = {
  escritorio: {
    title: "Por nossa conta",
    hint: "Contratamos direto: orçar, aprovar, pagar e receber é com a gente.",
    icon: Building2,
    tone: "bg-[#eaf5f7] text-[#285f73]",
  },
  produtora: {
    title: "Pacote da produtora",
    hint: "A produtora contrata e coordena; nós acompanhamos a entrega e pagamos as parcelas.",
    icon: PackageCheck,
    tone: "bg-[#48466e]/10 text-[#48466e]",
  },
};

const PAYMENT_CHIP: Record<PaymentState, string> = {
  pago: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  vencido: "bg-rose-50 text-rose-800 ring-rose-200",
  proximo: "bg-amber-50 text-amber-800 ring-amber-200",
  futuro: "bg-slate-50 text-slate-700 ring-slate-200",
  sem_data: "bg-amber-50 text-amber-800 ring-amber-200",
};

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function formatDay(iso: string | null): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}

function paymentLabel(payment: EventPayment, state: PaymentState): string {
  if (state === "pago") return payment.paidDate ? `Pago em ${formatDay(payment.paidDate)}` : "Pago";
  if (state === "sem_data") return "Data a definir";
  if (state === "vencido") return `Venceu em ${formatDay(payment.dueDate)}`;
  return `Vence em ${formatDay(payment.dueDate)}`;
}

function Tile({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: React.ReactNode; value: number; detail?: string; tone: string }) {
  return (
    <div className={cn(CARD, "flex items-center gap-3 p-4")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-md", tone)} aria-hidden>
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{formatBrl(value)}</p>
        {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}

function BudgetLine({
  item,
  showCategory,
  onEdit,
  onDelete,
}: {
  item: EventBudgetItem;
  showCategory: boolean;
  onEdit: (item: EventBudgetItem) => void;
  onDelete: (id: string) => void;
}) {
  const Icon = CATEGORY_ICON[item.category] ?? Package;
  const included = item.managedBy === "produtora" && item.amountPlanned === 0;
  const quotedDiffers = item.amountQuoted != null && item.amountQuoted !== item.amountPlanned;
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-3">
      {showCategory && (
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground" aria-hidden>
          <Icon className="size-3.5" />
        </span>
      )}
      <div className="min-w-48 flex-1">
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="text-left text-sm font-medium leading-5 text-foreground hover:text-[#347796] hover:underline focus-visible:outline-2 focus-visible:outline-[#47cdd0]"
        >
          {item.description?.trim() || "Despesa sem descrição"}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          {item.approvalStatus === "em_analise" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
              <Hourglass className="size-3" aria-hidden />
              Em análise
            </span>
          )}
          {item.paymentStatus !== "pendente" && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
              {BUDGET_PAYMENT_LABEL[item.paymentStatus]}
            </span>
          )}
          {item.invoiceLink && (
            <a href={item.invoiceLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#347796] hover:underline">
              <ExternalLink className="size-3" aria-hidden />
              NF
            </a>
          )}
          {item.receiptLink && (
            <a href={item.receiptLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#347796] hover:underline">
              <ExternalLink className="size-3" aria-hidden />
              Comprovante
            </a>
          )}
        </div>
        {item.attentionNote && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-amber-800">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {item.attentionNote}
          </p>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-start gap-1">
        <div className="pr-1 text-right">
          <p className="text-sm font-semibold tabular-nums text-foreground">{included ? "Incluso" : formatBrl(item.amountPlanned)}</p>
          {quotedDiffers && <p className="text-xs tabular-nums text-muted-foreground">cotado {formatBrl(item.amountQuoted ?? 0)}</p>}
        </div>
        <Button size="icon-sm" variant="ghost" aria-label={`Editar ${item.description || "despesa"}`} onClick={() => onEdit(item)}>
          <Pencil className="size-4" />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label={`Excluir ${item.description || "despesa"}`} onClick={() => onDelete(item.id)}>
          <Trash2 className="size-4 text-rose-600" />
        </Button>
      </div>
    </li>
  );
}

function CategorySection({
  group,
  open,
  onToggle,
  onEdit,
  onDelete,
}: {
  group: BudgetCategoryGroup;
  open: boolean;
  onToggle: () => void;
  onEdit: (item: EventBudgetItem) => void;
  onDelete: (id: string) => void;
}) {
  const Icon = CATEGORY_ICON[group.category] ?? Package;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors hover:bg-[#47cdd0]/8 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-[#47cdd0]/40"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground" aria-hidden>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{group.label}</span>
          <span className="block text-xs text-muted-foreground">
            {group.items.length} {group.items.length === 1 ? "item" : "itens"}
          </span>
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">{formatBrl(group.total)}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul className="divide-y divide-[#eef3f4] border-t border-[#eef3f4] bg-[#fafcfc]">
          {group.items.map((item) => (
            <BudgetLine key={item.id} item={item} showCategory={false} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </div>
  );
}

function VendorCard({
  vendor,
  byCategory,
  openKeys,
  onToggle,
  onEdit,
  onDelete,
}: {
  vendor: BudgetVendorGroup;
  /** Pacote grande: mostra por categoria, recolhido. Senão, as linhas direto. */
  byCategory: boolean;
  openKeys: Set<string>;
  onToggle: (key: string) => void;
  onEdit: (item: EventBudgetItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={cn(CARD, "overflow-hidden")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#e6eef0] px-4 py-3">
        <div className="min-w-40 flex-1">
          <h4 className="text-sm font-semibold text-foreground">{vendor.vendor}</h4>
          <p className="text-xs text-muted-foreground">
            {vendor.items.length} {vendor.items.length === 1 ? "item" : "itens"}
            {vendor.attention ? ` · ${vendor.attention} ${vendor.attention === 1 ? "ponto de atenção" : "pontos de atenção"}` : ""}
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-right">
          {vendor.approved > 0 && (
            <div>
              <dt className="text-xs text-muted-foreground">Aprovado</dt>
              <dd className="text-sm font-semibold tabular-nums text-foreground">{formatBrl(vendor.approved)}</dd>
            </div>
          )}
          {vendor.pending > 0 && (
            <div>
              <dt className="text-xs text-amber-800">Em análise</dt>
              <dd className="text-sm font-semibold tabular-nums text-amber-900">{formatBrl(vendor.pending)}</dd>
            </div>
          )}
        </dl>
      </div>
      {byCategory ? (
        <div className="divide-y divide-[#e6eef0]">
          {vendor.categories.map((group) => {
            const key = `${vendor.vendor}:${group.category}`;
            return <CategorySection key={key} group={group} open={openKeys.has(key)} onToggle={() => onToggle(key)} onEdit={onEdit} onDelete={onDelete} />;
          })}
        </div>
      ) : (
        <ul className="divide-y divide-[#eef3f4]">
          {vendor.items.map((item) => (
            <BudgetLine key={item.id} item={item} showCategory onEdit={onEdit} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ScopeSection({
  scope,
  openKeys,
  onToggle,
  onEdit,
  onDelete,
}: {
  scope: BudgetScopeGroup;
  openKeys: Set<string>;
  onToggle: (key: string) => void;
  onEdit: (item: EventBudgetItem) => void;
  onDelete: (id: string) => void;
}) {
  const text = SCOPE_TEXT[scope.managedBy];
  const Icon = text.icon;
  const producers = scope.managedBy === "produtora" ? scope.vendors.map((vendor) => vendor.vendor).join(", ") : "";
  return (
    <section aria-label={text.title} className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-md", text.tone)} aria-hidden>
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-48 flex-1">
          <h3 className="text-base font-semibold text-foreground">
            {text.title}
            {producers ? ` · ${producers}` : ""}
          </h3>
          <p className="text-xs text-muted-foreground">{text.hint}</p>
        </div>
        <p className="text-right text-sm text-muted-foreground">
          <span className="block text-base font-semibold tabular-nums text-foreground">{formatBrl(scope.approved + scope.pending)}</span>
          {scope.pending > 0 ? `${formatBrl(scope.pending)} em análise` : `${scope.count} ${scope.count === 1 ? "item" : "itens"}`}
        </p>
      </div>
      {scope.vendors.map((vendor) => (
        <VendorCard
          key={vendor.vendor}
          vendor={vendor}
          byCategory={scope.managedBy === "produtora" && vendor.items.length > 6}
          openKeys={openKeys}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </section>
  );
}

export function EventoOrcamentoTab({
  eventId,
  budgetItems,
  invites,
  onRaiseAmount,
  onCreate,
  onEdit,
  onDelete,
}: {
  eventId: string;
  budgetItems: EventBudgetItem[];
  /** Convidados do evento: os pedidos de transporte definem quantos veículos. */
  invites: EventInvite[];
  onRaiseAmount: (item: EventBudgetItem, amount: number) => Promise<void>;
  onCreate: () => void;
  onEdit: (item: EventBudgetItem) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [payments, setPayments] = useState<EventPayment[]>([]);
  const [paymentDialog, setPaymentDialog] = useState<{ payment: EventPayment | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const day = today();

  useEffect(() => {
    let cancelled = false;
    void fetchEventPayments(eventId).then((list) => {
      if (!cancelled) setPayments(list);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const term = normalizeGuestText(search);
  const filtered = useMemo(
    () =>
      budgetItems.filter(
        (item) =>
          (!onlyPending || item.approvalStatus === "em_analise") &&
          (!term || normalizeGuestText(`${item.description ?? ""} ${item.vendorName ?? ""} ${item.category} ${item.attentionNote ?? ""}`).includes(term))
      ),
    [budgetItems, onlyPending, term]
  );
  const totals = useMemo(() => budgetTotals(budgetItems), [budgetItems]);
  const scopes = useMemo(() => groupBudget(filtered), [filtered]);
  const paid = useMemo(() => paymentTotals(payments), [payments]);
  const alerts = useMemo(() => attentionPoints(budgetItems, payments, day), [budgetItems, payments, day]);
  const orderedPayments = useMemo(() => sortPayments(payments), [payments]);
  const discarded = budgetItems.filter((item) => item.approvalStatus === "descartado");
  // Despesa cobrada por veículo: a conta sai dos pedidos de transporte da confirmação da equipe.
  const transport = useMemo(() => {
    const line = budgetItems.find((item) => item.approvalStatus !== "descartado" && item.unitAmount && item.unitSeats);
    const plan = line ? transportPlan(line, invites) : null;
    return line && plan ? { line, plan } : null;
  }, [budgetItems, invites]);
  const reserve = transport?.plan.reserve ?? 0;
  // Com busca ou filtro, as categorias do pacote abrem para mostrar o que foi encontrado.
  const filtering = Boolean(term) || onlyPending;

  const toggle = (key: string) =>
    setOpenKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allKeys = useMemo(
    () => new Set(scopes.flatMap((scope) => scope.vendors.flatMap((vendor) => vendor.categories.map((group) => `${vendor.vendor}:${group.category}`)))),
    [scopes]
  );

  const savePayment = async (input: PaymentInput, id?: string) => {
    setBusy(true);
    const saved = await saveEventPayment(eventId, input, id);
    setBusy(false);
    if (!saved) return false;
    setPayments((current) => (id ? current.map((payment) => (payment.id === id ? saved : payment)) : [...current, saved]));
    return true;
  };

  const togglePaid = (payment: EventPayment) =>
    void savePayment(
      { vendorName: payment.vendorName, description: payment.description, amount: payment.amount, dueDate: payment.dueDate, notes: payment.notes, paid: !payment.paid, paidDate: payment.paid ? null : day },
      payment.id
    );

  const editBudgetById = (id?: string) => {
    const item = budgetItems.find((entry) => entry.id === id);
    if (item) onEdit(item);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            <TermLabel term="orcamento">Orçamento do evento</TermLabel>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">O que é por nossa conta, o que vem no pacote da produtora, os pagamentos e o que pede atenção.</p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="size-4" />
          Adicionar despesa
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={Check} label="Aprovado" value={totals.approved} detail="Comprometido" tone="bg-emerald-50 text-emerald-700" />
        <Tile icon={Hourglass} label="Em análise" value={totals.pending} detail="Cotado, aguardando aprovação" tone="bg-amber-50 text-amber-700" />
        <Tile
          icon={Wallet}
          label="Total previsto"
          value={totals.projected + reserve}
          detail={reserve > 0 ? `Aprovado + em análise + ${formatBrl(reserve)} de reserva do transporte` : "Aprovado + em análise"}
          tone="bg-[#eaf5f7] text-[#285f73]"
        />
        <Tile icon={CircleDollarSign} label="Pago" value={paid.paid} detail={`${formatBrl(paid.open)} a pagar no calendário`} tone="bg-slate-100 text-slate-600" />
      </div>

      {alerts.length > 0 && (
        <section aria-label="Pontos de atenção" className={cn(CARD, "overflow-hidden")}>
          <div className="flex items-center gap-2.5 border-b border-[#e6eef0] px-4 py-3">
            <TriangleAlert className="size-4 shrink-0 text-amber-600" aria-hidden />
            <h3 className="text-sm font-semibold text-foreground">Pontos de atenção</h3>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">{alerts.length}</span>
          </div>
          <ul className="grid gap-x-6 divide-y divide-[#eef3f4] md:grid-cols-2 md:divide-y-0">
            {alerts.map((point) => (
              <li key={point.key} className="flex items-start gap-3 px-4 py-2.5 md:border-b md:border-[#eef3f4]">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-amber-50 text-amber-700" aria-hidden>
                  {point.kind === "pagamento" ? <CalendarClock className="size-3.5" /> : <Package className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  {point.kind === "despesa" ? (
                    <button type="button" onClick={() => editBudgetById(point.budgetItemId)} className="text-left text-sm font-medium text-foreground hover:text-[#347796] hover:underline">
                      {point.title}
                    </button>
                  ) : (
                    <p className="text-sm font-medium text-foreground">{point.title}</p>
                  )}
                  <p className="text-xs leading-5 text-muted-foreground">{point.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {transport && (
        <EventoTransporteCard
          title={transport.line.description?.trim() || "Transporte"}
          plan={transport.plan}
          busy={busy}
          onEditLine={() => onEdit(transport.line)}
          onRaiseLine={async (amount) => {
            setBusy(true);
            await onRaiseAmount(transport.line, amount);
            setBusy(false);
          }}
        />
      )}

      <section aria-label="Pagamentos" className={cn(CARD, "overflow-hidden")}>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-[#e6eef0] px-4 py-3">
          <CalendarClock className="size-4 shrink-0 text-[#3e84a8]" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">Pagamentos</h3>
          <p className="text-xs text-muted-foreground">Parcelas, sinais e extras, na ordem em que vencem.</p>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setPaymentDialog({ payment: null })}>
            <Plus className="size-4" />
            Adicionar pagamento
          </Button>
        </div>
        {orderedPayments.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum pagamento no calendário.</p>
        ) : (
          <ul className="divide-y divide-[#eef3f4]">
            {orderedPayments.map((payment) => {
              const state = paymentState(payment, day);
              return (
                <li key={payment.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
                  <span className={cn("inline-flex w-36 shrink-0 justify-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", PAYMENT_CHIP[state])}>
                    {paymentLabel(payment, state)}
                  </span>
                  <button type="button" onClick={() => setPaymentDialog({ payment })} className="min-w-40 flex-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40">
                    <span className={cn("block text-sm font-medium", payment.paid ? "text-muted-foreground" : "text-foreground")}>{payment.description}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[payment.vendorName, payment.notes].filter(Boolean).join(" · ")}</span>
                  </button>
                  <span className={cn("text-sm font-semibold tabular-nums", payment.paid ? "text-muted-foreground" : "text-foreground")}>{formatBrl(payment.amount)}</span>
                  <Button variant={payment.paid ? "ghost" : "secondary"} size="sm" disabled={busy} onClick={() => togglePaid(payment)}>
                    {payment.paid ? "Desfazer" : "Marcar como pago"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Buscar despesa" placeholder="Buscar despesa, fornecedor ou categoria" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Button variant={onlyPending ? "default" : "outline"} size="sm" aria-pressed={onlyPending} onClick={() => setOnlyPending((value) => !value)}>
          <Hourglass className="size-4" />
          Só em análise
        </Button>
        <span className="text-xs text-muted-foreground">
          {filtered.filter((item) => item.approvalStatus !== "descartado").length} de {budgetItems.length - discarded.length} despesas
        </span>
      </div>

      {(["escritorio", "produtora"] as BudgetManagedBy[]).map((managedBy) => {
        const scope = scopes.find((entry) => entry.managedBy === managedBy);
        if (!scope || scope.count === 0) return null;
        return <ScopeSection key={managedBy} scope={scope} openKeys={filtering ? allKeys : openKeys} onToggle={toggle} onEdit={onEdit} onDelete={onDelete} />;
      })}

      {scopes.every((scope) => scope.count === 0) && (
        <p className={cn(CARD, "px-4 py-10 text-center text-sm text-muted-foreground")}>
          {budgetItems.length ? "Nenhuma despesa encontrada para esta busca." : "Nenhuma despesa cadastrada."}
        </p>
      )}

      {discarded.length > 0 && !filtering && (
        <section aria-label="Descartadas" className={cn(CARD, "overflow-hidden")}>
          <p className="border-b border-[#e6eef0] px-4 py-2.5 text-sm font-semibold text-muted-foreground">Descartadas ({discarded.length})</p>
          <ul className="divide-y divide-[#eef3f4] opacity-70">
            {discarded.map((item) => (
              <BudgetLine key={item.id} item={item} showCategory onEdit={onEdit} onDelete={onDelete} />
            ))}
          </ul>
        </section>
      )}

      {paymentDialog && (
        <EventoPagamentoDialog
          payment={paymentDialog.payment}
          busy={busy}
          onClose={() => setPaymentDialog(null)}
          onSave={async (input) => {
            if (await savePayment(input, paymentDialog.payment?.id)) setPaymentDialog(null);
          }}
          onDelete={
            paymentDialog.payment
              ? async () => {
                  const id = paymentDialog.payment?.id;
                  if (id && (await deleteEventPayment(id))) {
                    setPayments((current) => current.filter((payment) => payment.id !== id));
                    setPaymentDialog(null);
                  }
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
