"use client";

import { createElement } from "react";
import { AlertTriangle, CircleAlert, Info } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { getInitials } from "@/lib/ferias/filters";
import { formatShortDate, termProgress, type FacilitiesAlert } from "@/lib/facilities/alerts";
import type { FacilitiesPerson, SupplierContract } from "@/lib/facilities/types";
import { maskCpfCnpj } from "@/lib/masks-br";
import { isEventSupplierCategory, supplierCategoryIcon, supplierCategoryLabel } from "@/lib/suppliers/categories";
import { cn } from "@/lib/utils";

export function formatBrl(value: number, options?: { compact?: boolean }): string {
  if (options?.compact && Math.abs(value) >= 10_000) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const KEEP_UPPER = new Set(["LTDA", "LTDA.", "S/A", "SA", "S.A.", "ME", "EPP", "EIRELI", "MEI", "SS", "BR", "TI", "BPO"]);
const LOWER_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "em"]);

/** Razão social vem em CAIXA ALTA da Receita/planilha; na tela fica em caixa normal. */
export function displayLegalName(name: string | null): string {
  if (!name) return "";
  const letters = name.replace(/[^\p{L}]/gu, "");
  if (!letters || letters !== letters.toUpperCase()) return name;
  return name
    .split(/\s+/)
    .map((original, index) => {
      // Sigla entre parênteses, como "(LMT)", fica como veio.
      if (/^\(.{1,5}\)$/.test(original) || KEEP_UPPER.has(original)) return original;
      const word = original.toLowerCase();
      if (index > 0 && LOWER_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/** Documento com o tipo na frente: "CNPJ 00.000.000/0000-00". */
export function documentLabel(document: string | null): string {
  if (!document) return "";
  return `${document.length === 14 ? "CNPJ" : "CPF"} ${maskCpfCnpj(document)}`;
}

/* ---------------------------------------------------------------- categoria */

/** Facilities em ciano da marca, eventos no índigo (DESIGN.md: categorias derivam do índigo). */
function categoryTone(category: string): string {
  return isEventSupplierCategory(category) && category !== "transporte" && category !== "seguranca"
    ? "bg-[#eeedf5] text-[#48466e] ring-[#48466e]/10"
    : "bg-[#e8f8f8] text-[#285f7a] ring-[#47cdd0]/25";
}

export function CategoryGlyph({ category, className }: { category: string; className?: string }) {
  return createElement(supplierCategoryIcon(category), { className, "aria-hidden": true });
}

export function CategoryTile({ category, size = "md", className }: { category: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md ring-1 ring-inset",
        size === "lg" ? "size-14" : size === "md" ? "size-10" : "size-8",
        categoryTone(category),
        className
      )}
      title={supplierCategoryLabel(category)}
      aria-hidden
    >
      <CategoryGlyph category={category} className={size === "lg" ? "size-6" : size === "md" ? "size-5" : "size-4"} />
    </span>
  );
}

/* ---------------------------------------------------------------- monograma */

function monogramLetters(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, " ")
    .split(/[\s/–-]+/)
    .filter((word) => /^[\p{L}\d]/u.test(word) && !/^(da|de|do|das|dos|e)$/i.test(word));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Âncora visual de cada fornecedor: iniciais no tom da categoria. */
export function SupplierMonogram({
  name,
  category,
  size = "md",
  className,
}: {
  name: string;
  category: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md font-semibold ring-1 ring-inset",
        size === "lg" ? "size-14 text-lg" : size === "md" ? "size-10 text-sm" : "size-8 text-xs",
        categoryTone(category),
        className
      )}
      aria-hidden
    >
      {monogramLetters(name)}
    </span>
  );
}

/* ----------------------------------------------------------- vigência */

/** Uma linha que diz em que pé o contrato está (vale para lista e cabeçalho). */
export function contractHeadline(contract: SupplierContract, today: string): string {
  const term = termProgress(contract, today);
  if (contract.status === "encerrado") return contract.end_date ? `Encerrado em ${formatShortDate(contract.end_date)}` : "Encerrado";
  if (contract.status === "em_negociacao") return "Em negociação";
  if (!term.end) return contract.start_date ? `Desde ${formatShortDate(contract.start_date)} · prazo indeterminado` : "Vigência não preenchida";
  if (term.daysLeft !== null && term.daysLeft < 0) return `Venceu em ${formatShortDate(term.end)}`;
  return `${contract.auto_renew ? "Renova em" : "Vence em"} ${formatShortDate(term.end)}`;
}

