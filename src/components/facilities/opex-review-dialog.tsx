"use client";

import { useMemo, useState } from "react";
import { CheckCheck, Link2, Loader2, Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { opexApi, type OpexNameRow } from "@/lib/facilities/client";
import { companyTokens, suggestOpexNames } from "@/lib/facilities/opex";
import type { FacilitiesSupplier } from "@/lib/facilities/types";
import { expenseNatureLabel } from "@/lib/suppliers/categories";
import { cn } from "@/lib/utils";
import { formatBrl, SupplierMonogram } from "./facilities-visuals";
import { Segmented } from "./form-parts";
import { OpexNamesField, useOpexNames } from "./opex-names-field";

type Tab = "sugestoes" | "sem" | "opex";

function matchesQuery(text: string, query: string): boolean {
  const words = companyTokens(query);
  if (!words.length) return true;
  const tokens = companyTokens(text);
  return words.every((word) => tokens.some((token) => token.startsWith(word)));
}

/** "Verificar nomes": liga cada fornecedor ao nome dele no OPEX, com sugestões e cadastro do que só existe no financeiro. */
export function OpexReviewDialog({
  suppliers,
  onSaved,
  onCreate,
  onClose,
}: {
  suppliers: FacilitiesSupplier[];
  onSaved: (supplier: FacilitiesSupplier) => void;
  onCreate: (row: OpexNameRow) => void;
  onClose: () => void;
}) {
  const { names, loading, error, syncedAt } = useOpexNames();
  const [tab, setTab] = useState<Tab>("sugestoes");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // Quem já usa cada nome sai do estado da tela (as ligações feitas aqui contam na hora).
  const linked = useMemo(() => {
    const map = new Map<string, FacilitiesSupplier>();
    for (const supplier of suppliers) for (const name of supplier.opex_names) map.set(name, supplier);
    return map;
  }, [suppliers]);

  const pending = useMemo(() => {
    const taken = new Set(linked.keys());
    return suppliers
      .filter((s) => s.active && s.opex_names.length === 0)
      .map((supplier) => ({ supplier, suggestions: suggestOpexNames(supplier, names, taken) }))
      .sort((a, b) => (b.suggestions[0]?.score ?? 0) - (a.suggestions[0]?.score ?? 0) || a.supplier.name.localeCompare(b.supplier.name, "pt-BR"));
  }, [suppliers, names, linked]);

  const withSuggestion = pending.filter((p) => p.suggestions.length > 0);
  const withoutSuggestion = pending.filter((p) => p.suggestions.length === 0);
  const onlyInOpex = useMemo(() => names.filter((n) => !linked.has(n.fornecedor)), [names, linked]);

  // Nome idêntico (depois de tirar Ltda, S.A. etc.) que não aparece para outro fornecedor; leva todos os idênticos dele.
  const exact = useMemo(() => {
    const seen = new Map<string, number>();
    for (const p of withSuggestion)
      for (const s of p.suggestions) if (s.score === 1) seen.set(s.fornecedor, (seen.get(s.fornecedor) ?? 0) + 1);
    return withSuggestion
      .map((p) => ({ supplier: p.supplier, names: p.suggestions.filter((s) => s.score === 1).map((s) => s.fornecedor) }))
      .filter((p) => p.names.length > 0 && p.names.every((name) => seen.get(name) === 1));
  }, [withSuggestion]);

  async function link(supplier: FacilitiesSupplier, opexNames: string[]) {
    setBusy(supplier.id);
    setFailure(null);
    try {
      onSaved(await opexApi.link(supplier.id, opexNames));
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Não foi possível ligar o nome.");
    } finally {
      setBusy(null);
    }
  }

  async function linkExact() {
    setBusy("__all__");
    setFailure(null);
    try {
      for (const p of exact) onSaved(await opexApi.link(p.supplier.id, p.names));
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Parte dos nomes não foi ligada. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  const q = query.trim();
  const visibleSuggestions = withSuggestion.filter((p) => matchesQuery(p.supplier.name, q));
  const visibleWithout = withoutSuggestion.filter((p) => matchesQuery(p.supplier.name, q));
  const visibleOpex = onlyInOpex.filter((n) => matchesQuery(n.fornecedor, q)).slice(0, 80);
  const syncedLabel = syncedAt ? new Date(syncedAt).toLocaleDateString("pt-BR") : null;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-3xl" showCloseButton={!busy}>
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-lg">Conferir nomes do OPEX</DialogTitle>
          <DialogDescription>
            O financeiro chama cada fornecedor pelo nome do terceiro no SIOE. Ligue cada cadastro ao nome dele e o valor pago passa a vir
            do OPEX{syncedLabel ? ` (pagamentos atualizados em ${syncedLabel})` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border-b border-[#e6eef0] px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<Tab>
              label="O que conferir"
              value={tab}
              options={[
                { value: "sugestoes", label: `Com sugestão (${withSuggestion.length})` },
                { value: "sem", label: `Sem sugestão (${withoutSuggestion.length})` },
                { value: "opex", label: `Só no OPEX (${onlyInOpex.length})` },
              ]}
              onChange={setTab}
            />
            <div className="relative min-w-[12rem] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar" aria-label="Filtrar" className="h-9 pl-9 text-sm" />
            </div>
          </div>
          {tab === "sugestoes" && exact.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#e8f8f8] px-3 py-2">
              <p className="text-sm text-[#1f4a5e]">
                {exact.length} {exact.length === 1 ? "fornecedor tem" : "fornecedores têm"} o mesmo nome no OPEX.
              </p>
              <Button type="button" size="sm" className="gap-1.5" disabled={Boolean(busy)} onClick={() => void linkExact()}>
                {busy === "__all__" ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
                Ligar os {exact.length} iguais
              </Button>
            </div>
          )}
          {failure && <p className="text-sm text-red-700">{failure}</p>}
        </div>

        <div className="min-h-[18rem] flex-1 overflow-y-auto px-3 py-2 sm:px-4">
          {loading ? (
            <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Carregando os nomes do OPEX…
            </p>
          ) : error ? (
            <p className="px-3 py-6 text-sm text-red-700">{error}</p>
          ) : tab === "sugestoes" ? (
            visibleSuggestions.length ? (
              <ul className="divide-y divide-[#eef3f5]">
                {visibleSuggestions.map(({ supplier, suggestions }) => (
                  <li key={supplier.id} className="grid gap-2 px-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] sm:items-center">
                    <SupplierCell supplier={supplier} />
                    <div className="space-y-1.5">
                      {suggestions.map((s) => (
                        <div key={s.fornecedor} className="flex items-center gap-2 rounded-md bg-[#f7fbfc] px-2.5 py-1.5 ring-1 ring-inset ring-[#e6eef0]">
                          <Sparkles className="size-3.5 shrink-0 text-[#48466e]" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-foreground">{s.fornecedor}</span>
                            <span className="block text-xs text-muted-foreground">
                              {s.score === 1 ? "Nome igual" : "Nome parecido"} · {formatBrl(s.total, { compact: true })} em 12 meses
                            </span>
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant={s.score === 1 ? "default" : "outline"}
                            className="h-8 shrink-0 gap-1"
                            disabled={Boolean(busy)}
                            onClick={() => void link(supplier, [s.fornecedor])}
                          >
                            {busy === supplier.id ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                            Ligar
                          </Button>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{q ? "Nada com esse filtro." : "Todas as sugestões foram conferidas."}</Empty>
            )
          ) : tab === "sem" ? (
            visibleWithout.length ? (
              <ul className="divide-y divide-[#eef3f5]">
                {visibleWithout.map(({ supplier }) => (
                  <li key={supplier.id} className="grid gap-2 px-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] sm:items-center">
                    <SupplierCell supplier={supplier} />
                    <OpexNamesField
                      value={supplier.opex_names}
                      supplierName={supplier.name}
                      legalName={supplier.legal_name ?? ""}
                      supplierId={supplier.id}
                      onChange={(opexNames) => void link(supplier, opexNames)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{q ? "Nada com esse filtro." : "Nenhum fornecedor ativo sem nome do OPEX."}</Empty>
            )
          ) : visibleOpex.length ? (
            <>
              <p className="px-2 pb-1 pt-2 text-xs text-muted-foreground">
                Pagos nos últimos 12 meses e ainda sem cadastro, do maior para o menor. Pagamentos a sócios, associados e comissões ficam de fora.
              </p>
              <ul className="divide-y divide-[#eef3f5]">
                {visibleOpex.map((row) => (
                  <li key={row.fornecedor} className="flex items-center gap-3 px-2 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{row.fornecedor}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.mainAccount.toLowerCase()} · {row.departments.join(", ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-foreground">{formatBrl(row.total, { compact: true })}</span>
                    <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1" disabled={Boolean(busy)} onClick={() => onCreate(row)}>
                      <Plus className="size-3.5" />
                      Cadastrar
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty>{q ? "Nada com esse filtro." : "Todo nome do OPEX já está ligado a um cadastro."}</Empty>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SupplierCell({ supplier }: { supplier: FacilitiesSupplier }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <SupplierMonogram name={supplier.name} category={supplier.category} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{supplier.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{expenseNatureLabel(supplier.expense_nature)}</span>
      </span>
    </span>
  );
}

function Empty({ children }: { children: string }) {
  return <p className={cn("px-3 py-10 text-center text-sm text-muted-foreground")}>{children}</p>;
}
