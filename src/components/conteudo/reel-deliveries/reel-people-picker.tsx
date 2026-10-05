"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CollaboratorAvatar } from "@/components/conteudo/content-schedule-visuals";
import type { ReelPerson } from "@/lib/reel-deliveries/types";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function ReelPeoplePicker({
  people,
  value,
  onChange,
  max = 8,
}: {
  people: ReelPerson[];
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const options = useMemo(() => {
    const term = normalize(search.trim());
    return people
      .filter((p) => !value.includes(p.id))
      .filter((p) => !term || normalize(`${p.name} ${p.area ?? ""}`).includes(term))
      .slice(0, 30);
  }, [people, search, value]);

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-2">
        {value.map((id) => {
          const person = byId.get(id) ?? { id, name: "Colaborador", avatarUrl: null };
          return (
            <li key={id} className="flex items-center gap-1.5 rounded-full border border-[#dce9eb] bg-white py-1 pl-1 pr-1.5 text-sm">
              <CollaboratorAvatar person={person} className="size-6" />
              <span className="max-w-[12rem] truncate">{person.name}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item !== id))}
                disabled={value.length === 1}
                className="grid size-6 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
                aria-label={`Remover ${person.name}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      {value.length < max && (
        <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm"><Plus />Adicionar pessoa</Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou área"
                className="pl-9"
                aria-label="Buscar pessoa"
              />
            </div>
            <ul className="mt-2 max-h-64 overflow-y-auto">
              {options.length === 0 && <li className="px-2 py-3 text-sm text-slate-500">Ninguém encontrado.</li>}
              {options.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => { onChange([...value, person.id]); setOpen(false); setSearch(""); }}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm hover:bg-[#f0fafa] focus-visible:bg-[#f0fafa] focus-visible:outline-none"
                  >
                    <CollaboratorAvatar person={person} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{person.name}</span>
                      {person.area && <span className="block truncate text-xs text-slate-500">{person.area}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
