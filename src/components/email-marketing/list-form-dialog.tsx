"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Search, Tag as TagIcon, Users, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createEmailList,
  fetchListContactIds,
  setListContacts,
  type EmailContact,
  type EmailList,
} from "@/lib/email-marketing";

interface ListFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: EmailList | null;
  contacts: EmailContact[];
  onSaved: () => void;
}

type StatusFilter = "subscribed" | "all";

function contactCompanyLabel(contact: EmailContact): string | null {
  return contact.companyName?.trim() || contact.company?.trim() || null;
}

function ChecklistPanel({
  icon: Icon,
  title,
  items,
  activeValues,
  onToggle,
  emptyLabel,
}: {
  icon: typeof Building2;
  title: string;
  items: { value: string; label: string; count: number }[];
  activeValues: Set<string>;
  onToggle: (value: string) => void;
  emptyLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
        {activeValues.size > 0 && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {activeValues.size}
          </Badge>
        )}
      </Label>
      <div className="max-h-36 overflow-y-auto rounded-md border divide-y">
        {items.length === 0 && (
          <p className="p-3 text-xs text-muted-foreground text-center">{emptyLabel}</p>
        )}
        {items.map((item) => (
          <label
            key={item.value}
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-accent/50"
          >
            <span className="flex items-center gap-2 min-w-0">
              <input
                type="checkbox"
                checked={activeValues.has(item.value)}
                onChange={() => onToggle(item.value)}
                className="h-3.5 w-3.5 rounded border-input shrink-0"
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="text-muted-foreground shrink-0">{item.count}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function ListFormDialog({ open, onOpenChange, list, contacts, onSaved }: ListFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("subscribed");
  const [companyFilter, setCompanyFilter] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(list?.name ?? "");
    setDescription(list?.description ?? "");
    setSearch("");
    setStatusFilter("subscribed");
    setCompanyFilter(new Set());
    setTagFilter(new Set());
    setError(null);
    if (list) {
      fetchListContactIds(list.id).then((ids) => setSelected(new Set(ids)));
    } else {
      setSelected(new Set());
    }
  }, [open, list]);

  const baseContacts = useMemo(
    () => (statusFilter === "subscribed" ? contacts.filter((c) => c.status === "subscribed") : contacts),
    [contacts, statusFilter]
  );

  const companyOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of baseContacts) {
      const label = contactCompanyLabel(c);
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
  }, [baseContacts]);

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of baseContacts) {
      for (const tag of c.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
  }, [baseContacts]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseContacts.filter((c) => {
      if (q) {
        const matchesText =
          c.email.toLowerCase().includes(q) ||
          (c.name ?? "").toLowerCase().includes(q) ||
          (contactCompanyLabel(c) ?? "").toLowerCase().includes(q);
        if (!matchesText) return false;
      }
      if (companyFilter.size > 0) {
        const label = contactCompanyLabel(c);
        if (!label || !companyFilter.has(label)) return false;
      }
      if (tagFilter.size > 0) {
        if (!c.tags.some((t) => tagFilter.has(t))) return false;
      }
      return true;
    });
  }, [baseContacts, search, companyFilter, tagFilter]);

  const hasActiveFilters = search.trim().length > 0 || companyFilter.size > 0 || tagFilter.size > 0;
  const filteredNotYetSelected = filteredContacts.filter((c) => !selected.has(c.id));

  const toggleContact = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSetValue = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const addAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of filteredContacts) next.add(c.id);
      return next;
    });
  };

  const removeAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of filteredContacts) next.delete(c.id);
      return next;
    });
  };

  const selectedContacts = useMemo(
    () => contacts.filter((c) => selected.has(c.id)),
    [contacts, selected]
  );

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Informe um nome para a lista.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const listId = list ? list.id : (await createEmailList(name, description)).id;
      await setListContacts(listId, [...selected]);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar lista.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="!flex flex-col gap-0 p-0 overflow-hidden sm:max-w-3xl w-[95vw] max-h-[88vh]"
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>{list ? "Editar lista" : "Nova lista"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="list-name">Nome *</Label>
              <Input
                id="list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Clientes ativos"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="list-description">Descrição</Label>
              <Input
                id="list-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Segmentação
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status do contato</Label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subscribed">Apenas inscritos</SelectItem>
                    <SelectItem value="all">Todos os contatos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Buscar por nome, e-mail ou empresa</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Digite para filtrar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ChecklistPanel
                icon={Building2}
                title="Empresa"
                items={companyOptions}
                activeValues={companyFilter}
                onToggle={(v) => toggleSetValue(setCompanyFilter, v)}
                emptyLabel="Nenhuma empresa cadastrada."
              />
              <ChecklistPanel
                icon={TagIcon}
                title="Tags"
                items={tagOptions}
                activeValues={tagFilter}
                onToggle={(v) => toggleSetValue(setTagFilter, v)}
                emptyLabel="Nenhuma tag cadastrada."
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-xs text-muted-foreground">
                {hasActiveFilters ? (
                  <>
                    <span className="font-medium text-foreground">{filteredContacts.length}</span> contato(s)
                    correspondem aos filtros
                    {filteredNotYetSelected.length > 0 && (
                      <> — {filteredNotYetSelected.length} ainda fora da lista</>
                    )}
                  </>
                ) : (
                  `${filteredContacts.length} contato(s) na base considerada`
                )}
              </p>
              {hasActiveFilters && (
                <div className="flex gap-1.5">
                  <Button type="button" size="xs" variant="outline" onClick={removeAllFiltered}>
                    Remover filtrados da lista
                  </Button>
                  <Button type="button" size="xs" onClick={addAllFiltered} disabled={filteredContacts.length === 0}>
                    Adicionar {filteredContacts.length} filtrado(s) à lista
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Contatos na lista ({selected.size})
              </Label>
              {selected.size > 0 && (
                <Button type="button" variant="ghost" size="xs" onClick={() => setSelected(new Set())}>
                  Limpar seleção
                </Button>
              )}
            </div>

            {selectedContacts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 rounded-md border bg-background p-2 max-h-24 overflow-y-auto">
                {selectedContacts.map((c) => (
                  <Badge key={c.id} variant="secondary" className="gap-1 pr-1 font-normal">
                    <span className="max-w-40 truncate">{c.name || c.email}</span>
                    <button
                      type="button"
                      onClick={() => toggleContact(c.id)}
                      className="rounded-full hover:bg-background/60 p-0.5"
                      title="Remover da lista"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
              {filteredContacts.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  Nenhum contato encontrado com os filtros atuais.
                </p>
              )}
              {filteredContacts.map((contact) => {
                const companyLabel = contactCompanyLabel(contact);
                return (
                  <label
                    key={contact.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent/50",
                      selected.has(contact.id) && "bg-primary/5"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(contact.id)}
                      onChange={() => toggleContact(contact.id)}
                      className="h-4 w-4 rounded border-input shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {contact.name || contact.email}
                      {contact.name && <span className="text-muted-foreground"> — {contact.email}</span>}
                    </span>
                    {companyLabel && (
                      <span className="shrink-0 text-xs text-muted-foreground truncate max-w-32">
                        {companyLabel}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
