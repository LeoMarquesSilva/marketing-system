"use client";

import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  Image as ImageIcon,
  Images,
  Instagram,
  Link2,
  Loader2,
  Megaphone,
  Palette,
  Presentation,
  Printer,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ArtCarousel, artSlideKind, type ArtSlide } from "@/components/planner/art-carousel";
import { COMPLETION_TYPES } from "@/lib/constants";
import type { MyDelivery } from "@/lib/request-files/deliveries-server";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, LucideIcon> = {
  "Post Redes Sociais": Images,
  "Reel Redes Sociais": Clapperboard,
  "Capa de Reels": ImageIcon,
  PPT: Presentation,
  Comunicado: Megaphone,
  Certificados: Award,
  "Material Impresso": Printer,
  "E-book": BookOpen,
};

function typeIcon(type: string | null): LucideIcon {
  return (type && TYPE_ICONS[type]) || Palette;
}

/** Ícone do tipo de pedido (createElement, como o AreaIcon: o componente não nasce na renderização). */
function TypeIcon({ type, className }: { type: string | null; className?: string }) {
  return createElement(typeIcon(type), { className, "aria-hidden": true });
}

function completionLabel(delivery: MyDelivery): string {
  if (delivery.completionType === "postagem_feita" && delivery.postedAt) {
    return `Publicado em ${format(new Date(delivery.postedAt), "dd/MM")}`;
  }
  return COMPLETION_TYPES.find((type) => type.value === delivery.completionType)?.label ?? "Concluído";
}

function slidesOf(delivery: MyDelivery): ArtSlide[] {
  return delivery.files.map((file) => ({ id: file.id, url: file.url, name: file.name, kind: artSlideKind(file.contentType) }));
}

