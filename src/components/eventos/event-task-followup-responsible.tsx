"use client";

import { useId, useMemo, useState } from "react";
import { Check, ChevronDown, Search, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { User } from "@/lib/users";
import { isUserActive, sortUsersActiveFirst } from "@/lib/user-status";
import { EventPerson } from "./event-person";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function EventTaskFollowUpResponsible({ users, externalNames = [], value, onChange, disabled = false }: {
  users: User[];
  externalNames?: string[];
  value: string[];
  onChange: (names: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listId = useId();
  const options = useMemo(() => {
    const names = new Set(users.map(user => normalize(user.name)));
    const externals = [...new Map([...externalNames, ...value].map(name => [normalize(name), name.trim()])).values()].filter(name => name && !names.has(normalize(name)));
    return [
      ...sortUsersActiveFirst(users).map(user => ({ key: user.id, name: user.name, avatar: user.avatar_url, detail: isUserActive(user) ? user.department || "Equipe" : "Ex-colaborador" })),
      ...externals.map(name => ({ key: `external:${normalize(name)}`, name, avatar: null, detail: "Responsável externo" })),
    ].filter(person => !search.trim() || normalize(`${person.name} ${person.detail}`).includes(normalize(search))).slice(0, 50);
  }, [externalNames, search, users, value]);
  const customName = search.trim();
  const offerCustom = customName.length > 0 && !options.some(person => normalize(person.name) === normalize(customName));

  function toggle(name: string) {
    onChange(value.some(item => normalize(item) === normalize(name)) ? value.filter(item => normalize(item) !== normalize(name)) : [...value, name]);
  }

  return <div className="min-w-0 space-y-2">
    <Button type="button" variant="outline" role="combobox" aria-label="Selecionar responsáveis do follow-up" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(current => !current)} disabled={disabled} className="h-11 w-full min-w-0 justify-between gap-2 rounded-lg bg-card px-3 font-normal shadow-none">
      <span className="flex min-w-0 items-center gap-2">
        {value.length ? <span className="flex shrink-0 items-center pl-1.5">{value.slice(0, 3).map((name, index) => <EventPerson key={`${normalize(name)}-${index}`} name={name} avatar={users.find(user => normalize(user.name) === normalize(name))?.avatar_url} compact className={index ? "-ml-2" : ""} />)}</span> : <UserRound className="size-4 shrink-0 text-muted-foreground" />}
        <span className={`min-w-0 truncate text-sm ${value.length ? "text-foreground" : "text-muted-foreground"}`}>{value.length ? `${value.length} ${value.length === 1 ? "responsável" : "responsáveis"}` : "Selecionar responsáveis"}</span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
    </Button>
    {open && <div id={listId} className="min-w-0 rounded-xl border border-border/70 bg-card p-2 shadow-sm">
      <div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input autoFocus aria-label="Buscar responsáveis do follow-up" placeholder="Buscar pessoa ou digitar nome externo" maxLength={120} value={search} onChange={event => setSearch(event.target.value)} className="h-9 pl-9" /></div>
      <div role="group" aria-label="Responsáveis disponíveis" className="max-h-56 space-y-0.5 overflow-y-auto">
        {options.map(person => {
          const selected = value.some(name => normalize(name) === normalize(person.name));
          return <button key={person.key} type="button" aria-pressed={selected} onClick={() => toggle(person.name)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"><EventPerson name={person.name} avatar={person.avatar} compact className="shrink-0" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{person.name}</span><span className="block truncate text-[11px] text-muted-foreground">{person.detail}</span></span><span className={`flex size-5 shrink-0 items-center justify-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>{selected && <Check className="size-3.5" />}</span></button>;
        })}
        {offerCustom && <button type="button" onClick={() => { toggle(customName); setSearch(""); }} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-2 py-2 text-left hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary"><EventPerson name={customName} compact className="shrink-0" /><span className="min-w-0 text-sm"><span className="block truncate font-medium">{customName}</span><span className="block text-[11px] text-muted-foreground">Adicionar responsável externo</span></span></button>}
        {!options.length && !offerCustom && <p className="px-2 py-3 text-sm text-muted-foreground">Nenhuma pessoa encontrada.</p>}
      </div>
      <div className="mt-2 flex items-center justify-between border-t px-1 pt-2"><span className="text-xs text-muted-foreground">{value.length} selecionado{value.length === 1 ? "" : "s"}</span><Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setSearch(""); }}>Concluído</Button></div>
    </div>}
    {value.length > 0 && <div aria-label="Responsáveis selecionados para o follow-up" className="flex flex-wrap gap-1.5">{value.map(name => <span key={normalize(name)} className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 py-0.5 pl-0.5 pr-1 text-xs"><EventPerson name={name} avatar={users.find(user => normalize(user.name) === normalize(name))?.avatar_url} compact className="shrink-0" /><span className="min-w-0 truncate font-medium">{name}</span><button type="button" disabled={disabled} aria-label={`Remover ${name}`} onClick={() => toggle(name)} className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"><X className="size-3" /></button></span>)}</div>}
  </div>;
}
