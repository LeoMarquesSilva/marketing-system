"use client";

import { useState, useMemo } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChevronDown, Search } from "lucide-react";
import type { User } from "@/lib/users";
import { isUserActive, sortUsersActiveFirst } from "@/lib/user-status";
import { FormerEmployeeBadge } from "@/components/usuarios/former-employee-badge";
import { cn } from "@/lib/utils";

const DISPLAY_LIMIT = 20;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface UserSelectSearchProps {
  users: User[];
  value: string;
  onValueChange: (value: string) => void;
  onSelect?: (user: User) => void;
  placeholder?: string;
  /** Filtra usuários pelo departamento (área) */
  departmentFilter?: string;
  allowClear?: boolean;
  disabled?: boolean;
}

export function UserSelectSearch({
  users,
  value,
  onValueChange,
  onSelect,
  placeholder = "Pesquisar ou selecionar solicitante",
  departmentFilter,
  allowClear = false,
  disabled = false,
}: UserSelectSearchProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const departmentHasMatch = useMemo(
    () => !departmentFilter || users.some((u) => u.department === departmentFilter),
    [users, departmentFilter]
  );

  const pool = useMemo(() => {
    let list = users;
    if (departmentFilter) {
      const matched = users.filter((u) => u.department === departmentFilter);
      // Sem ninguém nesse departamento (ex.: área recém-criada sem correspondência) → não esconde todo mundo
      list = matched.length > 0 ? matched : users;
      const selected = users.find((u) => u.id === value);
      if (selected && !list.some((u) => u.id === selected.id)) {
        list = [selected, ...list];
      }
    }
    return sortUsersActiveFirst(list);
  }, [users, departmentFilter, value]);

  const selected = users.find((u) => u.id === value);

  const filtered = useMemo(() => {
    const base = !search.trim()
      ? pool
      : pool.filter((u) => {
          const q = search.trim().toLowerCase();
          return (
            u.name.toLowerCase().includes(q) ||
            (u.department ?? "").toLowerCase().includes(q) ||
            (u.email ?? "").toLowerCase().includes(q) ||
            (!isUserActive(u) && "ex-funcionário".includes(q))
          );
        });
    return base.slice(0, DISPLAY_LIMIT);
  }, [pool, search]);

  const inactiveInPool = pool.filter((u) => !isUserActive(u)).length;

  const handleSelect = (user: User) => {
    onValueChange(user.id);
    onSelect?.(user);
    setOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    onValueChange("");
    setOpen(false);
    setSearch("");
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between h-9 font-normal"
          onClick={() => !disabled && !open && setOpen(true)}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate min-w-0">
              <Avatar className={cn("h-5 w-5 shrink-0", !isUserActive(selected) && "opacity-70")}>
                <AvatarImage src={selected.avatar_url || undefined} alt={selected.name} />
                <AvatarFallback className="text-[10px]">{getInitials(selected.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{selected.name}</span>
              {!isUserActive(selected) && <FormerEmployeeBadge />}
              <span className="text-muted-foreground text-sm hidden sm:inline truncate">
                ({selected.department})
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="z-[100] w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 rounded-xl border bg-popover shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          align="start"
          sideOffset={4}
        >
          <div className="p-2 border-b space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  departmentFilter && departmentHasMatch
                    ? `Buscar em ${departmentFilter} (inclui ex-funcionários)...`
                    : "Buscar por nome, área ou email..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8"
                autoFocus
              />
            </div>
            {departmentFilter && !departmentHasMatch && (
              <p className="text-[11px] text-amber-600 px-0.5">
                Ninguém tem o departamento &quot;{departmentFilter}&quot; cadastrado — mostrando todos.
              </p>
            )}
            {inactiveInPool > 0 && (
              <p className="text-[11px] text-muted-foreground px-0.5">
                Inclui {inactiveInPool} ex-funcionário{inactiveInPool !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <ul className="max-h-[240px] overflow-y-auto p-1">
            {allowClear && (
              <li>
                <button
                  type="button"
                  onClick={handleClear}
                  className="w-full rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent"
                >
                  Nenhum
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="py-4 text-center text-sm text-muted-foreground">
                {departmentFilter && departmentHasMatch
                  ? `Nenhum colaborador em ${departmentFilter}`
                  : "Nenhum resultado"}
              </li>
            ) : (
              filtered.map((user) => {
                const inactive = !isUserActive(user);
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(user)}
                      className={cn(
                        "w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
                        value === user.id && "bg-accent",
                        inactive && "opacity-90"
                      )}
                    >
                      <Avatar className={cn("h-6 w-6 shrink-0", inactive && "opacity-75")}>
                        <AvatarImage src={user.avatar_url || undefined} alt={user.name} />
                        <AvatarFallback className="text-[10px]">{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn("font-medium", inactive && "text-muted-foreground")}>
                            {user.name}
                          </span>
                          {inactive && <FormerEmployeeBadge />}
                        </div>
                        {(!departmentFilter || !departmentHasMatch) && (
                          <span className="text-muted-foreground text-xs">
                            {user.department}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {pool.length > DISPLAY_LIMIT && !search.trim() && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground border-t">
              Digite para buscar entre {pool.length} pessoa{pool.length !== 1 ? "s" : ""}
            </p>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
