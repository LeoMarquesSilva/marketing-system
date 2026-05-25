"use client";

import { useState, useMemo } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChevronDown, Search } from "lucide-react";
import type { User } from "@/lib/users";
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

  const pool = useMemo(() => {
    if (!departmentFilter) return users;
    const filtered = users.filter((u) => u.department === departmentFilter);
    const selected = users.find((u) => u.id === value);
    if (selected && !filtered.some((u) => u.id === selected.id)) {
      return [selected, ...filtered];
    }
    return filtered;
  }, [users, departmentFilter, value]);

  const selected = users.find((u) => u.id === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return pool.slice(0, DISPLAY_LIMIT);
    const q = search.trim().toLowerCase();
    return pool
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          (u.department ?? "").toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q)
      )
      .slice(0, DISPLAY_LIMIT);
  }, [pool, search]);

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
            <span className="flex items-center gap-2 truncate">
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarImage src={selected.avatar_url || undefined} alt={selected.name} />
                <AvatarFallback className="text-[10px]">{getInitials(selected.name)}</AvatarFallback>
              </Avatar>
              {selected.name}
              <span className="text-muted-foreground text-sm hidden sm:inline">
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
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  departmentFilter
                    ? `Buscar em ${departmentFilter}...`
                    : "Buscar por nome, área ou email..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8"
                autoFocus
              />
            </div>
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
                {departmentFilter
                  ? `Nenhum colaborador em ${departmentFilter}`
                  : "Nenhum resultado"}
              </li>
            ) : (
              filtered.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(user)}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
                      value === user.id && "bg-accent"
                    )}
                  >
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={user.avatar_url || undefined} alt={user.name} />
                      <AvatarFallback className="text-[10px]">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{user.name}</span>
                      {!departmentFilter && (
                        <span className="text-muted-foreground text-xs ml-1">
                          ({user.department})
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
          {pool.length > DISPLAY_LIMIT && !search.trim() && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground border-t">
              Digite para buscar entre {pool.length} colaborador{pool.length !== 1 ? "es" : ""}
            </p>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
