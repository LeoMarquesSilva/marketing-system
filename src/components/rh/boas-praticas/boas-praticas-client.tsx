"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileSpreadsheet, LayoutDashboard, ListChecks, LockKeyhole, Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { feedzPrefill, type FeedzRow } from "@/lib/rh/boas-praticas/feedz";
import { currentMonthRef, monthKey, type MonthRef } from "@/lib/rh/boas-praticas/metrics";
import type { FeedbackPerson, FeedzImportLog, GoodPracticeFeedback } from "@/lib/rh/boas-praticas/types";
import { cn } from "@/lib/utils";
import { FeedbackDashboard } from "./feedback-dashboard";
import { FeedbackRecords } from "./feedback-records";
import { FeedbackDialog } from "./feedback-dialog";
import { FeedbackPeopleProvider } from "./feedback-visuals";
import { FeedzImportDialog } from "./feedz-import-dialog";
import { FeedzPendingPanel } from "./feedz-pending-panel";

type Tab = "dashboard" | "registros";

const TABS: Array<{ key: Tab; label: string; icon: LucideIcon }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "registros", label: "Registros", icon: ListChecks },
];

/** ?mes=2026-10; sem parâmetro (ou inválido) abre o mês corrente. */
function parseMonth(value: string | undefined): MonthRef {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year: Number(match[1]), month };
  }
  return currentMonthRef();
}

function sortItems(items: GoodPracticeFeedback[]): GoodPracticeFeedback[] {
  return [...items].sort((a, b) => b.sent_on.localeCompare(a.sent_on) || b.created_at.localeCompare(a.created_at));
}

export function BoasPraticasClient({
  initialItems,
  people,
  initialTab,
  initialMonth,
  initialFeedzImport,
}: {
  initialItems: GoodPracticeFeedback[];
  people: FeedbackPerson[];
  initialTab: Tab;
  initialMonth?: string;
  initialFeedzImport: FeedzImportLog | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(initialItems);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [month, setMonth] = useState<MonthRef>(() => parseMonth(initialMonth));
  // Filtro de mês da aba Registros: "Ver registros do mês" abre já filtrado; a aba abre com tudo.
  const [recordsMonth, setRecordsMonth] = useState<string>("all");
  const [dialog, setDialog] = useState<{ item: GoodPracticeFeedback | null; key: number; fromFeedz?: FeedzRow } | null>(
    null
  );
  const [importOpen, setImportOpen] = useState(false);
  const [lastImport, setLastImport] = useState(initialFeedzImport);
  // Linhas do Feedz da última importação que não têm registro no módulo.
  const [feedzPending, setFeedzPending] = useState<FeedzRow[]>([]);

  function replaceParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }

  function chooseTab(next: Tab) {
    setTab(next);
    replaceParams({ aba: next === "dashboard" ? null : next });
  }

  function chooseMonth(next: MonthRef) {
    setMonth(next);
    const current = currentMonthRef();
    replaceParams({ mes: next.year === current.year && next.month === current.month ? null : monthKey(next) });
  }

  function openRecordsOfMonth() {
    setRecordsMonth(monthKey(month));
    chooseTab("registros");
  }

  function openDialog(item: GoodPracticeFeedback | null) {
    setDialog({ item, key: Date.now() });
  }

  return (
    <FeedbackPeopleProvider people={people}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:border-b sm:border-[#dce9eb]">
          <div role="tablist" aria-label="Visões" className="order-2 flex gap-1 border-b border-[#dce9eb] sm:order-1 sm:border-b-0">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => {
                  setRecordsMonth("all");
                  chooseTab(key);
                }}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]/50",
                  tab === key
                    ? "border-[#347796] text-foreground"
                    : "border-transparent text-muted-foreground hover:border-[#dce9eb] hover:text-foreground"
                )}
              >
                <Icon className={cn("size-4", tab === key ? "text-[#347796]" : "text-muted-foreground")} aria-hidden />
                {label}
                {key === "registros" && (
                  <span className="rounded-full bg-[#eef3f5] px-1.5 text-xs tabular-nums text-muted-foreground">{items.length}</span>
                )}
              </button>
            ))}
          </div>
          <div className="order-1 flex items-center justify-end gap-3 sm:order-2 sm:pb-2">
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
              <LockKeyhole className="size-3.5 shrink-0" aria-hidden />
              <span>
                Só Pessoas e Cultura vê<span className="hidden xl:inline"> · nada é enviado ao colaborador</span>
              </span>
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
                <FileSpreadsheet className="size-4" />
                <span className="hidden sm:inline">Importar do Feedz</span>
                <span className="sm:hidden">Feedz</span>
              </Button>
              <Button type="button" className="gap-2" onClick={() => openDialog(null)}>
                <Plus className="size-4" />
                <span className="hidden sm:inline">Registrar feedback</span>
                <span className="sm:hidden">Registrar</span>
              </Button>
            </div>
          </div>
        </div>

        {feedzPending.length > 0 && (
          <FeedzPendingPanel
            rows={feedzPending}
            people={people}
            onRegister={(row) => setDialog({ item: null, key: Date.now(), fromFeedz: row })}
            onDismiss={() => setFeedzPending([])}
          />
        )}

        {tab === "dashboard" ? (
          <FeedbackDashboard
            items={items}
            month={month}
            lastImport={lastImport}
            onMonthChange={chooseMonth}
            onOpenRecords={openRecordsOfMonth}
          />
        ) : (
          <FeedbackRecords
            key={recordsMonth}
            items={items}
            initialMonth={recordsMonth}
            onOpen={(item) => openDialog(item)}
            onCreate={() => openDialog(null)}
          />
        )}

        {dialog && (
          <FeedbackDialog
            key={dialog.key}
            item={dialog.item}
            prefill={dialog.fromFeedz ? feedzPrefill(dialog.fromFeedz, people) : null}
            people={people}
            items={items}
            onClose={() => setDialog(null)}
            onSaved={(saved) => {
              setItems((current) => sortItems([saved, ...current.filter((entry) => entry.id !== saved.id)]));
              if (saved.feedz_key) setFeedzPending((current) => current.filter((row) => row.key !== saved.feedz_key));
            }}
            onDeleted={(id) => {
              setItems((current) => current.filter((entry) => entry.id !== id));
              setDialog(null);
            }}
          />
        )}

        {importOpen && (
          <FeedzImportDialog
            items={items}
            people={people}
            onClose={() => setImportOpen(false)}
            onApplied={(result) => {
              const updated = new Map(result.items.map((item) => [item.id, item]));
              setItems((current) => current.map((item) => updated.get(item.id) ?? item));
              setLastImport(result.log);
              setFeedzPending(result.unmatched);
              setImportOpen(false);
            }}
          />
        )}
      </div>
    </FeedbackPeopleProvider>
  );
}
