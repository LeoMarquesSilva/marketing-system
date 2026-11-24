"use client";

import { useState } from "react";
import { Loader2, UserRound, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addDays, todayInBrasilia } from "@/lib/rh/pdi/progress";
import type { PdiPerson } from "@/lib/rh/pdi/types";
import { cn } from "@/lib/utils";
import { ChoiceCards, DateField, PersonPicker } from "../form-controls";
import { PersonPhoto } from "../pdi/pdi-visuals";
import { MUTED } from "./feedback-visuals";

/**
 * Pedir feedback: para si (padrão) ou, para quem lidera, sobre um liderado. Até 10 pessoas
 * por pedido; cada uma recebe o aviso no sino e responde com um feedback ligado ao pedido.
 */
export function RequestFeedbackDialog({
  people,
  team,
  me,
  onClose,
  onDone,
}: {
  people: PdiPerson[];
  /** Liderados (para o pedido do gestor); vazio = só pede para si. */
  team: PdiPerson[];
  me: PdiPerson | null;
  onClose: () => void;
  onDone: (count: number) => void;
}) {
  const [about, setAbout] = useState<"eu" | "liderado">("eu");
  const [subject, setSubject] = useState<string | null>(null);
  const [givers, setGivers] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjectId = about === "eu" ? me?.id ?? null : subject;
  const candidates = people.filter((person) => person.id !== subjectId && !givers.includes(person.id));
  const chosen = givers.map((id) => people.find((person) => person.id === id)).filter(Boolean) as PdiPerson[];

  async function send() {
    setSaving(true);
    setError(null);
    try {
      if (about === "liderado" && !subject) throw new Error("Escolha sobre quem é o feedback.");
      const response = await fetch("/api/feedback/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giver_employee_ids: givers, subject_employee_id: about === "eu" ? null : subject, message: message.trim(), due_date: due || null }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível pedir.");
      onDone(body.count as number);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível pedir.");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-xl" showCloseButton={!saving}>
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-lg">Pedir feedback</DialogTitle>
          <DialogDescription>Quanto mais específico o pedido, melhor a resposta (um trabalho, uma audiência, uma reunião).</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5 [scrollbar-color:#c9d6da_transparent] [scrollbar-width:thin]">
          {team.length > 0 && (
            <section className="space-y-1.5">
              <Label>Sobre quem</Label>
              <ChoiceCards
                label="Sobre quem é o feedback"
                className="sm:grid-cols-2"
                value={about}
                onChange={setAbout}
                options={[
                  { value: "eu", title: "Sobre mim", description: "Você recebe o feedback.", icon: UserRound },
                  { value: "liderado", title: "Sobre alguém da equipe", description: "A pessoa recebe, e você vê junto.", icon: Users },
                ]}
              />
              {about === "liderado" && <PersonPicker label="Liderado" placeholder="Escolha a pessoa da equipe" value={subject} people={team} onChange={setSubject} />}
            </section>
          )}

          <section className="space-y-1.5">
            <Label>De quem</Label>
            {chosen.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {chosen.map((person) => (
                  <li key={person.id} className="inline-flex items-center gap-1.5 rounded-full border border-[#dce9eb] bg-white py-0.5 pl-0.5 pr-1">
                    <PersonPhoto person={person} size="xs" />
                    <span className="text-sm text-[#0d2a38]">{person.name}</span>
                    <button
                      type="button"
                      onClick={() => setGivers((current) => current.filter((id) => id !== person.id))}
                      aria-label={`Tirar ${person.name}`}
                      className="grid size-5 place-items-center rounded-full text-[#7b929c] hover:bg-[#f4fafb] hover:text-red-700"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {givers.length < 10 && (
              <PersonPicker
                label="Adicionar pessoa"
                placeholder={chosen.length ? "Adicionar mais alguém" : "Escolha quem vai dar o feedback"}
                value={null}
                people={candidates}
                onChange={(id) => id && setGivers((current) => [...current, id])}
              />
            )}
            <p className={cn("text-xs", MUTED)}>Até 10 pessoas. Cada uma recebe o pedido separado e responde só por ela.</p>
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="request-text">Sobre o quê</Label>
            <Textarea
              id="request-text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              placeholder="Ex.: Queria seu feedback sobre como conduzi a reunião com o cliente na quinta: o que funcionou e o que posso fazer melhor."
              className="resize-none rounded-xl border-[#dce6e9] text-sm leading-6"
            />
          </section>

          <section className="space-y-1.5 sm:max-w-xs">
            <Label>
              Até quando <span className="font-normal text-[#7b929c]">(opcional)</span>
            </Label>
            <DateField
              label="Prazo do pedido"
              placeholder="Sem prazo"
              value={due}
              min={todayInBrasilia()}
              clearable
              onChange={setDue}
              presets={[
                { label: "Em 3 dias", value: addDays(todayInBrasilia(), 3) },
                { label: "Em 1 semana", value: addDays(todayInBrasilia(), 7) },
                { label: "Em 15 dias", value: addDays(todayInBrasilia(), 15) },
              ]}
            />
          </section>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-[#e6eef0] px-6 py-4 sm:justify-between">
          <p className="min-w-0 text-sm text-red-700" role="alert">
            {error}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={send} disabled={saving || !givers.length || message.trim().length < 5} className="bg-[#0f5f70] hover:bg-[#0c5262]">
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Pedir feedback{givers.length > 1 ? ` a ${givers.length} pessoas` : ""}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
