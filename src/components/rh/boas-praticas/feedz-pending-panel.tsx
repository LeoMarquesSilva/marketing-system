"use client";

import { FileSpreadsheet, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { feedzManager, feedzMentionedPerson, feedzOccurrenceText, type FeedzRow } from "@/lib/rh/boas-praticas/feedz";
import type { FeedbackPerson } from "@/lib/rh/boas-praticas/types";
import { formatDate } from "./feedback-badges";
import { PersonAvatar } from "./feedback-visuals";

/** Linhas do relatório do Feedz que ainda não têm registro no módulo. */
export function FeedzPendingPanel({
  rows,
  people,
  onRegister,
  onDismiss,
}: {
  rows: FeedzRow[];
  people: FeedbackPerson[];
  onRegister: (row: FeedzRow) => void;
  onDismiss: () => void;
}) {
  return (
    <section className="rounded-md bg-white ring-1 ring-inset ring-[#dce9eb]" aria-label="Feedbacks do Feedz sem registro">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e6eef0] px-4 py-3">
        <FileSpreadsheet className="size-4 text-[#3e84a8]" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">
          {rows.length} {rows.length === 1 ? "feedback do Feedz ainda sem registro" : "feedbacks do Feedz ainda sem registro"}
        </h3>
        <span className="hidden text-xs text-muted-foreground sm:inline">da última importação · o formulário já vem preenchido</span>
        <Button type="button" variant="ghost" size="icon" className="ml-auto size-8" aria-label="Dispensar a lista" onClick={onDismiss}>
          <X className="size-4" />
        </Button>
      </div>
      <ul className="divide-y divide-[#eef3f5]">
        {rows.map((row) => {
          const manager = feedzManager(row.to, people);
          const employee = feedzMentionedPerson(row.message, people, row.to);
          return (
            <li key={row.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:flex-nowrap">
              <PersonAvatar name={employee?.short_name ?? manager?.short_name ?? row.to} person={employee ?? manager} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  <span className="font-medium">{employee?.short_name ?? "Colaborador não identificado"}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · para {manager?.short_name ?? row.to} em {formatDate(row.sentOn)}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{feedzOccurrenceText(row.message)}</p>
              </div>
              <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => onRegister(row)}>
                <Plus className="size-3.5" />
                Registrar
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
