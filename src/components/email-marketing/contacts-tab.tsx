"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  ClipboardList,
  MailX,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteEmailContact, type EmailCompany, type EmailContact } from "@/lib/email-marketing";
import {
  computeEnrichmentStats,
  contactToEnrichable,
  getProfileCargo,
  matchesEnrichmentFilter,
  type EnrichmentFilterId,
} from "@/lib/email-marketing-enrichment";
import { ContactFormDialog } from "./contact-form-dialog";
import { ContactDetailDialog } from "./contact-detail-dialog";
import { ImportContactsDialog } from "./import-contacts-dialog";
import { CompanyDetailDialog } from "./company-detail-dialog";
import { ContactAvatar, TagList } from "./email-marketing-ui";
import {
  ClientCell,
  ClientPicker,
  clientOf,
  ContactStatusPill,
  IconeArea,
  MetricBand,
  summarizeClients,
  useClientGroupsMeta,
  type ClientOption,
} from "./email-marketing-visuals";

interface ContactsTabProps {
  contacts: EmailContact[];
  companies: EmailCompany[];
  onChanged: () => void;
}

/** O que a faixa de números filtra. */
type View = "todos" | "inscritos" | "sem_cliente" | "incompletos" | "fora";

const PENDENCIAS: { id: EnrichmentFilterId; label: string }[] = [
  { id: "all", label: "Qualquer cadastro" },
  { id: "sem_cargo", label: "Sem cargo" },
  { id: "sem_telefone", label: "Sem telefone" },
  { id: "sem_area", label: "Sem área" },
  { id: "completo", label: "Cadastro completo" },
];

const PAGE = 60;

