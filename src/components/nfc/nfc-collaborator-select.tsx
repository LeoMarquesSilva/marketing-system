"use client";

import { useId, useMemo, useState } from "react";
import { Check, ChevronDown, Search, UserRound } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { NfcDirectoryUser } from "@/lib/nfc/types";

const DISPLAY_LIMIT = 30;

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

interface NfcCollaboratorSelectProps {
  id: string;
  users: NfcDirectoryUser[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function NfcCollaboratorSelect({
  id,
  users,
  value,
  onValueChange,
  placeholder = "Selecione o colaborador",
  required = false,
  disabled = false,
}: NfcCollaboratorSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listId = useId();
  const selected = users.find((user) => user.id === value);

  const filteredUsers = useMemo(() => {
    const query = normalizeSearch(search);
    if (!query) return users.slice(0, DISPLAY_LIMIT);

    return users
      .filter((user) =>
        normalizeSearch(`${user.name} ${user.department ?? ""}`).includes(query)
      )
      .slice(0, DISPLAY_LIMIT);
  }, [search, users]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearch("");
  };

  const handleSelect = (user: NfcDirectoryUser) => {
    onValueChange(user.id);
    setOpen(false);
    setSearch("");
  };

  const noUsers = users.length === 0;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange} modal>
      <PopoverPrimitive.Trigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          aria-required={required}
          disabled={disabled || noUsers}
          className={cn(
            "h-auto min-h-12 w-full justify-between rounded-xl border-[#cfe0e4] bg-white px-3 py-2 text-left font-normal shadow-none",
            "hover:bg-[#f7fbfb] focus-visible:border-[#47cdd0] focus-visible:ring-[#47cdd0]/25",
            !selected && "text-muted-foreground"
          )}
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-3">
              <Avatar className="size-9 border border-[#dce9eb] bg-[#e8f8f8]">
                <AvatarImage src={selected.avatarUrl || undefined} alt={selected.name} />
                <AvatarFallback className="bg-[#e8f8f8] text-xs font-semibold text-[#285f7a]">
                  {getInitials(selected.name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {selected.name}
                </span>
                {selected.department && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {selected.department}
                  </span>
                )}
              </span>
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e8f8f8] text-[#347796]">
                <UserRound className="size-4" />
              </span>
              <span className="truncate text-sm">
                {noUsers ? "Nenhum colaborador disponível" : placeholder}
              </span>
            </span>
          )}
          <ChevronDown className="ml-2 size-4 shrink-0 text-[#347796] opacity-70" />
        </Button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "z-[120] w-[var(--radix-popover-trigger-width)] min-w-[min(22rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] overflow-hidden",
            "rounded-2xl border border-[#cfe0e4] bg-white shadow-[0_24px_70px_-28px_rgba(3,32,47,0.48)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          <div className="border-b border-[#e5eef0] bg-[#f8fbfb] p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#347796]" />
              <Input
                type="search"
                inputMode="search"
                enterKeyHint="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou área"
                aria-label="Buscar colaborador"
                className="h-11 rounded-xl border-[#cfe0e4] bg-white pl-9 pr-3 text-base sm:text-sm"
              />
            </div>
          </div>

          <ul
            id={listId}
            role="listbox"
            aria-label="Colaboradores"
            className="max-h-[min(21rem,52dvh)] overflow-y-auto overscroll-contain p-1.5"
          >
            {filteredUsers.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum colaborador encontrado.
              </li>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = user.id === value;
                return (
                  <li key={user.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(user)}
                      className={cn(
                        "flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                        "hover:bg-[#eef8f8] focus-visible:bg-[#eef8f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/30",
                        isSelected && "bg-[#e8f8f8]"
                      )}
                    >
                      <Avatar className="size-10 border border-[#dce9eb] bg-[#e8f8f8]">
                        <AvatarImage src={user.avatarUrl || undefined} alt={user.name} />
                        <AvatarFallback className="bg-[#e8f8f8] text-xs font-semibold text-[#285f7a]">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {user.name}
                        </span>
                        {user.department && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {user.department}
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#347796] text-white">
                          <Check className="size-4" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {users.length > DISPLAY_LIMIT && !search.trim() && (
            <p className="border-t border-[#e5eef0] px-4 py-2.5 text-xs text-muted-foreground">
              Digite um nome para buscar entre {users.length} colaboradores.
            </p>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
