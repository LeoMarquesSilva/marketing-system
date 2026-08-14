"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FileText, Globe, Instagram, MessageCircle, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EventStorageUrlField } from "@/components/eventos/event-storage-url-field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EventoSupplierDialog } from "@/components/eventos/evento-supplier-dialog";
import { SupplierRatingStars } from "@/components/eventos/supplier-rating-stars";
import {
  SUPPLIER_CATEGORY_LABEL,
  type EventSupplier,
  type EventSupplierLink,
  type EventSupplierQuote,
  type ProposalStatus,
} from "@/lib/eventos";
import { parseBrlInput } from "@/lib/money-br";
import { cn } from "@/lib/utils";

const PROPOSAL_STATUS_STYLE: Record<ProposalStatus, string> = {
  pendente: "bg-slate-100 text-slate-700 border-slate-200",
  aprovada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  descartada: "bg-red-100 text-red-800 border-red-200",
};

export function EventoFornecedoresTab({
  linkedSuppliers,
  catalogSuppliers,
  quotes,
  eventId,
  onLinkExisting,
  onUnlink,
  onSupplierCreated,
  onAddQuote,
  onDeleteQuote,
  isLoading = false,
}: {
  linkedSuppliers: EventSupplierLink[];
  catalogSuppliers: EventSupplier[];
  quotes: EventSupplierQuote[];
  eventId: string;
  onLinkExisting: (supplierId: string) => void;
  onUnlink: (usageId: string) => void;
  onSupplierCreated: (supplier: EventSupplier) => void;
  onAddQuote: (
    supplierId: string,
    category: string,
    quotedValue: number,
    attachedFileLink?: string | null
  ) => void;
  onDeleteQuote: (id: string) => void;
  isLoading?: boolean;
}) {
  const [supplierSearch, setSupplierSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [quoteSupplierId, setQuoteSupplierId] = useState("");
  const [quoteCategory, setQuoteCategory] = useState("outros");
  const [quoteValue, setQuoteValue] = useState("");
  const [quoteFileLink, setQuoteFileLink] = useState("");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<"__all__" | ProposalStatus>("__all__");
  const [quoteSort, setQuoteSort] = useState<"latest" | "highest" | "lowest">("latest");

  const linkedIds = useMemo(() => new Set(linkedSuppliers.map((l) => l.supplier.id)), [linkedSuppliers]);

  const searchResults = useMemo(() => {
    if (!supplierSearch.trim()) return [];
    const q = supplierSearch.toLowerCase();
    return catalogSuppliers
      .filter((s) => !linkedIds.has(s.id))
      .filter((s) => s.name.toLowerCase().includes(q) || (s.category ?? "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [catalogSuppliers, supplierSearch, linkedIds]);

  const filteredQuotes = useMemo(() => {
    const base = quotes.filter((q) => {
      if (quoteStatusFilter !== "__all__" && q.proposalStatus !== quoteStatusFilter) return false;
      if (!quoteSearch.trim()) return true;
      const s = quoteSearch.toLowerCase();
      return (
        (q.supplierName ?? "").toLowerCase().includes(s) ||
        (q.category ?? "").toLowerCase().includes(s) ||
        (q.decisionReason ?? "").toLowerCase().includes(s)
      );
    });
    if (quoteSort === "highest") {
      return [...base].sort((a, b) => (b.quotedValue ?? 0) - (a.quotedValue ?? 0));
    }
    if (quoteSort === "lowest") {
      return [...base].sort((a, b) => (a.quotedValue ?? 0) - (b.quotedValue ?? 0));
    }
    return base;
  }, [quotes, quoteSearch, quoteStatusFilter, quoteSort]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Prestadores vinculados</h3>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" />
            Cadastrar novo prestador
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar prestador já cadastrado para vincular a este evento..."
            value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-border/60 bg-popover shadow-lg overflow-hidden">
              {searchResults.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors"
                  onClick={() => {
                    onLinkExisting(s.id);
                    setSupplierSearch("");
                  }}
                >
                  <span className="truncate">{s.name}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {SUPPLIER_CATEGORY_LABEL[s.category as keyof typeof SUPPLIER_CATEGORY_LABEL] ?? s.category}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        {linkedSuppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-3 py-4 text-center">
            Nenhum prestador vinculado a este evento ainda.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {linkedSuppliers.map(({ usageId, supplier }) => (
              <div key={usageId} className="rounded-lg border border-border/60 p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{supplier.name}</p>
                    <Badge variant="outline" className="mt-0.5 text-[10px]">
                      {SUPPLIER_CATEGORY_LABEL[supplier.category as keyof typeof SUPPLIER_CATEGORY_LABEL] ?? supplier.category}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onUnlink(usageId)} title="Desvincular">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <SupplierRatingStars rating={supplier.rating} />
                {(supplier.websiteLink || supplier.instagramLink || supplier.portfolioLink || supplier.whatsappLink) && (
                  <div className="flex gap-1.5 pt-0.5">
                    {supplier.websiteLink && (
                      <a href={supplier.websiteLink} target="_blank" rel="noreferrer" title="Site" className="text-muted-foreground hover:text-violet-600">
                        <Globe className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {supplier.instagramLink && (
                      <a href={supplier.instagramLink} target="_blank" rel="noreferrer" title="Instagram" className="text-muted-foreground hover:text-violet-600">
                        <Instagram className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {supplier.portfolioLink && (
                      <a href={supplier.portfolioLink} target="_blank" rel="noreferrer" title="Portfólio" className="text-muted-foreground hover:text-violet-600">
                        <FileText className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {supplier.whatsappLink && (
                      <a href={supplier.whatsappLink} target="_blank" rel="noreferrer" title="WhatsApp" className="text-muted-foreground hover:text-violet-600">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Comparativo de propostas</h3>
        <div className="grid gap-2 md:grid-cols-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={quoteSupplierId}
            onChange={(e) => setQuoteSupplierId(e.target.value)}
          >
            <option value="">Fornecedor</option>
            {linkedSuppliers.map(({ supplier }) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          <Input value={quoteCategory} onChange={(e) => setQuoteCategory(e.target.value)} placeholder="Categoria" />
          <CurrencyInput value={quoteValue} onChange={setQuoteValue} placeholder="Valor cotado" />
          <EventStorageUrlField
            eventId={eventId}
            folder="propostas"
            value={quoteFileLink}
            onChange={setQuoteFileLink}
            placeholder="Proposta (URL ou upload)"
          />
        </div>
        <Button
          onClick={() => {
            const amount = parseBrlInput(quoteValue);
            if (!quoteSupplierId || amount == null || amount <= 0) return;
            onAddQuote(
              quoteSupplierId,
              quoteCategory || "outros",
              amount,
              quoteFileLink.trim() || null
            );
            setQuoteValue("");
            setQuoteFileLink("");
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar proposta
        </Button>
        <div className="grid gap-2 md:grid-cols-4">
          <Input
            placeholder="Buscar proposta..."
            value={quoteSearch}
            onChange={(e) => setQuoteSearch(e.target.value)}
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={quoteStatusFilter}
            onChange={(e) => setQuoteStatusFilter(e.target.value as "__all__" | ProposalStatus)}
          >
            <option value="__all__">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="aprovada">Aprovada</option>
            <option value="descartada">Descartada</option>
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={quoteSort}
            onChange={(e) => setQuoteSort(e.target.value as "latest" | "highest" | "lowest")}
          >
            <option value="latest">Ordenar: mais recentes</option>
            <option value="highest">Ordenar: maior valor</option>
            <option value="lowest">Ordenar: menor valor</option>
          </select>
          <div className="h-9 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground flex items-center">
            {filteredQuotes.length} proposta(s) exibida(s)
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => setQuoteSort(quoteSort === "highest" ? "lowest" : "highest")}
                >
                  Valor cotado
                </button>
              </TableHead>
              <TableHead>Valor final</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Proposta</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhuma proposta cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredQuotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>{q.supplierName || "—"}</TableCell>
                  <TableCell>{q.category}</TableCell>
                  <TableCell>{q.quotedValue?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "—"}</TableCell>
                  <TableCell>{q.finalValue?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs", PROPOSAL_STATUS_STYLE[q.proposalStatus])}>
                      {proposalLabel(q.proposalStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {q.attachedFileLink ? (
                      <a
                        href={q.attachedFileLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{q.decisionReason || "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => onDeleteQuote(q.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        )}
      </div>

      <EventoSupplierDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={(supplier) => onSupplierCreated(supplier)}
      />
    </div>
  );
}

function proposalLabel(status: ProposalStatus) {
  if (status === "aprovada") return "Aprovada";
  if (status === "descartada") return "Descartada";
  return "Pendente";
}
