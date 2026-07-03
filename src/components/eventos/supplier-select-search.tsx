"use client";

import { useMemo, useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { ChevronDown, Plus, Search, Truck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SUPPLIER_CATEGORY_LABEL, type EventSupplier } from "@/lib/eventos";
import { cn } from "@/lib/utils";

const DISPLAY_LIMIT = 20;

interface SupplierSelectSearchProps {
  suppliers: EventSupplier[];
  value: string;
  onChange: (name: string) => void;
  onPickExisting?: (supplier: EventSupplier) => void;
  onCreateNew: (prefillName: string) => void;
  placeholder?: string;
}

export function SupplierSelectSearch({
  suppliers,
  value,
  onChange,
  onPickExisting,
  onCreateNew,
  placeholder = "Buscar ou selecionar fornecedor",
}: SupplierSelectSearchProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = useMemo(
    () => suppliers.find((s) => s.name.toLowerCase() === value.trim().toLowerCase()),
    [suppliers, value]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = !q ? suppliers : suppliers.filter((s) => s.name.toLowerCase().includes(q));
    return base.slice(0, DISPLAY_LIMIT);
  }, [suppliers, search]);

  function handleSelect(supplier: EventSupplier) {
    onChange(supplier.name);
    onPickExisting?.(supplier);
    setOpen(false);
    setSearch("");
  }

  function handleCreate() {
    onCreateNew(search.trim());
    setOpen(false);
    setSearch("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-9 font-normal"
          onClick={() => !open && setOpen(true)}
        >
          {value ? (
            <span className="flex items-center gap-2 truncate min-w-0">
              <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{value}</span>
              {selected && (
                <span className="text-muted-foreground text-xs hidden sm:inline truncate">
                  ({SUPPLIER_CATEGORY_LABEL[selected.category as keyof typeof SUPPLIER_CATEGORY_LABEL] ?? selected.category})
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <span className="flex items-center gap-1 shrink-0">
            {value && (
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" onClick={handleClear} />
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </span>
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
                placeholder="Buscar fornecedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8"
                autoFocus
              />
            </div>
          </div>
          <ul className="max-h-[220px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="py-4 text-center text-sm text-muted-foreground">Nenhum fornecedor encontrado</li>
            ) : (
              filtered.map((supplier) => (
                <li key={supplier.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(supplier)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
                      value.toLowerCase() === supplier.name.toLowerCase() && "bg-accent"
                    )}
                  >
                    <span className="truncate font-medium">{supplier.name}</span>
                    <span className="text-muted-foreground text-xs shrink-0">
                      {SUPPLIER_CATEGORY_LABEL[supplier.category as keyof typeof SUPPLIER_CATEGORY_LABEL] ?? supplier.category}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="p-1 border-t">
            <button
              type="button"
              onClick={handleCreate}
              className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-violet-700 transition-colors hover:bg-violet-50"
            >
              <Plus className="h-4 w-4" />
              {search.trim() ? (
                <span className="truncate">
                  Cadastrar novo fornecedor &quot;<strong>{search.trim()}</strong>&quot;
                </span>
              ) : (
                "Cadastrar novo fornecedor"
              )}
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
