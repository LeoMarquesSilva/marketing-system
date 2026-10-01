"use client";

import { useMemo, useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Check, ChevronDown, Search, UsersRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { User } from "@/lib/users";
import { isUserActive, sortUsersActiveFirst } from "@/lib/user-status";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

export function EventTaskAssignees({ users, value, onChange, disabled = false }: {
  users: User[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = value.map(id => users.find(user => user.id === id)).filter((user): user is User => Boolean(user));
  const options = useMemo(() => {
    const query = search.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const matching = sortUsersActiveFirst(users).filter(user =>
      !query || [user.name, user.department, user.email].some(field => field?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(query))
    );
    return matching.slice(0, 40);
  }, [search, users]);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id]);
  }

  return <div className="space-y-2">
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
      <PopoverPrimitive.Trigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-label="Selecionar responsáveis" aria-expanded={open} disabled={disabled} className="h-10 w-full justify-between font-normal">
          <span className="flex min-w-0 items-center gap-2 truncate">
            <UsersRound className="size-4 shrink-0 text-muted-foreground" />
            {selected.length ? `${selected.length} ${selected.length === 1 ? "responsável" : "responsáveis"}` : "Selecionar pessoas"}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" sideOffset={4} className="z-[100] w-[var(--radix-popover-trigger-width)] min-w-[290px] rounded-xl border bg-popover p-2 shadow-lg">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input autoFocus aria-label="Buscar responsáveis" placeholder="Buscar por nome, área ou e-mail" value={search} onChange={event => setSearch(event.target.value)} className="h-9 pl-9" />
          </div>
          <div role="group" aria-label="Pessoas disponíveis" className="max-h-60 space-y-0.5 overflow-y-auto">
            {options.map(user => {
              const chosen = value.includes(user.id);
              return <button key={user.id} type="button" aria-pressed={chosen} onClick={() => toggle(user.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary">
                <Avatar className="size-7"><AvatarImage src={user.avatar_url || undefined} alt="" /><AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback></Avatar>
                <span className="min-w-0 flex-1 truncate"><span className="block truncate font-medium">{user.name}</span><span className="block truncate text-[11px] text-muted-foreground">{isUserActive(user) ? user.department : "Ex-colaborador"}</span></span>
                <span className={`flex size-5 shrink-0 items-center justify-center rounded border ${chosen ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>{chosen && <Check className="size-3.5" />}</span>
              </button>;
            })}
            {!options.length && <p className="px-2 py-4 text-center text-xs text-muted-foreground">Nenhuma pessoa encontrada.</p>}
          </div>
          {users.length > options.length && !search.trim() && <p className="border-t px-2 pt-2 text-xs text-muted-foreground">Digite para buscar entre {users.length} pessoas.</p>}
          <div className="mt-2 flex items-center justify-between border-t pt-2"><span className="text-xs text-muted-foreground">{value.length} selecionada{value.length === 1 ? "" : "s"}</span><Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Concluído</Button></div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
    {value.length > 0 && <div aria-label="Responsáveis selecionados" className="flex flex-wrap gap-1.5">
      {value.map(id => {
        const user = users.find(item => item.id === id);
        return <span key={id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/40 py-0.5 pl-0.5 pr-2 text-xs">
          <Avatar className="size-5"><AvatarImage src={user?.avatar_url || undefined} alt="" /><AvatarFallback className="text-[9px]">{initials(user?.name ?? "?")}</AvatarFallback></Avatar>
          <span className="truncate">{user?.name ?? "Pessoa indisponível"}</span>
          <button type="button" disabled={disabled} aria-label={`Remover ${user?.name ?? "responsável"}`} onClick={() => toggle(id)} className="rounded-full px-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">×</button>
        </span>;
      })}
    </div>}
  </div>;
}
