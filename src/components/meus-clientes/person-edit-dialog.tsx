"use client";

import { useEffect, useState } from "react";
import { Briefcase, CheckCircle2, Circle, Loader2, Mail, UserRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput, maskPhoneBR } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogHeaderIcon, DialogSectionHeading } from "@/components/eventos/dialog-section-heading";
import {
  updateEmailContact,
  updateEmailPerson,
  type EmailContact,
  type EmailPerson,
} from "@/lib/email-marketing";
import { CARGO_OPTIONS, CARGO_OUTRO, resolveCargoOption } from "@/lib/cargo-options";
import { getProfileCargo } from "@/lib/email-marketing-enrichment";
import {
  deriveInviteClassification,
  InviteClassificationSection,
  isInviteClassificationComplete,
  type InviteClassification,
} from "@/components/meus-clientes/invite-classification-section";
import type { PartyInviteTipo } from "@/lib/party-invite-types";
import { canEditPartyInvite } from "@/lib/access-control";
import { useAuth } from "@/contexts/auth-context";

interface PersonEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: EmailPerson | null;
  contact?: EmailContact | null;
  onSaved: () => void;
}

function personInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
}

export function PersonEditDialog({
  open,
  onOpenChange,
  person,
  contact,
  onSaved,
}: PersonEditDialogProps) {
  const { profile } = useAuth();
  const partyInviteEditable = canEditPartyInvite(profile);
  const isPerson = Boolean(person);
  const target = person ?? contact ?? null;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cargoOption, setCargoOption] = useState("");
  const [cargoOutro, setCargoOutro] = useState("");
  const [npsEligible, setNpsEligible] = useState(false);
  const [partyInvite, setPartyInvite] = useState(false);
  const [partyInviteTipo, setPartyInviteTipo] = useState<PartyInviteTipo | null>(null);
  const [inviteClassification, setInviteClassification] = useState<InviteClassification>("pending");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const source = person ?? contact;
    if (!source) return;
    setName(source.name ?? "");
    setEmail(person?.email ?? contact?.email ?? "");
    setPhone(maskPhoneBR(source.phone ?? ""));
    const cargoValue = source.cargo ?? getProfileCargo({ cargo: source.cargo, customFields: source.customFields }) ?? "";
    setCargoOption(resolveCargoOption(cargoValue));
    setCargoOutro(resolveCargoOption(cargoValue) === CARGO_OUTRO ? cargoValue : "");
    setNpsEligible(source.npsEligible);
    setPartyInvite(source.partyInvite);
    setPartyInviteTipo(source.partyInviteTipo);
    setInviteClassification(deriveInviteClassification(source));
    setError(null);
  }, [open, person, contact]);

  if (!target) return null;

  const resolvedCargo = cargoOption === CARGO_OUTRO ? cargoOutro.trim() : cargoOption;
  const displayName = name.trim() || target.name || "Contato";

  const checklist = [
    { label: "Nome", ok: Boolean(name.trim()) },
    { label: "E-mail", ok: Boolean(email.trim()) },
    { label: "Telefone", ok: Boolean(phone.trim()) },
    { label: "Cargo", ok: Boolean(resolvedCargo) },
    {
      label: partyInviteEditable ? "NPS e Festa" : "NPS",
      ok: isInviteClassificationComplete({
        classification: inviteClassification,
        partyInvite,
        partyInviteTipo,
        partyInviteEditable,
      }),
    },
  ];
  const completeCount = checklist.filter((c) => c.ok).length;

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Informe o nome.");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("E-mail inválido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const enrichedByUserId = profile?.id;
      const phoneValue = phone.trim() || null;
      const classificationComplete = isInviteClassificationComplete({
        classification: inviteClassification,
        partyInvite,
        partyInviteTipo,
        partyInviteEditable,
      });
      // Gestores não alteram festa: preserva o valor já salvo no registro.
      const originalPartyInvite = target.partyInvite;
      const originalPartyInviteTipo = target.partyInviteTipo;
      const nextPartyInvite = partyInviteEditable ? partyInvite : originalPartyInvite;
      const nextPartyInviteTipo = partyInviteEditable
        ? partyInvite
          ? partyInviteTipo
          : null
        : originalPartyInviteTipo;
      const patch = {
        name: name.trim(),
        phone: phoneValue,
        cargo: resolvedCargo || null,
        npsEligible,
        partyInvite: nextPartyInvite,
        partyInviteTipo: nextPartyInviteTipo,
        enrichedByUserId,
        ...(classificationComplete && enrichedByUserId
          ? { invitesClassifiedByUserId: enrichedByUserId }
          : {}),
      };
      if (isPerson && person) {
        await updateEmailPerson(person.id, {
          ...patch,
          email: email.trim() || null,
        });
      } else if (contact) {
        await updateEmailContact(contact.id, {
          ...patch,
          email: email.trim() || contact.email,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="shrink-0 border-b bg-gradient-to-br from-violet-500/10 via-background to-background px-4 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
          <DialogHeader className="space-y-2 text-left sm:space-y-3">
            <div className="flex items-start gap-3">
              <DialogHeaderIcon icon={UserRound} />
              <div className="min-w-0 flex-1 space-y-1">
                <DialogTitle className="text-base sm:text-lg">Editar contato</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Confirme ou complete os dados de{" "}
                  <span className="font-medium text-foreground">{displayName}</span>.
                </DialogDescription>
              </div>
              <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700 ring-2 ring-violet-200/60 sm:flex sm:h-10 sm:w-10 sm:text-sm">
                {personInitials(displayName)}
              </span>
            </div>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="rounded-xl border bg-muted/20 px-4 py-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Progresso do cadastro</span>
              <span className="text-muted-foreground">
                {completeCount}/{checklist.length}
              </span>
            </div>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${(completeCount / checklist.length) * 100}%` }}
              />
            </div>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-1">
                  {item.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  <span className={item.ok ? "text-muted-foreground" : "text-foreground"}>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <section className="space-y-3">
            <DialogSectionHeading icon={UserRound}>Identificação</DialogSectionHeading>
            <div className="space-y-3 rounded-xl border bg-card/60 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="pe-name">Nome</Label>
                <Input
                  id="pe-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pe-email" className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  E-mail
                </Label>
                <Input
                  id="pe-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@empresa.com"
                  autoComplete="email"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <DialogSectionHeading icon={Briefcase}>Contato profissional</DialogSectionHeading>
            <div className="space-y-3 rounded-xl border bg-card/60 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pe-phone">Telefone</Label>
                  <PhoneInput id="pe-phone" value={phone} onChange={setPhone} autoComplete="tel" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pe-cargo">Cargo</Label>
                  <Select value={cargoOption} onValueChange={setCargoOption}>
                    <SelectTrigger id="pe-cargo" className="w-full">
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {CARGO_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {cargoOption === CARGO_OUTRO && (
                <div className="space-y-1.5">
                  <Label htmlFor="pe-cargo-outro">Qual cargo?</Label>
                  <Input
                    id="pe-cargo-outro"
                    value={cargoOutro}
                    onChange={(e) => setCargoOutro(e.target.value)}
                    placeholder="Especifique o cargo"
                  />
                </div>
              )}
            </div>
          </section>

          <InviteClassificationSection
            classification={inviteClassification}
            npsEligible={npsEligible}
            partyInvite={partyInvite}
            partyInviteTipo={partyInviteTipo}
            partyInviteEditable={partyInviteEditable}
            onClassificationChange={({
              classification,
              npsEligible: nps,
              partyInvite: party,
              partyInviteTipo: tipo,
            }) => {
              setInviteClassification(classification);
              setNpsEligible(nps);
              if (partyInviteEditable) {
                setPartyInvite(party);
                setPartyInviteTipo(tipo);
              }
            }}
          />
        </div>

        <DialogFooter className="shrink-0 border-t bg-muted/20 px-4 py-3 sm:px-6 sm:py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[7rem]">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
