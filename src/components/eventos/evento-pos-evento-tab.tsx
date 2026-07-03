"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { EventPostmortem } from "@/lib/eventos";

export function EventoPosEventoTab({
  postmortem,
  onSave,
}: {
  postmortem: EventPostmortem | null;
  onSave: (input: Omit<EventPostmortem, "id" | "createdAt" | "updatedAt">) => void;
}) {
  const [form, setForm] = useState<Omit<EventPostmortem, "id" | "createdAt" | "updatedAt">>({
    eventId: postmortem?.eventId ?? "",
    whatWorked: postmortem?.whatWorked ?? "",
    whatFailed: postmortem?.whatFailed ?? "",
    improvements: postmortem?.improvements ?? "",
    overallRating: postmortem?.overallRating ?? null,
    nps: postmortem?.nps ?? null,
    participantsExpected: postmortem?.participantsExpected ?? null,
    participantsActual: postmortem?.participantsActual ?? null,
    costPerParticipant: postmortem?.costPerParticipant ?? null,
    reuseSupplierNotes: postmortem?.reuseSupplierNotes ?? "",
  });

  useEffect(() => {
    setForm({
      eventId: postmortem?.eventId ?? "",
      whatWorked: postmortem?.whatWorked ?? "",
      whatFailed: postmortem?.whatFailed ?? "",
      improvements: postmortem?.improvements ?? "",
      overallRating: postmortem?.overallRating ?? null,
      nps: postmortem?.nps ?? null,
      participantsExpected: postmortem?.participantsExpected ?? null,
      participantsActual: postmortem?.participantsActual ?? null,
      costPerParticipant: postmortem?.costPerParticipant ?? null,
      reuseSupplierNotes: postmortem?.reuseSupplierNotes ?? "",
    });
  }, [postmortem]);

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-4">
      <h3 className="text-sm font-semibold">Pós-evento</h3>
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
        placeholder="O que funcionou"
        value={form.whatWorked ?? ""}
        onChange={(e) => setForm((p) => ({ ...p, whatWorked: e.target.value }))}
      />
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
        placeholder="O que não funcionou"
        value={form.whatFailed ?? ""}
        onChange={(e) => setForm((p) => ({ ...p, whatFailed: e.target.value }))}
      />
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
        placeholder="O que melhorar"
        value={form.improvements ?? ""}
        onChange={(e) => setForm((p) => ({ ...p, improvements: e.target.value }))}
      />
      <div className="grid gap-2 md:grid-cols-3">
        <input
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          placeholder="Avaliação geral (0-10)"
          value={form.overallRating ?? ""}
          onChange={(e) => setForm((p) => ({ ...p, overallRating: e.target.value ? Number(e.target.value) : null }))}
        />
        <input
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          placeholder="NPS (-100 a 100)"
          value={form.nps ?? ""}
          onChange={(e) => setForm((p) => ({ ...p, nps: e.target.value ? Number(e.target.value) : null }))}
        />
        <input
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          placeholder="Custo por participante"
          value={form.costPerParticipant ?? ""}
          onChange={(e) =>
            setForm((p) => ({ ...p, costPerParticipant: e.target.value ? Number(e.target.value) : null }))
          }
        />
      </div>
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
        placeholder="Fornecedores que devem ou não ser reutilizados"
        value={form.reuseSupplierNotes ?? ""}
        onChange={(e) => setForm((p) => ({ ...p, reuseSupplierNotes: e.target.value }))}
      />
      <div className="flex justify-end">
        <Button onClick={() => onSave(form)}>Salvar pós-evento</Button>
      </div>
    </div>
  );
}