export function ContactsTab({ contacts, companies, onChanged }: ContactsTabProps) {
  const groupsMeta = useClientGroupsMeta();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("todos");
  const [client, setClient] = useState("__all__");
  const [pendencia, setPendencia] = useState<EnrichmentFilterId>("all");
  const [limit, setLimit] = useState(PAGE);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<EmailContact | null>(null);
  const [viewing, setViewing] = useState<EmailContact | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<EmailCompany | null>(null);
  const [companyDetailOpen, setCompanyDetailOpen] = useState(false);

  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);

  const counts = useMemo(() => {
    const enrichment = computeEnrichmentStats(contacts.map(contactToEnrichable));
    return {
      total: contacts.length,
      subscribed: contacts.filter((c) => c.status === "subscribed").length,
      withoutClient: contacts.filter((c) => !clientOf(c)).length,
      incomplete: enrichment.incompleto,
      out: contacts.filter((c) => c.status !== "subscribed").length,
    };
  }, [contacts]);

  const clientOptions: ClientOption[] = useMemo(() => summarizeClients(contacts).clients, [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (view === "inscritos" && c.status !== "subscribed") return false;
      if (view === "fora" && c.status === "subscribed") return false;
      if (view === "sem_cliente" && clientOf(c)) return false;
      if (view === "incompletos" && !matchesEnrichmentFilter(contactToEnrichable(c), "incompleto")) return false;
      if (client !== "__all__" && clientOf(c)?.key !== client) return false;
      if (!matchesEnrichmentFilter(contactToEnrichable(c), pendencia)) return false;
      if (!q) return true;
      return (
        c.email.toLowerCase().includes(q) ||
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.companyName ?? c.company ?? "").toLowerCase().includes(q) ||
        (c.clientGroupName ?? "").toLowerCase().includes(q) ||
        (c.cargo ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search, view, client, pendencia]);

  const hasFilters = search.trim() !== "" || client !== "__all__" || pendencia !== "all" || view !== "todos";
  const visible = filtered.slice(0, limit);

  const resetPage = () => setLimit(PAGE);

  const openDetail = (contact: EmailContact) => {
    setViewing(contact);
    setDetailOpen(true);
  };

  const openCompany = (company: EmailCompany) => {
    setSelectedCompany(company);
    setCompanyDetailOpen(true);
  };

  const handleDelete = async (contact: EmailContact) => {
    if (!confirm(`Remover ${contact.email} da base de contatos?`)) return;
    await deleteEmailContact(contact.id);
    onChanged();
  };

  const pct = (n: number) => (counts.total ? Math.round((n / counts.total) * 100) : 0);

  return (
    <div className="space-y-4">
      <MetricBand
        active={view}
        onSelect={(id) => {
          setView((current) => (current === id && id !== "todos" ? "todos" : (id as View)));
          resetPage();
        }}
        metrics={[
          { id: "todos", icon: Users, label: "Contatos na base", value: counts.total.toLocaleString("pt-BR"), hint: "clientes do SIOE e do RD" },
          {
            id: "inscritos",
            icon: UserCheck,
            label: "Inscritos",
            value: counts.subscribed.toLocaleString("pt-BR"),
            hint: `${pct(counts.subscribed)}% podem receber campanhas`,
          },
          {
            id: "sem_cliente",
            icon: Building2,
            label: "Sem cliente vinculado",
            value: counts.withoutClient.toLocaleString("pt-BR"),
            hint: "sem grupo nem empresa",
            warn: counts.withoutClient > 0,
          },
          {
            id: "incompletos",
            icon: ClipboardList,
            label: "Cadastro incompleto",
            value: counts.incomplete.toLocaleString("pt-BR"),
            hint: "falta cargo, telefone ou área",
            warn: counts.incomplete > 0,
          },
          {
            id: "fora",
            icon: MailX,
            label: "Fora das campanhas",
            value: counts.out.toLocaleString("pt-BR"),
            hint: "descadastrados e e-mails inválidos",
          },
        ]}
      />

      <section className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#eaf2f5] p-3 xl:flex-row xl:items-center">
          <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_200px]">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail, cargo ou cliente"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
                className="pl-8"
                aria-label="Buscar contatos"
              />
            </div>
            <ClientPicker
              options={clientOptions}
              value={client}
              onChange={(key) => {
                setClient(key);
                resetPage();
              }}
            />
            <Select
              value={pendencia}
              onValueChange={(v) => {
                setPendencia(v as EnrichmentFilterId);
                resetPage();
              }}
            >
              <SelectTrigger className="w-full bg-white" aria-label="Filtrar por cadastro">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PENDENCIAS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" className="flex-1 gap-2 xl:flex-none" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Importar planilha
            </Button>
            <Button
              className="flex-1 gap-2 xl:flex-none"
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

        <div className="flex items-center justify-between gap-2 px-4 py-2 text-xs text-[#5a717b]">
          <span className="tabular-nums">
            {filtered.length === contacts.length
              ? `${contacts.length.toLocaleString("pt-BR")} contatos`
              : `${filtered.length.toLocaleString("pt-BR")} de ${contacts.length.toLocaleString("pt-BR")} contatos`}
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setClient("__all__");
                setPendencia("all");
                setView("todos");
                resetPage();
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-[#285f7a] hover:bg-[#eaf2f5]"
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          )}
        </div>

        <div
          className="hidden border-y border-[#eaf2f5] bg-[#f7fafb] px-4 py-2 text-xs font-medium text-[#5a717b] lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.1fr)_150px_minmax(0,0.8fr)_130px_92px] lg:gap-4"
          aria-hidden
        >
          <span>Contato</span>
          <span>Cliente</span>
          <span>Área no escritório</span>
          <span>Tags</span>
          <span>Situação</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eaf2f5] text-[#285f7a]">
              <Users className="h-5 w-5" />
            </span>
            <p className="font-medium text-[#0d2a38]">{contacts.length === 0 ? "Nenhum contato ainda" : "Ninguém com esses filtros"}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {contacts.length === 0
                ? "Importe a planilha da base ou sincronize o SIOE e o RD em Configurações."
                : "Limpe os filtros ou troque o cliente para ver os outros contatos."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#eaf2f5]">
            {visible.map((contact) => {
              const company = contact.companyId ? companyById.get(contact.companyId) : undefined;
              const cargo = getProfileCargo(contactToEnrichable(contact));
              const area = contact.clientGroupId ? groupsMeta.get(contact.clientGroupId)?.responsibleArea : null;
              const ref = clientOf(contact);
              return (
                <li
                  key={contact.id}
                  className="group relative grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-[#f5f9fa] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.1fr)_150px_minmax(0,0.8fr)_130px_92px] lg:items-center lg:gap-4"
                  onClick={() => openDetail(contact)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ContactAvatar contact={contact} />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(contact);
                        }}
                        className="block max-w-full truncate text-left text-sm font-medium text-[#0d2a38] hover:text-[#285f7a] focus-visible:outline-none focus-visible:underline"
                      >
                        {contact.name ?? contact.email}
                      </button>
                      <p className="truncate text-xs text-muted-foreground">
                        {cargo ? <span className="text-[#3b5560]">{cargo} · </span> : null}
                        {contact.name ? contact.email : <span className="italic">nome não informado</span>}
                      </p>
                    </div>
                  </div>

                  <div className="justify-self-end lg:order-5 lg:justify-self-start">
                    <ContactStatusPill status={contact.status} />
                  </div>

                  <div className="col-span-2 min-w-0 lg:order-2 lg:col-span-1">
                    {company && ref ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCompany(company);
                        }}
                        className="-mx-1.5 block max-w-full rounded-md px-1.5 py-1 text-left hover:bg-[#eaf2f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
                        title="Ver a empresa"
                      >
                        <ClientCell group={ref.group} company={ref.company} />
                      </button>
                    ) : (
                      <ClientCell group={ref?.group} company={ref?.company} />
                    )}
                  </div>

                  <div className="hidden min-w-0 lg:order-3 lg:block">
                    {area ? (
                      <span className="inline-flex max-w-full items-center gap-1.5 text-xs text-[#3b5560]">
                        <IconeArea area={area} tamanho="sm" />
                        <span className="truncate">{area}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  <div className="hidden min-w-0 lg:order-4 lg:block">
                    <TagList tags={contact.tags} />
                  </div>

                  <div className="hidden justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100 lg:order-6 lg:flex">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ${contact.name ?? contact.email}`}
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
                      aria-label={`Remover ${contact.name ?? contact.email}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(contact);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length > visible.length && (
          <div className="flex flex-col items-center gap-1 border-t border-[#eaf2f5] px-4 py-3 sm:flex-row sm:justify-between">
            <span className="text-xs tabular-nums text-muted-foreground">
              Mostrando {visible.length} de {filtered.length.toLocaleString("pt-BR")}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setLimit((n) => n + PAGE * 2)}>
              Mostrar mais {Math.min(PAGE * 2, filtered.length - visible.length)}
            </Button>
          </div>
        )}
      </section>

      <ContactFormDialog open={formOpen} onOpenChange={setFormOpen} contact={editing} companies={companies} onSaved={onChanged} />
      <ContactDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contact={viewing}
        company={viewing?.companyId ? companyById.get(viewing.companyId) : undefined}
        area={viewing?.clientGroupId ? groupsMeta.get(viewing.clientGroupId)?.responsibleArea ?? null : null}
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
      <CompanyDetailDialog open={companyDetailOpen} onOpenChange={setCompanyDetailOpen} company={selectedCompany} />
    </div>
  );
}
