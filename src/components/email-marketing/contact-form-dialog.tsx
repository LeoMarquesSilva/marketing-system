"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createEmailContact,
  updateEmailContact,
  type EmailCompany,
  type EmailContact,
} from "@/lib/email-marketing";

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: EmailContact | null;
  companies: EmailCompany[];
  onSaved: () => void;
}

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  companies,
  onSaved,
}: ContactFormDialogProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyMode, setCompanyMode] = useState<"existing" | "new" | "none">("none");
  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [companies]
  );

  useEffect(() => {
    if (!open) return;
    setEmail(contact?.email ?? "");
    setName(contact?.name ?? "");
    setPhone(contact?.phone ?? "");
    if (contact?.companyId) {
      setCompanyMode("existing");
      setCompanyId(contact.companyId);
      setCompanyName("");
    } else if (contact?.company || contact?.companyName) {
      setCompanyMode("new");
      setCompanyId("");
      setCompanyName(contact.companyName ?? contact.company ?? "");
    } else {
      setCompanyMode("none");
      setCompanyId("");
      setCompanyName("");
    }
    setTags(contact?.tags?.join(", ") ?? "");
    setError(null);
  }, [open, contact]);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Informe um e-mail.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const companyPayload =
        companyMode === "existing" && companyId
          ? { companyId, company: null }
          : companyMode === "new" && companyName.trim()
            ? { companyId: null, company: companyName.trim() }
            : { companyId: null, company: null };

      if (contact) {
        await updateEmailContact(contact.id, { email, name, phone, tags: tagList, ...companyPayload });
      } else {
        await createEmailContact({ email, name, phone, tags: tagList, ...companyPayload });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar contato.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact ? "Editar contato" : "Novo contato"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="contact-email">E-mail *</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@empresa.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">Nome</Label>
            <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Telefone</Label>
              <Input id="contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Select
                value={companyMode === "existing" ? companyId : companyMode}
                onValueChange={(value) => {
                  if (value === "none" || value === "new") {
                    setCompanyMode(value);
                    setCompanyId("");
                    if (value === "new") setCompanyName("");
                  } else {
                    setCompanyMode("existing");
                    setCompanyId(value);
                    setCompanyName("");
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem empresa</SelectItem>
                  <SelectItem value="new">Nova empresa...</SelectItem>
                  {sortedCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {companyMode === "new" && (
            <div className="space-y-1.5">
              <Label htmlFor="contact-company-name">Nome da nova empresa</Label>
              <Input
                id="contact-company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Razão social ou nome fantasia"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="contact-tags">Tags (separadas por vírgula)</Label>
            <Input
              id="contact-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="cliente, newsletter, vip"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
