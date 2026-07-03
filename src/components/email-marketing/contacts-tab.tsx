"use client";

import { useMemo, useState } from "react";
import { Building2, Eye, Plus, Search, Trash2, Upload, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteEmailContact,
  EMAIL_CONTACT_STATUS_LABEL,
  type EmailContact,
  type EmailContactStatus,
  type EmailCompany,
} from "@/lib/email-marketing";
import {
  computeEnrichmentStats,
  contactToEnrichable,
  matchesEnrichmentFilter,
  type EnrichmentFilterId,
} from "@/lib/email-marketing-enrichment";
import { ContactFormDialog } from "./contact-form-dialog";
import { ContactDetailDialog } from "./contact-detail-dialog";
import { ImportContactsDialog } from "./import-contacts-dialog";
import { CompanyDetailDialog } from "./company-detail-dialog";
import { EnrichmentFiltersBar } from "./enrichment-filters";
import {
  CompanyLinkButton,
  ContactAvatar,
  EmailStatCard,
  TagList,
} from "./email-marketing-ui";

interface ContactsTabProps {
  contacts: EmailContact[];
  companies: EmailCompany[];
  onChanged: () => void;
}

const STATUS_VARIANT: Record<EmailContactStatus, "default" | "secondary" | "destructive" | "outline"> = {
  subscribed: "default",
  unsubscribed: "secondary",
  bounced: "destructive",
  complained: "destructive",
};

export function ContactsTab({ contacts, companies, onChanged }: ContactsTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [groupFilter, setGroupFilter] = useState("__all__");
  const [enrichmentFilter, setEnrichmentFilter] = useState<EnrichmentFilterId>("all");
  const [onlyPendingGroups, setOnlyPendingGroups] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<EmailContact | null>(null);
  const [viewing, setViewing] = useState<EmailContact | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<EmailCompany | null>(null);
  const [companyDetailOpen, setCompanyDetailOpen] = useState(false);

  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies]
  );

  const stats = useMemo(() => {
    const subscribed = contacts.filter((c) => c.status === "subscribed").length;
    const withCompany = contacts.filter((c) => c.companyId).length;
    return { total: contacts.length, subscribed, withCompany };
  }, [contacts]);

  const groupOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const contact of contacts) {
      const key = contact.clientGroupId ?? contact.clientGroupName ?? "";
      if (!key) continue;
      map.set(key, contact.clientGroupName ?? "Sem grupo");
    }
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [contacts]);

  const enrichmentStats = useMemo(
    () => computeEnrichmentStats(contacts.map(contactToEnrichable)),
    [contacts]
  );

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (statusFilter !== "__all__" && c.status !== statusFilter) return false;
      if (groupFilter !== "__all__") {
        const key = c.clientGroupId ?? c.clientGroupName ?? "";
        if (key !== groupFilter) return false;
      }
      if (!matchesEnrichmentFilter(contactToEnrichable(c), enrichmentFilter)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          c.email.toLowerCase().includes(q) ||
          (c.name ?? "").toLowerCase().includes(q) ||
          (c.companyName ?? c.company ?? "").toLowerCase().includes(q) ||
          (c.clientGroupName ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [contacts, search, statusFilter, groupFilter, enrichmentFilter]);

  const openCompany = (company: EmailCompany) => {
    setSelectedCompany(company);
    setCompanyDetailOpen(true);
  };

  const handleDelete = async (contact: EmailContact) => {
    if (!confirm(`Remover ${contact.email} da base de contatos?`)) return;
    await deleteEmailContact(contact.id);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <EmailStatCard label="Total de contatos" value={stats.total} />
        <EmailStatCard label="Inscritos" value={stats.subscribed} hint="Podem receber campanhas" />
        <EmailStatCard label="Cadastros incompletos" value={enrichmentStats.incompleto} />
        <EmailStatCard label="Sem cargo" value={enrichmentStats.semCargo} />
      </div>

      <EnrichmentFiltersBar
        groupOptions={groupOptions}
        groupFilter={groupFilter}
        onGroupFilterChange={setGroupFilter}
        enrichmentFilter={enrichmentFilter}
        onEnrichmentFilterChange={setEnrichmentFilter}
        onlyPendingGroups={onlyPendingGroups}
        onOnlyPendingGroupsChange={setOnlyPendingGroups}
        stats={enrichmentStats}
        resultCount={filtered.length}
        showSemEmail={false}
        showOnlyPendingGroupsToggle={false}
      />

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por e-mail, nome ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-72"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os status</SelectItem>
              {Object.entries(EMAIL_CONTACT_STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Importar planilha
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo contato
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Contato</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-16">
                    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                      <Users className="h-9 w-9 opacity-40" />
                      <p className="text-sm font-medium text-foreground">Nenhum contato encontrado</p>
                      <p className="text-xs">Adicione manualmente ou importe uma planilha da sua base.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((contact) => {
                const company = contact.companyId ? companyById.get(contact.companyId) : undefined;
                return (
                  <TableRow
                    key={contact.id}
                    className="group hover:bg-muted/20 cursor-pointer"
                    onClick={() => {
                      setViewing(contact);
                      setDetailOpen(true);
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <ContactAvatar contact={contact} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{contact.name ?? "Sem nome"}</p>
                          <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {contact.clientGroupName ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <CompanyLinkButton
                        company={company}
                        fallbackName={contact.companyName ?? contact.company}
                        onClick={
                          company
                            ? () => openCompany(company)
                            : undefined
                        }
                      />
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <TagList tags={contact.tags} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[contact.status]}>
                        {EMAIL_CONTACT_STATUS_LABEL[contact.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewing(contact);
                            setDetailOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(contact);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(contact);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Exibindo {filtered.length} de {contacts.length} contatos
      </p>

      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editing}
        companies={companies}
        onSaved={onChanged}
      />
      <ContactDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contact={viewing}
        company={viewing?.companyId ? companyById.get(viewing.companyId) : undefined}
        onEdit={
          viewing
            ? () => {
                setDetailOpen(false);
                setEditing(viewing);
                setFormOpen(true);
              }
            : undefined
        }
      />
      <ImportContactsDialog open={importOpen} onOpenChange={setImportOpen} onImported={onChanged} />
      <CompanyDetailDialog
        open={companyDetailOpen}
        onOpenChange={setCompanyDetailOpen}
        company={selectedCompany}
      />
    </div>
  );
}
