"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CakeSlice,
  Check,
  CheckCheck,
  Clock3,
  Coffee,
  ExternalLink,
  GlassWater,
  Loader2,
  MapPin,
  Martini,
  Pencil,
  Plus,
  Salad,
  Soup,
  Star,
  Utensils,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonFace } from "@/components/pesquisas/shared";
import { MenuItemDialog, TastingDialog } from "@/components/eventos/evento-cardapio-dialogs";
import {
  daysUntil,
  formatClock,
  groupMenu,
  participantCounts,
  splitTastings,
  tastingLinkHref,
  type EventMenuItem,
  type EventTasting,
  type MenuType,
  type TastingParticipant,
} from "@/lib/eventos-programa";
import { deleteEventMenuItem, deleteEventTasting, fetchEventMenu, saveEventMenuItem, saveEventTasting } from "@/lib/eventos-programa-db";
import { resolveEmployeeAvatarUrl } from "@/lib/ferias/filters";
import type { User } from "@/lib/users";
import { cn } from "@/lib/utils";

const CARD = "rounded-lg border border-[#dce9eb] bg-card shadow-[0_1px_2px_rgba(3,32,47,0.05)]";
const PILL = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : name.trim();
}

function dateParts(iso: string | null): { day: string; month: string; weekday: string } | null {
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...options }).format(date);
  return { day: format({ day: "2-digit" }), month: format({ month: "short" }).replace(".", ""), weekday: format({ weekday: "long" }) };
}

function countdown(days: number | null): string | null {
  if (days == null) return null;
  if (days === 0) return "é hoje";
  if (days === 1) return "é amanhã";
  if (days > 1) return `em ${days} dias`;
  return days === -1 ? "foi ontem" : `há ${-days} dias`;
}

/** Ícone do momento do cardápio, pelo nome da seção. */
function sectionIcon(section: string, menuType: MenuType) {
  const name = section.toLowerCase();
  if (menuType === "bebida") return /sem [aá]lcool|[aá]gua|suco|refri/.test(name) ? GlassWater : Martini;
  if (/caf[eé]/.test(name)) return Coffee;
  if (/sobremesa|doce/.test(name)) return CakeSlice;
  if (/jantar|almo[cç]o|principal/.test(name)) return UtensilsCrossed;
  if (/petit|menu|sopa|caldo/.test(name)) return Soup;
  if (/esta[cç][aã]o|entrada|salada/.test(name)) return Salad;
  return Utensils;
}

function linkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.includes("instagram.com") ? "Instagram" : host;
  } catch {
    return "Abrir link";
  }
}

