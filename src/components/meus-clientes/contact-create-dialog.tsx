"use client";

import { useEffect, useState } from "react";
import { Briefcase, Loader2, Mail, UserPlus, UserRound } from "lucide-react";
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
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogHeaderIcon, DialogSectionHeading } from "@/components/eventos/dialog-section-heading";
import { createEmailContact } from "@/lib/email-marketing";
import { CARGO_OPTIONS, CARGO_OUTRO } from "@/lib/cargo-options";
import {
  InviteClassificationSection,
  isInviteClassificationComplete,
  type InviteClassification,
} from "@/components/meus-clientes/invite-classification-section";
import type { PartyInviteTipo } from "@/lib/party-invite-types";
import { canEditPartyInvite } from "@/lib/access-control";
import { useAuth } from "@/contexts/auth-context";

interface ContactGroupTarget {
  name: string;
  clientGroupId: string | null;
}

interface ContactCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ContactGroupTarget | null;
  onCreated: () => void;
}

export function ContactCreateDialog({ open, onOpenChange, group, onCreated }: ContactCreateDialogProps) {
  const { profile } = useAuth();
  const partyInviteEditable = canEditPartyInvite(profile);
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
    setName("");
    setEmail("");
    setPhone("");
    setCargoOption("");
    setCargoOutro("");
    setNpsEligible(false);
    setPartyInvite(false);
    setPartyInviteTipo(null);
    setInviteClassification("pending");
    setError(null);
  }, [open]);

  if (!group) return null;

  const resolvedCargo = cargoOption === CARGO_OUTRO ? cargoOutro.trim() : cargoOption;

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Informe o nome.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const nextPartyInvite = partyInviteEditable ? partyInvite : false;
      const nextPartyInviteTipo =
        partyInviteEditable && nextPartyInvite ? partyInviteTipo : null;
      await createEmailContact({
        email: email.trim(),
        name: name.trim(),
        phone: phone.trim() || null,
        cargo: resolvedCargo || null,
        npsEligible,
        partyInvite: nextPartyInvite,
        partyInviteTipo: nextPartyInviteTipo,
        clientGroupId: group.clientGroupId,
        company: group.name,
        enrichedByUserId: profile?.id,
        ...(isInviteClassificationComplete({
          classification: inviteClassification,
          partyInvite: nextPartyInvite,
          partyInviteTipo: nextPartyInviteTipo,
          partyInviteEditable,
        }) && profile?.id
          ? { invitesClassifiedByUserId: profile.id }
          : {}),
      });
      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar contato.");
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
              <DialogHeaderIcon icon={UserPlus} />
              <div className="min-w-0 flex-1 space-y-1">
                <DialogTitle className="text-base sm:text-lg">Novo contato</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Adicionar contato ao grupo{" "}
                  <span className="font-medium text-foreground">{group.name}</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <section className="space-y-3">
            <DialogSectionHeading icon={UserRound}>Identificação</DialogSectionHeading>
            <div className="space-y-3 rounded-xl border bg-card/60 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="cc-name">Nome</Label>
                <Input
                  id="cc-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-email" className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  E-mail
                </Label>
                <Input
                  id="cc-email"
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
                  <Label htmlFor="cc-phone">Telefone</Label>
                  <PhoneInput id="cc-phone" value={phone} onChange={setPhone} autoComplete="tel" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cc-cargo">Cargo</Label>
                  <Select value={cargoOption} onValueChange={setCargoOption}>
                    <SelectTrigger id="cc-cargo" className="w-full">
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
                  <Label htmlFor="cc-cargo-outro">Qual cargo?</Label>
                  <Input
                    id="cc-cargo-outro"
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
                Criando...
              </>
            ) : (
              "Criar contato"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
