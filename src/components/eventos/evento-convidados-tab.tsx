"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserSelectSearch } from "@/components/solicitacoes/user-select-search";
import { GUEST_TYPE_LABEL, type EventInvite, type GuestType } from "@/lib/eventos";
import type { User } from "@/lib/users";

export function EventoConvidadosTab({
  invites,
  users,
  onAddInvite,
  onDeleteInvite,
  onDeleteManyInvites,
  isLoading = false,
}: {
  invites: EventInvite[];
  users: User[];
  onAddInvite: (input: { name: string; email?: string; guestType: GuestType }) => void;
  onDeleteInvite: (id: string) => void;
  onDeleteManyInvites: (ids: string[]) => void;
  isLoading?: boolean;
}) {
  const [name, setName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [email, setEmail] = useState("");
  const [guestType, setGuestType] = useState<GuestType>("convidado_externo");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<GuestType | "__all__">("__all__");
  const [selected, setSelected] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "type_asc">("name_asc");

  const filteredInvites = useMemo(() => {
    const base = invites.filter((guest) => {
      if (filterType !== "__all__" && guest.guestType !== filterType) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        guest.name.toLowerCase().includes(s) ||
        (guest.email ?? "").toLowerCase().includes(s) ||
        (guest.company ?? "").toLowerCase().includes(s)
      );
    });
    if (sortBy === "name_desc") return [...base].sort((a, b) => b.name.localeCompare(a.name, "pt-BR"));
    if (sortBy === "type_asc") return [...base].sort((a, b) => GUEST_TYPE_LABEL[a.guestType].localeCompare(GUEST_TYPE_LABEL[b.guestType], "pt-BR"));
    return [...base].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [invites, search, filterType, sortBy]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="grid gap-2 md:grid-cols-4">
          {guestType === "colaborador" ? (
            <UserSelectSearch
              users={users}
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              onSelect={(u) => {
                setName(u.name);
                setEmail(u.email ?? "");
              }}
              placeholder="Selecionar colaborador"
              allowClear
            />
          ) : (
            <Input placeholder="Nome *" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <Input placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={guestType}
            onChange={(e) => {
              setGuestType(e.target.value as GuestType);
              setName("");
              setEmail("");
              setSelectedUserId("");
            }}
          >
            {(Object.keys(GUEST_TYPE_LABEL) as GuestType[]).map((g) => (
              <option key={g} value={g}>
                {GUEST_TYPE_LABEL[g]}
              </option>
            ))}
          </select>
          <Button
            onClick={() => {
              if (!name.trim()) return;
              onAddInvite({ name: name.trim(), email: email.trim() || undefined, guestType });
              setName("");
              setEmail("");
              setSelectedUserId("");
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar convidado
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-4 mt-2">
          <Input placeholder="Buscar convidado..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as GuestType | "__all__")}
          >
            <option value="__all__">Todos os tipos</option>
            {(Object.keys(GUEST_TYPE_LABEL) as GuestType[]).map((g) => (
              <option key={g} value={g}>
                {GUEST_TYPE_LABEL[g]}
              </option>
            ))}
          </select>
          <div className="h-9 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground flex items-center">
            {filteredInvites.length} convidado(s) exibido(s)
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name_asc" | "name_desc" | "type_asc")}
          >
            <option value="name_asc">Ordenar: nome A-Z</option>
            <option value="name_desc">Ordenar: nome Z-A</option>
            <option value="type_asc">Ordenar: tipo</option>
          </select>
        </div>
        {selected.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onDeleteManyInvites(selected);
                setSelected([]);
              }}
            >
              Remover selecionados ({selected.length})
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Limpar seleção
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <input
                  type="checkbox"
                  checked={filteredInvites.length > 0 && selected.length === filteredInvites.length}
                  onChange={(e) =>
                    setSelected(e.target.checked ? filteredInvites.map((i) => i.id) : [])
                  }
                />
              </TableHead>
              <TableHead>
                <button type="button" className="hover:underline" onClick={() => setSortBy(sortBy === "name_asc" ? "name_desc" : "name_asc")}>
                  Nome
                </button>
              </TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>
                <button type="button" className="hover:underline" onClick={() => setSortBy("type_asc")}>
                  Tipo
                </button>
              </TableHead>
              <TableHead>Status convite</TableHead>
              <TableHead>Confirmação</TableHead>
              <TableHead>Presença</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvites.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum convidado cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredInvites.map((guest) => (
                <TableRow key={guest.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.includes(guest.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelected((prev) => [...prev, guest.id]);
                        else setSelected((prev) => prev.filter((id) => id !== guest.id));
                      }}
                    />
                  </TableCell>
                  <TableCell>{guest.name}</TableCell>
                  <TableCell>{guest.email || "—"}</TableCell>
                  <TableCell>{GUEST_TYPE_LABEL[guest.guestType]}</TableCell>
                  <TableCell>{guest.inviteStatus}</TableCell>
                  <TableCell>{guest.confirmationStatus}</TableCell>
                  <TableCell>{guest.attended == null ? "—" : guest.attended ? "Sim" : "Não"}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => onDeleteInvite(guest.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        )}
      </div>
    </div>
  );
}