export function MinhasEntregasClient() {
  const [deliveries, setDeliveries] = useState<MyDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("todos");
  const [selected, setSelected] = useState<MyDelivery | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/minhas-entregas", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível carregar as suas entregas.");
      setDeliveries(Array.isArray(data.deliveries) ? data.deliveries : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as suas entregas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fresh = useMemo(() => deliveries.filter((delivery) => delivery.unseenNoticeId), [deliveries]);

  // Abriu a tela: os avisos contam como vistos (o selo "Nova" continua até recarregar).
  useEffect(() => {
    if (fresh.length === 0) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/minhas-entregas", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: fresh.map((delivery) => delivery.unseenNoticeId) }),
      }).then(() => window.dispatchEvent(new Event("entregas:vistas")));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [fresh]);

  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const delivery of deliveries) {
      const key = delivery.requestType ?? "Outros";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [deliveries]);

  const others = useMemo(
    () =>
      deliveries.filter(
        (delivery) => !delivery.unseenNoticeId && (type === "todos" || (delivery.requestType ?? "Outros") === type),
      ),
    [deliveries, type],
  );

  if (loading) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 py-24 text-slate-500">
        <Loader2 className="size-7 animate-spin" aria-hidden />
        <p className="text-sm">Carregando as suas entregas…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <p className="text-sm text-slate-600">
        O que o Marketing concluiu a partir dos seus pedidos, com a arte para ver aqui mesmo. Não precisa aprovar nada.
      </p>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}

      {deliveries.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[#cfe0e4] bg-white px-4 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#eaf2f5]">
            <Palette className="size-6 text-[#347796]" aria-hidden />
          </span>
          <p className="text-sm font-medium text-slate-900">Nada entregue ainda.</p>
          <p className="max-w-sm text-sm text-slate-500">Quando o Marketing concluir algo que você pediu, aparece aqui com a arte e você recebe um aviso.</p>
        </div>
      ) : null}

      {fresh.length > 0 ? (
        <section className="space-y-3" aria-label="Novas entregas">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="size-4 text-[#347796]" aria-hidden />
            Novas
            <span className="rounded-full bg-[#347796] px-2 py-0.5 text-xs font-semibold text-white">{fresh.length}</span>
          </h2>
          {fresh.map((delivery) => (
            <DeliveryFeature key={delivery.id} delivery={delivery} />
          ))}
        </section>
      ) : null}

      {others.length > 0 || type !== "todos" ? (
        <section className="space-y-3" aria-label="Entregas anteriores">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{fresh.length ? "Anteriores" : "Suas entregas"}</h2>
            {types.length > 1 ? (
              <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Tipo">
                <TypeChip label="Todos" active={type === "todos"} onClick={() => setType("todos")} />
                {types.map(([name, count]) => (
                  <TypeChip key={name} label={name} count={count} iconType={name} active={type === name} onClick={() => setType(name)} />
                ))}
              </div>
            ) : null}
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((delivery) => (
              <li key={delivery.id}>
                <DeliveryTile delivery={delivery} onOpen={() => setSelected(delivery)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          {selected ? (
            <div className="overflow-y-auto p-5">
              <DialogTitle className="sr-only">{selected.title}</DialogTitle>
              <DialogDescription className="sr-only">Arte entregue pelo Marketing</DialogDescription>
              <DeliveryFeature delivery={selected} plain />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TypeChip({
  label,
  count,
  iconType,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  iconType?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        active ? "border-[#347796] bg-[#347796] text-white" : "border-[#dce9eb] bg-white text-slate-700 hover:bg-[#47cdd0]/10",
      )}
    >
      {iconType ? <TypeIcon type={iconType} className="size-3.5" /> : null}
      {label}
      {typeof count === "number" ? <span className={active ? "text-white/80" : "text-slate-400"}>{count}</span> : null}
    </button>
  );
}

/** A entrega como um post: arte em carrossel ao lado dos detalhes. */
function DeliveryFeature({ delivery, plain = false }: { delivery: MyDelivery; plain?: boolean }) {
  const slides = slidesOf(delivery);
  return (
    <article
      className={cn(
        "grid gap-5 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]",
        !plain && "rounded-lg border border-[#cfe4ea] bg-white p-4 shadow-[0_1px_2px_rgba(4,32,47,0.04)]",
      )}
    >
      {slides.length > 0 ? (
        <ArtCarousel slides={slides} label={`Arte: ${delivery.title}`} />
      ) : (
        <div className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#cfe0e4] bg-[#f7fbfc] px-6 text-center">
          <TypeIcon type={delivery.requestType} className="size-8 text-[#347796]" />
          <p className="text-sm text-slate-600">
            {delivery.artLink ? "A arte desta entrega está num link." : "Esta entrega não tem arquivo de arte no sistema."}
          </p>
          {delivery.artLink ? (
            <Button size="sm" variant="outline" asChild>
              <a href={delivery.artLink} target="_blank" rel="noopener noreferrer">
                <Link2 className="size-4" aria-hidden />
                Abrir a arte
              </a>
            </Button>
          ) : null}
        </div>
      )}
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf2f5] px-2.5 py-1 text-xs font-medium text-[#285f7a]">
            <TypeIcon type={delivery.requestType} className="size-3.5" />
            {delivery.requestType ?? "Pedido"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200/70">
            <CheckCircle2 className="size-3.5" aria-hidden />
            {completionLabel(delivery)}
          </span>
          {delivery.unseenNoticeId && !plain ? (
            <span className="rounded-full bg-[#347796] px-2 py-0.5 text-xs font-semibold text-white">Nova</span>
          ) : null}
        </div>
        <h3 className="text-lg leading-snug font-semibold text-slate-900">{delivery.title}</h3>
        {delivery.concludedAt ? (
          <p className="text-xs text-slate-500">
            Concluída {formatDistanceToNow(new Date(delivery.concludedAt), { addSuffix: true, locale: ptBR })} ·{" "}
            {format(new Date(delivery.concludedAt), "dd/MM/yyyy")}
            {delivery.area ? ` · ${delivery.area}` : ""}
          </p>
        ) : null}
        {delivery.caption ? (
          <div className="rounded-md bg-[#f7fbfc] px-3 py-2">
            <p className="mb-1 text-xs font-semibold text-slate-500">Legenda</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{delivery.caption}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {delivery.permalink ? (
            <Button size="sm" asChild>
              <a href={delivery.permalink} target="_blank" rel="noopener noreferrer">
                <Instagram className="size-4" aria-hidden />
                Ver no Instagram
              </a>
            </Button>
          ) : null}
          {slides.length > 0 && delivery.artLink ? (
            <Button size="sm" variant="outline" asChild>
              <a href={delivery.artLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                Link da arte
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Miniatura na galeria: a capa da arte, o tipo e a data. */
function DeliveryTile({ delivery, onOpen }: { delivery: MyDelivery; onOpen: () => void }) {
  const cover = delivery.files.find((file) => file.contentType?.startsWith("image/"));
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full overflow-hidden rounded-lg border border-[#dce9eb] bg-white text-left shadow-[0_1px_2px_rgba(4,32,47,0.04)] transition-shadow hover:shadow-md"
    >
      <span className="relative block aspect-[4/5] bg-slate-100">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <TypeIcon type={delivery.requestType} className="size-8 text-slate-300" />
          </span>
        )}
        {delivery.files.length > 1 ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
            <Images className="size-3.5" aria-hidden />
            {delivery.files.length}
          </span>
        ) : null}
      </span>
      <span className="block space-y-1 px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <TypeIcon type={delivery.requestType} className="size-3.5" />
          {delivery.requestType ?? "Pedido"}
          {delivery.concludedAt ? ` · ${format(new Date(delivery.concludedAt), "dd/MM")}` : ""}
        </span>
        <span className="line-clamp-2 block text-sm font-medium leading-snug text-slate-900">{delivery.title}</span>
      </span>
    </button>
  );
}
