"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Expand,
  ExternalLink,
  Flag,
  Gem,
  HeartHandshake,
  MessageSquareQuote,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PE27_NORTE } from "@/lib/pe27/conteudo";
import { THEME_LABELS, THEMES, type Direction, type Pe27Board, type Pe27Group, type Pe27Reflection, type Theme } from "@/lib/pe27/types";
import { PersonLine, plural } from "./shared";

const THEME_ICONS: Record<Theme, LucideIcon> = {
  visao: Telescope,
  missao: Flag,
  valores: Gem,
  proposito: HeartHandshake,
};

/** O texto que cada grupo recebeu impresso na folha da dinâmica. */
const THEME_STATEMENT: Record<Theme, { label: string; text: string }> = {
  visao: { label: "Nossa visão", text: PE27_NORTE.visao },
  missao: { label: "Missão sugerida", text: PE27_NORTE.missaoSugerida },
  valores: { label: "CIVIL", text: PE27_NORTE.civil.map((item) => item.value).join(" · ") },
  proposito: { label: "Nosso propósito", text: PE27_NORTE.proposito },
};

const DIRECTIONS: Array<{ id: Direction; label: string; icon: LucideIcon; tile: string; text: string }> = [
  { id: "aproximou", label: "Aproximou", icon: ArrowUpRight, tile: "bg-emerald-50 text-emerald-700", text: "text-emerald-800" },
  { id: "afastou", label: "Afastou", icon: ArrowDownRight, tile: "bg-rose-50 text-rose-700", text: "text-rose-800" },
];

/* ------------------------------------------------------------------ fotos */

