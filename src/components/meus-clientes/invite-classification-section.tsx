"use client";

import { Ban, Sparkles } from "lucide-react";
import { DialogSectionHeading } from "@/components/eventos/dialog-section-heading";
import { cn } from "@/lib/utils";

export type InviteClassification = "pending" | "none" | "invites";

export function deriveInviteClassification(source: {
  npsEligible: boolean;
  partyInvite: boolean;
  invitesClassifiedByUserId: string | null;
}): InviteClassification {
  if (!source.invitesClassifiedByUserId) return "pending";
  if (!source.npsEligible && !source.partyInvite) return "none";
  return "invites";
}

export function isInviteClassificationComplete(classification: InviteClassification): boolean {
  return classification !== "pending";
}

interface InviteClassificationSectionProps {
  classification: InviteClassification;
  npsEligible: boolean;
  partyInvite: boolean;
  onClassificationChange: (next: {
    classification: InviteClassification;
    npsEligible: boolean;
    partyInvite: boolean;
  }) => void;
}

export function InviteClassificationSection({
  classification,
  npsEligible,
  partyInvite,
  onClassificationChange,
}: InviteClassificationSectionProps) {
  return (
    <section className="space-y-3">
      <DialogSectionHeading icon={Sparkles}>Classificação</DialogSectionHeading>
      {classification === "pending" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-700">
          Escolha NPS, Festa, ambos — ou confirme que nenhum convite se aplica.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/30",
            npsEligible && "border-blue-200 bg-blue-50/80 ring-1 ring-blue-200/60"
          )}
        >
          <input
            type="checkbox"
            checked={npsEligible}
            onChange={(e) => {
              const checked = e.target.checked;
              const bothOff = !checked && !partyInvite;
              onClassificationChange({
                classification: bothOff ? "pending" : "invites",
                npsEligible: checked,
                partyInvite,
              });
            }}
            className="mt-0.5 rounded border-border"
          />
          <span>
            <span className="block text-sm font-medium">Elegível ao NPS</span>
            <span className="block text-xs text-muted-foreground">Pesquisa de satisfação</span>
          </span>
        </label>

        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/30",
            partyInvite && "border-violet-200 bg-violet-50/80 ring-1 ring-violet-200/60"
          )}
        >
          <input
            type="checkbox"
            checked={partyInvite}
            onChange={(e) => {
              const checked = e.target.checked;
              const bothOff = !npsEligible && !checked;
              onClassificationChange({
                classification: bothOff ? "pending" : "invites",
                npsEligible,
                partyInvite: checked,
              });
            }}
            className="mt-0.5 rounded border-border"
          />
          <span>
            <span className="block text-sm font-medium">Festa de 10 anos</span>
            <span className="block text-xs text-muted-foreground">Convite para o evento</span>
          </span>
        </label>

        <button
          type="button"
          onClick={() =>
            onClassificationChange({
              classification: "none",
              npsEligible: false,
              partyInvite: false,
            })
          }
          className={cn(
            "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/30",
            classification === "none" && "border-slate-300 bg-slate-50 ring-1 ring-slate-200"
          )}
        >
          <Ban
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              classification === "none" ? "text-slate-700" : "text-muted-foreground"
            )}
          />
          <span>
            <span className="block text-sm font-medium">Nenhum convite</span>
            <span className="block text-xs text-muted-foreground">Não participa do NPS nem da festa</span>
          </span>
        </button>
      </div>
    </section>
  );
}