export function EventoCardapioTab({
  eventId,
  users,
  onHistory,
}: {
  eventId: string;
  users: User[];
  onHistory: (label: string, payload: Record<string, unknown>) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<EventMenuItem[]>([]);
  const [tastings, setTastings] = useState<EventTasting[]>([]);
  const [itemForm, setItemForm] = useState<{ item: EventMenuItem | null; menuType: MenuType; section?: string } | null>(null);
  const [tastingForm, setTastingForm] = useState<{ tasting: EventTasting | null; menuType: MenuType } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchEventMenu(eventId).then((data) => {
      if (cancelled) return;
      setItems(data.items);
      setTastings(data.tastings);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const now = useMemo(() => today(), []);
  const faceOf = (person: TastingParticipant) => {
    const user = users.find((entry) => entry.id === person.userId);
    return { short_name: person.name, avatar_url: user ? resolveEmployeeAvatarUrl(user.avatar_url, user.photo_onedrive_url ?? null) : null };
  };

  const confirmPerson = async (tasting: EventTasting, index: number) => {
    setBusy(true);
    const participants = tasting.participants.map((person, position) => (position === index ? { ...person, status: "confirmado" as const, note: null } : person));
    const saved = await saveEventTasting(eventId, { ...tasting, participants }, tasting.id);
    setBusy(false);
    if (!saved) return;
    setTastings((list) => list.map((entry) => (entry.id === saved.id ? saved : entry)));
    onHistory(`Degustação ${tasting.vendorName}: presença confirmada — ${tasting.participants[index]?.name ?? ""}`, { tastingId: tasting.id });
  };

  if (loading) {
    return (
      <div className={cn(CARD, "flex items-center justify-center gap-2 px-6 py-16 text-sm text-muted-foreground")}>
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Carregando o cardápio…
      </div>
    );
  }

  const renderBlock = (menuType: MenuType) => {
    const food = menuType === "comida";
    const sections = groupMenu(items, menuType);
    const own = items.filter((item) => item.menuType === menuType);
    const approved = own.filter((item) => item.status === "aprovado").length;
    const vendors = [...new Set(own.map((item) => item.vendorName).filter((name): name is string => Boolean(name)))];
    const { upcoming, done } = splitTastings(tastings, menuType);
    const BlockIcon = food ? Utensils : Martini;
    const state =
      own.length > 0 && approved === own.length
        ? { label: "Aprovado", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" }
        : upcoming.length > 0
          ? { label: "Em degustação", className: "bg-amber-50 text-amber-800 ring-amber-200" }
          : own.length > 0
            ? { label: "Em análise", className: "bg-amber-50 text-amber-800 ring-amber-200" }
            : { label: "A definir", className: "bg-slate-100 text-slate-700 ring-slate-200" };

    return (
      <section aria-label={food ? "Comidas" : "Bebidas"} className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#eaf5f7] text-[#285f73]" aria-hidden>
            <BlockIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-foreground">
              {food ? "Comidas" : "Bebidas"}
              <span className={cn(PILL, state.className)}>{state.label}</span>
            </h3>
            <p className="text-xs leading-5 text-muted-foreground">
              {own.length > 0
                ? `${own.length} ${own.length === 1 ? "item" : "itens"} em ${sections.length} ${sections.length === 1 ? (food ? "momento" : "grupo") : food ? "momentos" : "grupos"}${vendors.length > 0 ? ` · ${vendors.join(", ")}` : ""}`
                : food
                  ? "Nenhum prato lançado ainda."
                  : "Nenhuma bebida aprovada ainda."}
              {upcoming.length > 0 ? ` · ${upcoming.length} ${upcoming.length === 1 ? "degustação marcada" : "degustações marcadas"}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setTastingForm({ tasting: null, menuType })}>
              <Plus className="size-4" />
              Degustação
            </Button>
            <Button size="sm" onClick={() => setItemForm({ item: null, menuType })}>
              <Plus className="size-4" />
              {food ? "Prato" : "Bebida"}
            </Button>
          </div>
        </div>

        {upcoming.length > 0 && (
          <ul className="grid gap-3 xl:grid-cols-2">
            {upcoming.map((tasting) => {
              const parts = dateParts(tasting.tastingDate);
              const href = tastingLinkHref(tasting.linkUrl);
              const counts = participantCounts(tasting.participants);
              const when = countdown(daysUntil(tasting.tastingDate, now));
              return (
                <li key={tasting.id} className={cn(CARD, "flex flex-col p-4")}>
                  <div className="flex items-start gap-3">
                    <div className="grid w-16 shrink-0 place-items-center rounded-md bg-[#f3fafb] px-2 py-2 text-center ring-1 ring-inset ring-[#dce9eb]">
                      <span className="text-2xl font-semibold leading-none tracking-tight text-[#285f7a]">{parts?.day ?? "—"}</span>
                      <span className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{parts?.month ?? "a definir"}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold leading-5 text-foreground">{tasting.vendorName}</h4>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {parts && <span className="first-letter:uppercase">{parts.weekday}</span>}
                        {tasting.tastingTime && (
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="size-3.5" aria-hidden />
                            {formatClock(tasting.tastingTime)}
                          </span>
                        )}
                        {when && <span className="font-medium text-[#285f7a]">{when}</span>}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {tasting.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" aria-hidden />
                            {tasting.location}
                          </span>
                        )}
                        {href && (
                          <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-[#285f7a] hover:underline">
                            {linkLabel(href)}
                            <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        )}
                      </p>
                    </div>
                    <Button size="icon-sm" variant="ghost" aria-label={`Editar degustação ${tasting.vendorName}`} onClick={() => setTastingForm({ tasting, menuType })}>
                      <Pencil className="size-4" />
                    </Button>
                  </div>

                  <div className="mt-4 border-t border-[#eef3f4] pt-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Quem vai · {counts.confirmed} {counts.confirmed === 1 ? "confirmado" : "confirmados"}
                      {counts.pending > 0 ? ` · ${counts.pending} a confirmar` : ""}
                    </p>
                    <ul className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                      {tasting.participants.map((person, index) => {
                        const pending = person.status === "a_confirmar";
                        return (
                          <li key={`${person.name}-${index}`} className="flex items-center gap-2.5">
                            <span className={cn(pending && "opacity-60")}>
                              <PersonFace size="sm" person={faceOf(person)} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium leading-5 text-foreground">{shortName(person.name)}</p>
                              {(pending || person.note) && <p className="truncate text-xs leading-4 text-amber-700">{person.note ?? "A confirmar"}</p>}
                            </div>
                            {pending && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy} onClick={() => void confirmPerson(tasting, index)}>
                                <Check className="size-3.5" />
                                Confirmar
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {sections.length > 0 ? (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sections.map((section) => {
              const Icon = sectionIcon(section.section, menuType);
              return (
                <li key={section.section} className={cn(CARD, "flex flex-col p-4")}>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#eaf5f7] text-[#285f73]" aria-hidden>
                      <Icon className="size-4" />
                    </span>
                    <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{section.section}</h4>
                    <span className="text-xs tabular-nums text-muted-foreground">{section.items.length}</span>
                    <Button size="icon-sm" variant="ghost" aria-label={`Adicionar item em ${section.section}`} onClick={() => setItemForm({ item: null, menuType, section: section.section })}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setItemForm({ item, menuType })}
                          className={cn(
                            "group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm leading-5 outline-none transition-colors hover:bg-[#f3fafb] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40",
                            item.highlight && "bg-[#f3fafb] ring-1 ring-inset ring-[#dce9eb]"
                          )}
                        >
                          {item.highlight ? (
                            <Star className="mt-0.5 size-4 shrink-0 fill-amber-400 text-amber-500" aria-hidden />
                          ) : (
                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#9fc3cf]" aria-hidden />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className={cn("text-foreground", item.highlight && "font-medium")}>{item.name}</span>
                            {(item.note || item.status === "em_analise") && (
                              <span className="block text-xs text-muted-foreground">{[item.note, item.status === "em_analise" ? "em análise" : null].filter(Boolean).join(" · ")}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : (
          !food && (
            <div className="rounded-lg border border-dashed border-[#c9d8dc] bg-[#fafcfc] px-5 py-6 text-center">
              <p className="text-sm font-medium text-foreground">Os drinks entram aqui depois das degustações</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Quando o grupo escolher, lance cada drink com &quot;Bebida&quot; e ele aparece como aprovado.</p>
            </div>
          )
        )}

        {done.length > 0 && (
          <div className={cn(CARD, "overflow-hidden")}>
            <p className="flex items-center gap-2 border-b border-[#e6eef0] px-4 py-2.5 text-sm font-semibold text-foreground">
              <CheckCheck className="size-4 text-[#3e84a8]" aria-hidden />
              Degustações já feitas
            </p>
            <ul className="divide-y divide-[#eef3f4]">
              {done.map((tasting) => {
                const parts = dateParts(tasting.tastingDate);
                return (
                  <li key={tasting.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
                    <div className="min-w-40 flex-1">
                      <p className="text-sm font-medium text-foreground">{tasting.vendorName}</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {parts ? `${parts.day}/${tasting.tastingDate?.slice(5, 7)}` : "Sem data"}
                        {tasting.tastingTime ? ` às ${formatClock(tasting.tastingTime)}` : ""}
                        {tasting.resultNote ? ` · ${tasting.resultNote}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center" title={tasting.participants.map((person) => shortName(person.name)).join(", ")}>
                      {tasting.participants.map((person, index) => (
                        <span key={`${person.name}-${index}`} className="-ml-2 rounded-full ring-2 ring-white first:ml-0">
                          <PersonFace size="sm" person={faceOf(person)} />
                        </span>
                      ))}
                    </div>
                    <Button size="icon-sm" variant="ghost" aria-label={`Editar degustação ${tasting.vendorName}`} onClick={() => setTastingForm({ tasting, menuType })}>
                      <Pencil className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Comidas e bebidas</h2>
        <p className="mt-1 text-xs text-muted-foreground">O cardápio aprovado, o que ainda vamos degustar e quem vai em cada degustação.</p>
      </div>

      {renderBlock("comida")}
      {renderBlock("bebida")}

      {itemForm && (
        <MenuItemDialog
          item={itemForm.item}
          menuType={itemForm.menuType}
          defaultSection={itemForm.section}
          sections={groupMenu(items, itemForm.menuType).map((section) => section.section)}
          busy={busy}
          onClose={() => setItemForm(null)}
          onSave={async (input) => {
            setBusy(true);
            const nextOrder = items.reduce((max, entry) => Math.max(max, entry.sortOrder), 0) + 1;
            const saved = await saveEventMenuItem(eventId, itemForm.item ? input : { ...input, sortOrder: nextOrder }, itemForm.item?.id);
            setBusy(false);
            if (!saved) return;
            setItems((list) => (itemForm.item ? list.map((entry) => (entry.id === saved.id ? saved : entry)) : [...list, saved]));
            onHistory(`Cardápio: ${itemForm.item ? "item atualizado" : "item incluído"} — ${saved.name}`, { menuItemId: saved.id, section: saved.section });
            setItemForm(null);
          }}
          onDelete={
            itemForm.item
              ? async () => {
                  const target = itemForm.item;
                  if (!target) return;
                  setBusy(true);
                  const ok = await deleteEventMenuItem(target.id);
                  setBusy(false);
                  if (!ok) return;
                  setItems((list) => list.filter((entry) => entry.id !== target.id));
                  onHistory(`Cardápio: item removido — ${target.name}`, { section: target.section });
                  setItemForm(null);
                }
              : undefined
          }
        />
      )}

      {tastingForm && (
        <TastingDialog
          tasting={tastingForm.tasting}
          menuType={tastingForm.menuType}
          users={users}
          busy={busy}
          onClose={() => setTastingForm(null)}
          onSave={async (input) => {
            setBusy(true);
            const saved = await saveEventTasting(eventId, input, tastingForm.tasting?.id);
            setBusy(false);
            if (!saved) return;
            setTastings((list) => (tastingForm.tasting ? list.map((entry) => (entry.id === saved.id ? saved : entry)) : [...list, saved]));
            onHistory(`Degustação ${tastingForm.tasting ? "atualizada" : "criada"}: ${saved.vendorName}`, { tastingId: saved.id, date: saved.tastingDate });
            setTastingForm(null);
          }}
          onDelete={
            tastingForm.tasting
              ? async () => {
                  const target = tastingForm.tasting;
                  if (!target) return;
                  setBusy(true);
                  const ok = await deleteEventTasting(target.id);
                  setBusy(false);
                  if (!ok) return;
                  setTastings((list) => list.filter((entry) => entry.id !== target.id));
                  onHistory(`Degustação removida: ${target.vendorName}`, { date: target.tastingDate });
                  setTastingForm(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