function GroupPhotosDialog({ group, onClose }: { group: Pe27Group; onClose: () => void }) {
  const photos = [
    ...(group.poster_url ? [{ url: group.poster_url, label: "Cartaz" }] : []),
    ...group.sketch_urls.map((url, index) => ({
      url,
      label: group.sketch_urls.length > 1 ? `Rascunho ${index + 1}` : "Rascunho",
    })),
  ];
  const [current, setCurrent] = useState(0);
  const photo = photos[current];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Fotos · {group.name}</DialogTitle>
          <DialogDescription>Cartaz final e folhas de rascunho do workshop de 05/11. A matriz foi transcrita delas.</DialogDescription>
        </DialogHeader>
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto border-b px-6 py-3" role="tablist" aria-label="Fotos do grupo">
            {photos.map((item, index) => (
              <button
                key={item.url}
                type="button"
                role="tab"
                aria-selected={index === current}
                onClick={() => setCurrent(index)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30",
                  index === current ? "bg-[#04202f] text-white" : "bg-[#eaf2f5] text-[#285f7a] hover:bg-[#dcebf0]",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex min-h-[50dvh] flex-1 items-center justify-center overflow-auto bg-[#f4f7f8] p-4">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.url}
              src={photo.url}
              alt={`${photo.label} do ${group.name}`}
              className="mx-auto max-h-[62dvh] w-auto rounded-md object-contain shadow-sm"
            />
          )}
        </div>
        <DialogFooter className="border-t px-6 py-3">
          {photo && (
            <Button asChild variant="outline">
              <a href={photo.url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                Abrir em tamanho original
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ itens */

function ReflectionItem({ item }: { item: Pe27Reflection }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-current opacity-40" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-6 font-medium text-foreground">
          <span>{item.text}</span>
          {item.source === "rascunho" && (
            <span className="rounded-full bg-[#fdf3e3] px-2 py-px text-xs leading-5 font-medium text-[#8a6224]">só no rascunho</span>
          )}
          {item.transcription_note && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={`Nota da transcrição: ${item.transcription_note}`}
                  className="inline-flex size-6 items-center justify-center rounded-md text-[#9c7434] outline-none hover:bg-[#fdf3e3] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30"
                >
                  <MessageSquareQuote className="size-3.5" aria-hidden />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{item.transcription_note}</TooltipContent>
            </Tooltip>
          )}
        </p>
        {item.detail && <p className="text-xs leading-5 text-muted-foreground">No rascunho: {item.detail}</p>}
      </div>
    </li>
  );
}

/** Lista de uma célula; em Valores, separada pelas letras do CIVIL. */
function ReflectionList({ items, tone }: { items: Pe27Reflection[]; tone: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nada anotado.</p>;
  const facets = [...new Set(items.map((item) => item.facet))];
  if (facets.length === 1 && facets[0] === null) {
    return (
      <ul className={cn("space-y-2", tone)}>
        {items.map((item) => (
          <ReflectionItem key={item.id} item={item} />
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-3">
      {facets.map((facet) => {
        const [letter, ...rest] = (facet ?? "").split(" · ");
        return (
          <div key={facet ?? "sem"} className="space-y-1.5">
            <p className="flex items-center gap-2 text-xs font-semibold text-[#285f7a]">
              <span className="font-brand flex size-6 items-center justify-center rounded-md bg-[#eaf2f5] text-sm leading-none">
                {letter}
              </span>
              {rest.join(" · ")}
            </p>
            <ul className={cn("space-y-2 pl-1", tone)}>
              {items
                .filter((item) => item.facet === facet)
                .map((item) => (
                  <ReflectionItem key={item.id} item={item} />
                ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ linha */

function ThemeRow({
  theme,
  group,
  items,
  onOpenPhotos,
}: {
  theme: Theme;
  group: Pe27Group | undefined;
  items: Pe27Reflection[];
  onOpenPhotos: (group: Pe27Group) => void;
}) {
  const Icon = THEME_ICONS[theme];
  const statement = THEME_STATEMENT[theme];
  const photoCount = group ? (group.poster_url ? 1 : 0) + group.sketch_urls.length : 0;
  const members = group?.members ?? [];

  return (
    <section aria-labelledby={`pe27-d1-${theme}`} className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white">
      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Tema, quem estava no grupo e as fotos */}
        <div className="space-y-4 border-b border-[#e6eef0] bg-[#fbfdfd] px-4 py-4 sm:px-5 lg:border-r lg:border-b-0">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#e4f0f6] text-[#2c6a89]" aria-hidden>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={`pe27-d1-${theme}`} className="text-lg leading-6 font-semibold text-foreground">
                {THEME_LABELS[theme]}
              </h2>
              <p className="text-xs text-muted-foreground">
                {group ? `${group.name.split(" · ")[0]} · ${plural(members.length, "pessoa", "pessoas")}` : "Grupo sem registro"}
              </p>
            </div>
            {group && photoCount > 0 && (
              <button
                type="button"
                onClick={() => onOpenPhotos(group)}
                className="group relative block h-16 w-12 shrink-0 overflow-hidden rounded-md border border-[#dce9eb] bg-[#f4f7f8] outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40"
                aria-label={`Ver o cartaz e os rascunhos do ${group.name} (${plural(photoCount, "foto", "fotos")})`}
                title={`Ver ${plural(photoCount, "foto", "fotos")}`}
              >
                {group.poster_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={group.poster_url}
                    alt=""
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-[#04202f]/75 py-0.5 text-white">
                  <Expand className="size-3" aria-hidden />
                </span>
              </button>
            )}
          </div>

          {members.length > 0 && (
            <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1" aria-label={`Quem estava no ${group?.name ?? "grupo"}`}>
              {members.map((member) => (
                <li key={member.id} className="min-w-0">
                  <PersonLine person={member} detail={member.is_area_partner ? `${member.area} · Sócio de área` : member.area} />
                </li>
              ))}
            </ul>
          )}

          <details className="group/texto">
            <summary className="cursor-pointer list-none text-xs font-semibold text-[#285f7a] outline-none hover:text-[#1c4a60] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30 [&::-webkit-details-marker]:hidden">
              {statement.label}
              <span className="ml-1 font-normal text-muted-foreground group-open/texto:hidden">(mostrar)</span>
            </summary>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{statement.text}</p>
          </details>
        </div>

        {/* Aproximou × afastou */}
        {DIRECTIONS.map((direction, index) => {
          const cell = items.filter((item) => item.direction === direction.id);
          return (
            <div
              key={direction.id}
              className={cn("px-4 py-4 sm:px-5", index === 0 && "border-b border-[#eef3f4] lg:border-r lg:border-b-0")}
            >
              <p className={cn("mb-3 flex items-center gap-2 text-xs font-semibold lg:hidden", direction.text)}>
                <direction.icon className="size-3.5" aria-hidden />
                {direction.label} · {cell.length}
              </p>
              <ReflectionList items={cell} tone={direction.text} />
            </div>
          );
        })}
      </div>

      {group?.proposal && (
        <div className="border-t border-[#e6eef0] bg-[#fdfaf4] px-4 py-4 sm:px-5">
          <p className="text-xs font-semibold text-[#8a6224]">Proposta de {THEME_LABELS[theme].toLowerCase()} do grupo</p>
          <p className="mt-1 max-w-4xl text-sm leading-6 font-medium text-foreground">“{group.proposal}”</p>
          {group.notes && <p className="mt-2 max-w-4xl text-xs leading-5 text-muted-foreground">{group.notes}</p>}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ tela */

export function Pe27Dinamica1({ board }: { board: Pe27Board }) {
  const [photos, setPhotos] = useState<Pe27Group | null>(null);
  const groups = board.groups.filter((group) => group.dynamic === 1);
  const groupIds = new Set(groups.map((group) => group.id));
  const items = board.reflections.filter((item) => groupIds.has(item.group_id));
  const totals = Object.fromEntries(
    DIRECTIONS.map((direction) => [direction.id, items.filter((item) => item.direction === direction.id).length]),
  );

  return (
    <TooltipProvider>
      <div className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl space-y-1">
            <h2 className="text-xl font-semibold text-foreground">O que nos aproximou e nos afastou em 2026</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Dinâmica 1 do workshop de 05/11: cada grupo ficou com um tema. Os itens vêm do cartaz final; o detalhe e os marcados “só no
              rascunho” vêm das folhas de rascunho.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {plural(groups.length, "grupo", "grupos")} ·{" "}
            <span className="font-semibold text-emerald-800 tabular-nums">{totals.aproximou}</span> aproximaram ·{" "}
            <span className="font-semibold text-rose-800 tabular-nums">{totals.afastou}</span> afastaram
          </p>
        </div>

        {/* Cabeçalho das colunas (desktop) */}
        <div className="hidden grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)] px-px lg:grid" aria-hidden>
          <span />
          {DIRECTIONS.map((direction) => (
            <p key={direction.id} className="flex items-center gap-2 px-5 text-sm font-semibold text-foreground">
              <span className={cn("flex size-7 items-center justify-center rounded-md", direction.tile)}>
                <direction.icon className="size-4" />
              </span>
              {direction.label}
              <span className="font-normal text-muted-foreground tabular-nums">{totals[direction.id]}</span>
            </p>
          ))}
        </div>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#dce9eb] bg-white px-6 py-12 text-center text-sm text-muted-foreground">
            Os cartazes da Dinâmica 1 ainda não foram transcritos.
          </p>
        ) : (
          THEMES.map((theme) => {
            const group = groups.find((item) => item.theme === theme);
            return (
              <ThemeRow
                key={theme}
                theme={theme}
                group={group}
                items={group ? items.filter((item) => item.group_id === group.id) : []}
                onOpenPhotos={setPhotos}
              />
            );
          })
        )}

        <p className="text-xs text-muted-foreground">
          Grupos conforme a folha da Dinâmica 1 (diferentes dos da Dinâmica 2).{" "}
          <a
            href={board.files.dinamica1_groups_sheet_url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[#285f7a] underline-offset-4 hover:underline"
          >
            Ver a folha dos grupos
          </a>
        </p>

        {photos && <GroupPhotosDialog key={photos.id} group={photos} onClose={() => setPhotos(null)} />}
      </div>
    </TooltipProvider>
  );
}