/**
 * Barra de vigência: quanto do período atual já correu, com a marca do prazo
 * de aviso. Tom de alerta quando o fim se aproxima (o texto ao lado diz o porquê).
 */
export function TermBar({
  contract,
  today,
  size = "sm",
  className,
}: {
  contract: SupplierContract;
  today: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const term = termProgress(contract, today);
  const closed = contract.status === "encerrado";
  const tone = closed
    ? "bg-slate-300"
    : term.daysLeft !== null && term.daysLeft < 0
      ? "bg-red-500"
      : term.daysLeft !== null && term.daysLeft <= 30 && !contract.auto_renew
        ? "bg-red-500"
        : term.daysLeft !== null && term.daysLeft <= 90
          ? "bg-amber-500"
          : "bg-[#3e84a8]";
  const elapsed = closed ? 1 : term.elapsed;
  const label =
    elapsed === null
      ? term.end
        ? `Até ${formatShortDate(term.end)}`
        : "Prazo indeterminado"
      : `${Math.round(elapsed * 100)}% do período`;

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn("relative w-full rounded-full", size === "lg" ? "h-2.5" : "h-1.5", elapsed === null ? "border border-dashed border-[#c9dde1]" : "bg-[#e3eef2]")}
        role="img"
        aria-label={`${contractHeadline(contract, today)}. ${label}.`}
      >
        {elapsed !== null && (
          <span className={cn("absolute inset-y-0 left-0 rounded-full", tone)} style={{ width: `${Math.max(elapsed * 100, 3)}%` }} />
        )}
        {term.notice !== null && !closed && (
          <span
            className={cn("absolute w-0.5 rounded-full bg-[#10293a]", size === "lg" ? "-inset-y-1" : "-inset-y-0.5")}
            style={{ left: `calc(${term.notice * 100}% - 1px)` }}
            title="Prazo de aviso prévio"
          />
        )}
      </div>
      {size === "lg" && (
        <div className="mt-1.5 flex justify-between text-xs tabular-nums text-muted-foreground">
          <span>{term.start ? formatShortDate(term.start) : "Início não informado"}</span>
          <span>{term.end ? formatShortDate(term.end) : "Sem data de fim"}</span>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- áreas */

export function AreaChip({ area, className }: { area: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        getAreaIconStyle(area),
        className
      )}
    >
      {createElement(getAreaIcon(area), { className: "size-3 shrink-0", "aria-hidden": true })}
      <span className="truncate">{area}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ pessoas */

const AVATAR_SIZE = { xs: "size-6 text-xs", sm: "size-8 text-xs", md: "size-10 text-sm" } as const;

export function PersonAvatar({
  person,
  size = "sm",
  className,
}: {
  person: FacilitiesPerson;
  size?: keyof typeof AVATAR_SIZE;
  className?: string;
}) {
  return (
    <Avatar className={cn("shrink-0 ring-1 ring-black/5", AVATAR_SIZE[size], className)} title={person.name}>
      {person.avatar_url && <AvatarImage src={person.avatar_url} alt="" />}
      <AvatarFallback className="bg-[#e8f1f5] font-semibold text-[#315f73]">{getInitials(person.name || "?")}</AvatarFallback>
    </Avatar>
  );
}

/** Nome curto para listas: "Leonardo Marques da Silva" → "Leonardo Marques". */
export function shortPersonName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 2 ? `${parts[0]} ${parts[1]}` : name.trim();
}

/* ------------------------------------------------------------------ alertas */

const ALERT_STYLE = {
  danger: { icon: CircleAlert, className: "bg-red-50 text-red-700 ring-red-200" },
  warning: { icon: AlertTriangle, className: "bg-amber-50 text-amber-800 ring-amber-200" },
  info: { icon: Info, className: "bg-[#f2f8f9] text-[#285f7a] ring-[#dce9eb]" },
} as const;

export function AlertPill({ alert, className }: { alert: FacilitiesAlert; className?: string }) {
  const style = ALERT_STYLE[alert.severity];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        style.className,
        className
      )}
    >
      <style.icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{alert.title}</span>
    </span>
  );
}

export function StatusDot({ tone, label }: { tone: "ok" | "muted" | "warning"; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === "ok" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : "bg-slate-300"
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}
