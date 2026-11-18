"use client";

import { useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  isScheduleTime,
  tastingLinkHref,
  type EventMenuItem,
  type EventTasting,
  type MenuStatus,
  type MenuType,
  type ParticipantStatus,
  type TastingParticipant,
  type TastingStatus,
} from "@/lib/eventos-programa";
import type { MenuItemInput, TastingInput } from "@/lib/eventos-programa-db";
import type { User } from "@/lib/users";

const SELECT = "h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40";

export function MenuItemDialog({
  item,
  menuType,
  sections,
  defaultSection,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  item: EventMenuItem | null;
  menuType: MenuType;
  sections: string[];
  defaultSection?: string;
  busy: boolean;
  onClose: () => void;
  onSave: (input: MenuItemInput) => void;
  onDelete?: () => void;
}) {
  const listId = useId();
  const [section, setSection] = useState(item?.section ?? defaultSection ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [vendor, setVendor] = useState(item?.vendorName ?? "");
  const [highlight, setHighlight] = useState(item?.highlight ?? false);
  const [status, setStatus] = useState<MenuStatus>(item?.status ?? "aprovado");
  const food = menuType === "comida";
  const valid = section.trim().length > 1 && name.trim().length > 1;
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <div className="border-b border-[#e6eef0] px-5 py-4 pr-12">
          <DialogTitle className="text-base">{item ? "Editar item do cardápio" : food ? "Novo prato" : "Nova bebida"}</DialogTitle>
          <DialogDescription className="text-sm">{food ? "Um prato e o momento em que ele é servido." : "Um drink ou bebida e o grupo a que pertence."}</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="cardapio-nome">{food ? "Prato" : "Bebida"}</Label>
            <Input id="cardapio-nome" value={name} onChange={(event) => setName(event.target.value)} autoFocus={!item} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cardapio-secao">{food ? "Momento" : "Grupo"}</Label>
              <Input id="cardapio-secao" list={listId} value={section} onChange={(event) => setSection(event.target.value)} placeholder={food ? "Ex.: Jantar" : "Ex.: Drinks do open bar"} />
              <datalist id={listId}>
                {sections.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cardapio-situacao">Situação</Label>
              <select id="cardapio-situacao" className={SELECT} value={status} onChange={(event) => setStatus(event.target.value as MenuStatus)}>
                <option value="aprovado">Aprovado</option>
                <option value="em_analise">Em análise</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cardapio-fornecedor">Fornecedor</Label>
              <Input id="cardapio-fornecedor" value={vendor} onChange={(event) => setVendor(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cardapio-obs">Observação</Label>
              <Input id="cardapio-obs" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: prato principal" />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
            <input type="checkbox" checked={highlight} onChange={(event) => setHighlight(event.target.checked)} className="size-4 accent-[#347796]" />
            Destacar este item
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          {onDelete && (
            <Button variant="ghost" size="sm" className="mr-auto text-rose-700" disabled={busy} onClick={onDelete}>
              Excluir
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy || !valid}
            onClick={() =>
              onSave({ menuType, section: section.trim(), name: name.trim(), note: note.trim() || null, highlight, status, vendorName: vendor.trim() || null })
            }
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Draft = TastingParticipant & { key: string };

export function TastingDialog({
  tasting,
  menuType,
  users,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  tasting: EventTasting | null;
  menuType: MenuType;
  users: User[];
  busy: boolean;
  onClose: () => void;
  onSave: (input: TastingInput) => void;
  onDelete?: () => void;
}) {
  const listId = useId();
  const [vendor, setVendor] = useState(tasting?.vendorName ?? "");
  const [date, setDate] = useState(tasting?.tastingDate ?? "");
  const [time, setTime] = useState(tasting?.tastingTime ?? "");
  const [location, setLocation] = useState(tasting?.location ?? "");
  const [link, setLink] = useState(tasting?.linkUrl ?? "");
  const [status, setStatus] = useState<TastingStatus>(tasting?.status ?? "agendada");
  const [result, setResult] = useState(tasting?.resultNote ?? "");
  const [people, setPeople] = useState<Draft[]>(() => (tasting?.participants ?? []).map((person, index) => ({ ...person, key: `p${index}` })));
  const active = users.filter((user) => user.is_active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const linkValid = !link.trim() || tastingLinkHref(link) != null;
  const timeValid = !time || isScheduleTime(time);
  const valid = vendor.trim().length > 1 && linkValid && timeValid;

  const patch = (key: string, change: Partial<Draft>) => setPeople((list) => list.map((person) => (person.key === key ? { ...person, ...change } : person)));
  const rename = (key: string, name: string) => {
    const match = active.find((user) => user.name.toLowerCase() === name.trim().toLowerCase());
    patch(key, { name, userId: match?.id ?? null });
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        <div className="border-b border-[#e6eef0] px-5 py-4 pr-12">
          <DialogTitle className="text-base">{tasting ? "Editar degustação" : "Nova degustação"}</DialogTitle>
          <DialogDescription className="text-sm">Quando, onde e quem vai. Depois da visita, registre o resultado.</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="degust-fornecedor">{menuType === "bebida" ? "Bar" : "Buffet"}</Label>
              <Input id="degust-fornecedor" value={vendor} onChange={(event) => setVendor(event.target.value)} autoFocus={!tasting} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="degust-situacao">Situação</Label>
              <select id="degust-situacao" className={SELECT} value={status} onChange={(event) => setStatus(event.target.value as TastingStatus)}>
                <option value="agendada">Agendada</option>
                <option value="realizada">Realizada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <DatePickerField value={date} onChange={setDate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="degust-hora">Horário</Label>
              <Input id="degust-hora" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="degust-local">Local</Label>
              <Input id="degust-local" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Endereço ou nome do lugar" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="degust-link">Link (Instagram ou site)</Label>
              <Input id="degust-link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://…" aria-invalid={!linkValid} />
              {!linkValid && <p className="text-xs text-rose-700">O link precisa começar com https://</p>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Quem vai</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPeople((list) => [...list, { key: `n${Date.now()}`, name: "", userId: null, status: "confirmado", note: null }])}
              >
                <Plus className="size-4" />
                Adicionar pessoa
              </Button>
            </div>
            <datalist id={listId}>
              {active.map((user) => (
                <option key={user.id} value={user.name} />
              ))}
            </datalist>
            {people.length === 0 && <p className="rounded-md border border-dashed border-[#c9d8dc] px-3 py-4 text-center text-sm text-muted-foreground">Ninguém na lista ainda.</p>}
            <ul className="space-y-2">
              {people.map((person) => (
                <li key={person.key} className="grid gap-2 rounded-md border border-[#e6eef0] p-2 sm:grid-cols-[minmax(0,1.4fr)_9.5rem_minmax(0,1fr)_auto]">
                  <Input aria-label="Nome" list={listId} value={person.name} onChange={(event) => rename(person.key, event.target.value)} placeholder="Nome (do escritório ou de fora)" />
                  <select aria-label="Presença" className={SELECT} value={person.status} onChange={(event) => patch(person.key, { status: event.target.value as ParticipantStatus })}>
                    <option value="confirmado">Confirmado</option>
                    <option value="a_confirmar">A confirmar</option>
                  </select>
                  <Input aria-label="Observação" value={person.note ?? ""} onChange={(event) => patch(person.key, { note: event.target.value || null })} placeholder="Observação" />
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={`Tirar ${person.name || "pessoa"} da lista`} className="self-center" onClick={() => setPeople((list) => list.filter((entry) => entry.key !== person.key))}>
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="degust-resultado">Resultado da degustação</Label>
            <Textarea id="degust-resultado" rows={3} value={result} onChange={(event) => setResult(event.target.value)} placeholder="O que o grupo gostou, o que trocar, próximos passos" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          {onDelete && (
            <Button variant="ghost" size="sm" className="mr-auto text-rose-700" disabled={busy} onClick={onDelete}>
              Excluir
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy || !valid}
            onClick={() =>
              onSave({
                menuType,
                vendorName: vendor.trim(),
                tastingDate: date || null,
                tastingTime: time || null,
                location: location.trim() || null,
                linkUrl: tastingLinkHref(link),
                status,
                resultNote: result.trim() || null,
                participants: people
                  .filter((person) => person.name.trim())
                  .map((person) => ({ name: person.name.trim(), userId: person.userId, status: person.status, note: person.note?.trim() || null })),
              })
            }
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
