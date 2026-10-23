"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, ListChecks, LockKeyhole, Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentMonthRef, monthKey, type MonthRef } from "@/lib/rh/boas-praticas/metrics";
import type { FeedbackPerson, GoodPracticeFeedback } from "@/lib/rh/boas-praticas/types";
import { cn } from "@/lib/utils";
import { FeedbackDashboard } from "./feedback-dashboard";
import { FeedbackRecords } from "./feedback-records";
import { FeedbackDialog } from "./feedback-dialog";
import { FeedbackPeopleProvider } from "./feedback-visuals";

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
}: {
  initialItems: GoodPracticeFeedback[];
  people: FeedbackPerson[];
  initialTab: Tab;
  initialMonth?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(initialItems);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [month, setMonth] = useState<MonthRef>(() => parseMonth(initialMonth));
  // Filtro de mês da aba Registros: "Ver registros do mês" abre já filtrado; a aba abre com tudo.
  const [recordsMonth, setRecordsMonth] = useState<string>("all");
  const [dialog, setDialog] = useState<{ item: GoodPracticeFeedback | null; key: number } | null>(null);

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
          <div className="order-1 flex items-center justify-between gap-3 sm:order-2 sm:pb-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LockKeyhole className="size-3.5 shrink-0" aria-hidden />
              <span>
                Só Pessoas e Cultura vê<span className="hidden lg:inline"> · nada é enviado ao colaborador</span>
              </span>
            </span>
            <Button type="button" className="gap-2" onClick={() => openDialog(null)}>
              <Plus className="size-4" />
              Registrar feedback
            </Button>
          </div>
        </div>

        {tab === "dashboard" ? (
          <FeedbackDashboard items={items} month={month} onMonthChange={chooseMonth} onOpenRecords={openRecordsOfMonth} />
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
            people={people}
            items={items}
            onClose={() => setDialog(null)}
            onSaved={(saved) => setItems((current) => sortItems([saved, ...current.filter((entry) => entry.id !== saved.id)]))}
            onDeleted={(id) => {
              setItems((current) => current.filter((entry) => entry.id !== id));
              setDialog(null);
            }}
          />
        )}
      </div>
    </FeedbackPeopleProvider>
  );
}
