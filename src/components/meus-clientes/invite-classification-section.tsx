"use client";

import { Ban, Sparkles } from "lucide-react";
import { DialogSectionHeading } from "@/components/eventos/dialog-section-heading";
import { InfoTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  PARTY_INVITE_TYPES,
  type PartyInviteTipo,
} from "@/lib/party-invite-types";

export type InviteClassification = "pending" | "none" | "invites";

export function deriveInviteClassification(source: {
  npsEligible: boolean;
  partyInvite: boolean;
  partyInviteTipo: PartyInviteTipo | null;
  invitesClassifiedByUserId: string | null;
}): InviteClassification {
  if (!source.invitesClassifiedByUserId) return "pending";
  if (!source.npsEligible && !source.partyInvite) return "none";
  if (source.partyInvite && !source.partyInviteTipo) return "pending";
  return "invites";
}

export function isInviteClassificationComplete(options: {
  classification: InviteClassification;
  partyInvite: boolean;
  partyInviteTipo: PartyInviteTipo | null;
  /** Quando false, gestores só precisam classificar NPS (festa fica bloqueada). */
  partyInviteEditable?: boolean;
}): boolean {
  if (options.partyInviteEditable === false) {
    return options.classification !== "pending";
  }
  if (options.classification === "pending") return false;
  if (options.partyInvite && !options.partyInviteTipo) return false;
  return true;
}

interface InviteClassificationSectionProps {
  classification: InviteClassification;
  npsEligible: boolean;
  partyInvite: boolean;
  partyInviteTipo: PartyInviteTipo | null;
  /** Admin = true; gestores de Meus Clientes = false (festa inativa). */
  partyInviteEditable?: boolean;
  onClassificationChange: (next: {
    classification: InviteClassification;
    npsEligible: boolean;
    partyInvite: boolean;
    partyInviteTipo: PartyInviteTipo | null;
  }) => void;
}

export function InviteClassificationSection({
  classification,
  npsEligible,
  partyInvite,
  partyInviteTipo,
  partyInviteEditable = true,
  onClassificationChange,
}: InviteClassificationSectionProps) {
  return (
    <section className="space-y-3">
      <DialogSectionHeading icon={Sparkles}>Classificação</DialogSectionHeading>
      {classification === "pending" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-700">
          {partyInviteEditable
            ? "Escolha NPS, Festa, ambos ou confirme que nenhum convite se aplica. Para a festa, selecione também o critério do convite."
            : "Escolha se a pessoa é elegível ao NPS ou confirme que nenhum convite de pesquisa se aplica. A Festa de 10 anos é definida apenas pela administração."}
        </p>
      )}
      {!partyInviteEditable && (
        <p className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-muted-foreground">
          A opção Festa de 10 anos está inativa para o seu perfil. Você pode ajustar o NPS; a festa
          permanece como está.
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
                partyInviteTipo,
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
            "flex items-start gap-3 rounded-xl border p-3 transition-colors",
            partyInviteEditable
              ? "cursor-pointer hover:bg-muted/30"
              : "cursor-not-allowed opacity-60",
            partyInvite && "border-violet-200 bg-violet-50/80 ring-1 ring-violet-200/60"
          )}
          title={
            partyInviteEditable
              ? undefined
              : "Somente administradores podem alterar a Festa de 10 anos"
          }
        >
          <input
            type="checkbox"
            checked={partyInvite}
            disabled={!partyInviteEditable}
            onChange={(e) => {
              if (!partyInviteEditable) return;
              const checked = e.target.checked;
              const bothOff = !npsEligible && !checked;
              onClassificationChange({
                classification: bothOff ? "pending" : "invites",
                npsEligible,
                partyInvite: checked,
                partyInviteTipo: checked ? partyInviteTipo : null,
              });
            }}
            className="mt-0.5 rounded border-border disabled:cursor-not-allowed"
          />
          <span>
            <span className="block text-sm font-medium">Festa de 10 anos</span>
            <span className="block text-xs text-muted-foreground">
              {partyInviteEditable ? "Convite para o evento" : "Somente administração"}
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={() => {
            if (!partyInviteEditable) {
              // Gestores limpam só o NPS; a festa permanece intacta.
              onClassificationChange({
                classification: partyInvite ? "invites" : "none",
                npsEligible: false,
                partyInvite,
                partyInviteTipo,
              });
              return;
            }
            onClassificationChange({
              classification: "none",
              npsEligible: false,
              partyInvite: false,
              partyInviteTipo: null,
            });
          }}
          className={cn(
            "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/30",
            classification === "none" &&
              !npsEligible &&
              (!partyInvite || !partyInviteEditable) &&
              "border-slate-300 bg-slate-50 ring-1 ring-slate-200"
          )}
        >
          <Ban
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              classification === "none" && !npsEligible
                ? "text-slate-700"
                : "text-muted-foreground"
            )}
          />
          <span>
            <span className="block text-sm font-medium">
              {partyInviteEditable ? "Nenhum convite" : "Sem NPS"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {partyInviteEditable
                ? "Não participa do NPS nem da festa"
                : "Não participa da pesquisa NPS"}
            </span>
          </span>
        </button>
      </div>

      {partyInvite && (
        <div
          className={cn(
            "space-y-3 rounded-xl border border-violet-200/70 bg-violet-50/40 p-4",
            !partyInviteEditable && "opacity-70"
          )}
        >
          <p className="text-sm font-medium text-violet-900">Critério do convite para a festa</p>
          <p className="text-xs text-muted-foreground">
            {partyInviteEditable
              ? "Selecione o tipo que justifica o convite. Passe o mouse no ícone para ver a descrição."
              : "Critério definido pela administração — visualização apenas."}
          </p>
          <TooltipProvider delayDuration={150}>
            <div className="grid gap-2 sm:grid-cols-2">
              {PARTY_INVITE_TYPES.map((tipo) => (
                <label
                  key={tipo.id}
                  className={cn(
                    "flex items-start gap-2 rounded-xl border bg-background p-3 transition-colors",
                    partyInviteEditable
                      ? "cursor-pointer hover:bg-muted/20"
                      : "cursor-not-allowed",
                    partyInviteTipo === tipo.id &&
                      "border-violet-300 bg-violet-50 ring-1 ring-violet-200"
                  )}
                >
                  <input
                    type="radio"
                    name="party-invite-tipo"
                    checked={partyInviteTipo === tipo.id}
                    disabled={!partyInviteEditable}
                    onChange={() => {
                      if (!partyInviteEditable) return;
                      onClassificationChange({
                        classification: "invites",
                        npsEligible,
                        partyInvite: true,
                        partyInviteTipo: tipo.id,
                      });
                    }}
                    className="mt-1 shrink-0 disabled:cursor-not-allowed"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{tipo.label}</span>
                      <InfoTooltip title={tipo.label} description={tipo.description} side="top" />
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </TooltipProvider>
          {partyInviteEditable && partyInvite && !partyInviteTipo && (
            <p className="text-xs text-amber-700">Selecione um critério para o convite da festa.</p>
          )}
        </div>
      )}
    </section>
  );
}
