"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ImageIcon,
  LayoutList,
  Loader2,
  Table2,
  TrendingDown,
  TrendingUp,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAreaIconStyle } from "@/lib/area-icons";
import { getInitials } from "@/lib/ferias/filters";
import {
  areaReportHtml,
  areaReportText,
  areasPivotHtml,
  areasPivotText,
  dayMonth,
} from "@/lib/rh/boas-praticas/area-report-text";
import {
  areaCountsInMonth,
  flowStatus,
  monthKey,
  pivotCountsByMonth,
  previousMonth,
  summarizeArea,
  summarizeAreasPivot,
  todayIso,
  type AreaPersonRow,
  type AreasPivot,
  type MonthRef,
} from "@/lib/rh/boas-praticas/metrics";
import {
  FEEDBACK_AREAS,
  MONTH_LABELS,
  MONTH_SHORT,
  categoryLabel,
  chapterLabel,
  type GoodPracticeFeedback,
} from "@/lib/rh/boas-praticas/types";
import { cn } from "@/lib/utils";
import { BandBadge, FlowStatusBadge, formatDate } from "./feedback-badges";
import { AreaGlyph, CategoryGlyph, CategoryIcon, usePeopleIndex } from "./feedback-visuals";

/* ------------------------------------------------------- fotos embutidas */

// A imagem exportada só leva foto que o navegador consegue ler (Supabase e
// organograma). Foto de outro site sem permissão (SharePoint) vira iniciais
// também na tela, para a folha e a imagem saírem iguais.
const embedded = new Map<string, Promise<string | null>>();
const AVATAR_PIXELS = 96;

/**
 * Recorta o centro da foto num quadrado de 96 px (JPEG). As fotos de perfil
 * chegam a 4000 px: inteiras, deixavam a imagem exportada com mais de 15 MB.
 */
async function shrinkAvatar(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_PIXELS;
  canvas.height = AVATAR_PIXELS;
  canvas
    .getContext("2d")
    ?.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_PIXELS, AVATAR_PIXELS);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

function embedImage(url: string): Promise<string | null> {
  let pending = embedded.get(url);
  if (!pending) {
    pending = fetch(url, { mode: "cors", credentials: "omit" })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => (blob?.type.startsWith("image/") ? shrinkAvatar(blob) : null))
      .catch(() => null);
    embedded.set(url, pending);
  }
  return pending;
}

function useEmbeddedImage(url: string | null): string | null {
  const [state, setState] = useState<{ url: string; data: string | null } | null>(null);
  useEffect(() => {
    if (!url) return;
    let active = true;
    embedImage(url).then((data) => {
      if (active) setState({ url, data });
    });
    return () => {
      active = false;
    };
  }, [url]);
  return url && state?.url === url ? state.data : null;
}

function ReportAvatar({
  name,
  avatarUrl,
  isTeam,
  size = "md",
}: {
  name: string;
  avatarUrl: string | null;
  isTeam: boolean;
  /** sm = linha do quadro compacto; md = folha detalhada. */
  size?: "sm" | "md";
}) {
  const photo = useEmbeddedImage(isTeam ? null : avatarUrl);
  const box = size === "sm" ? "size-6" : "size-9";
  if (isTeam) {
    return (
      <span className={cn("grid shrink-0 place-items-center rounded-full bg-[#e8f1f5] text-[#315f73]", box)} aria-hidden>
        <UsersRound className={size === "sm" ? "size-3.5" : "size-4"} />
      </span>
    );
  }
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" className={cn("shrink-0 rounded-full object-cover ring-1 ring-black/5", box)} />;
  }
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[#e8f1f5] font-semibold text-[#315f73]",
        box,
        size === "sm" ? "text-[10px]" : "text-xs"
      )}
      aria-hidden
    >
      {getInitials(name || "?")}
    </span>
  );
}

/* ------------------------------------------------------------ peças */

function Kpi({ label, value, children }: { label: string; value: string | number; children?: ReactNode }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[26px] font-semibold leading-8 tabular-nums text-[#10293a]">{value}</dd>
      {children && <dd className="mt-1 text-xs text-muted-foreground">{children}</dd>}
    </div>
  );
}

function Versus({ current, previous, label }: { current: number; previous: number; label: string }) {
  const diff = current - previous;
  if (diff === 0) return <>igual a {label}</>;
  const Icon = diff > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 font-medium", diff > 0 ? "text-amber-700" : "text-emerald-700")}>
      <Icon className="size-3.5" aria-hidden />
      {diff > 0 ? "+" : ""}
      {diff} vs {label} ({previous})
    </span>
  );
}

function SheetSection({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="border-b border-[#e6eef0] px-6 py-5 last:border-b-0">
      <h4 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-[#10293a]">
        {title}
        {meta && <span className="text-xs font-normal text-muted-foreground">{meta}</span>}
      </h4>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------- página */

type Busy = "copiar" | "baixar" | "tabela" | null;
type Status = { tone: "ok" | "error"; text: string } | null;
type NameOf = (row: { name: string; employeeId: string | null }) => string;

/* ------------------------------------------------- régua dos meses */

/** Os 12 meses do ano com a quantidade: clicar abre o mês (pedido do Felipe). */
function MonthStrip({ items, month, onChange }: { items: GoodPracticeFeedback[]; month: MonthRef; onChange: (month: MonthRef) => void }) {
  const counts = useMemo(() => pivotCountsByMonth(items, month.year), [items, month.year]);
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-3 py-2">
      <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Ano anterior" onClick={() => onChange({ year: month.year - 1, month: 12 })}>
        <ChevronLeft className="size-4" />
      </Button>
      <span className="shrink-0 px-1 text-sm font-semibold tabular-nums text-foreground">{month.year}</span>
      <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Próximo ano" onClick={() => onChange({ year: month.year + 1, month: 1 })}>
        <ChevronRight className="size-4" />
      </Button>
      <div className="ml-1 grid min-w-[540px] flex-1 grid-cols-12 gap-1" role="group" aria-label={`Meses de ${month.year}`}>
        {MONTH_SHORT.map((label, index) => {
          const selected = index + 1 === month.month;
          const sent = counts[index];
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected}
              aria-label={`${MONTH_LABELS[index]}: ${sent} ${sent === 1 ? "feedback" : "feedbacks"}`}
              onClick={() => onChange({ year: month.year, month: index + 1 })}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-md px-1 leading-tight transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                selected ? "bg-[#10293a] text-white" : "hover:bg-[#f2f8f9]"
              )}
            >
              <span className={cn("text-xs", selected ? "text-white/80" : "text-muted-foreground")}>{label}</span>
              <span className={cn("text-sm font-semibold tabular-nums", !selected && !sent && "text-muted-foreground/60")}>{sent || "–"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------- quadro simples (dinâmica) */

/** Áreas com as pessoas embaixo e só a quantidade, compacto para print. */
function AreasPivotSheet({
  pivot,
  nameOf,
  avatarOf,
  sheetRef,
}: {
  pivot: AreasPivot;
  nameOf: NameOf;
  avatarOf: (employeeId: string | null) => string | null;
  sheetRef: RefObject<HTMLDivElement | null>;
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const monthName = MONTH_LABELS[pivot.month.month - 1];
  const toggle = (area: string) =>
    setCollapsed((current) => (current.includes(area) ? current.filter((entry) => entry !== area) : [...current, area]));

  return (
    <div ref={sheetRef} className="mx-auto w-full max-w-[560px] overflow-hidden rounded-lg border border-[#dce9eb] bg-white text-[#10293a]">
      <header className="flex items-end justify-between gap-4 border-b border-[#e6eef0] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Feedbacks de boas práticas</h3>
          <p className="text-xs text-muted-foreground">
            {monthName} de {pivot.month.year} · por área e pessoa
          </p>
        </div>
        <p className="text-right">
          <span className="block text-2xl font-semibold leading-7 tabular-nums">{pivot.total}</span>
          <span className="text-xs text-muted-foreground">no mês</span>
        </p>
      </header>
      {pivot.total === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum feedback em {monthName.toLowerCase()} de {pivot.month.year}.
        </p>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-4 py-1.5 text-left font-medium">Área / pessoa</th>
              <th className="w-16 px-4 py-1.5 text-right font-medium">Qtd.</th>
            </tr>
          </thead>
          {pivot.rows.map((row) => {
            const open = !collapsed.includes(row.area);
            return (
              <tbody key={row.area} className="border-t border-[#e6eef0]">
                <tr className="bg-[#f6fafb]">
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => toggle(row.area)}
                      className="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left font-semibold hover:bg-[#eef6f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60"
                    >
                      <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-150", open && "rotate-90")} aria-hidden />
                      <span className={cn("grid size-5 shrink-0 place-items-center rounded ring-1 ring-inset", getAreaIconStyle(row.area))} aria-hidden>
                        <AreaGlyph area={row.area} className="size-3" />
                      </span>
                      {row.area}
                    </button>
                  </td>
                  <td className="px-4 py-1 text-right font-semibold tabular-nums">{row.sent}</td>
                </tr>
                {open &&
                  row.people.map((person) => {
                    const label = person.isTeam ? "Equipe toda" : nameOf(person);
                    return (
                      <tr key={person.key}>
                        <td className="py-1 pl-[34px] pr-4">
                          <span className="flex items-center gap-2">
                            <ReportAvatar
                              size="sm"
                              name={label}
                              avatarUrl={person.isTeam ? null : avatarOf(person.employeeId)}
                              isTeam={person.isTeam}
                            />
                            <span className={cn("min-w-0 truncate", person.isTeam && "text-muted-foreground")}>{label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-1 text-right tabular-nums">{person.sent}</td>
                      </tr>
                    );
                  })}
              </tbody>
            );
          })}
          <tfoot>
            <tr className="border-t-2 border-[#dce9eb]">
              <td className="px-4 py-1.5 font-semibold">Total</td>
              <td className="px-4 py-1.5 text-right font-semibold tabular-nums">{pivot.total}</td>
            </tr>
          </tfoot>
        </table>
      )}
      {pivot.empty.length > 0 && (
        <p className="border-t border-[#e6eef0] px-4 py-2 text-xs text-muted-foreground">Sem feedback no mês: {pivot.empty.join(", ")}.</p>
      )}
    </div>
  );
}

export function FeedbackAreaReport({
  items,
  month,
  area,
  onMonthChange,
  onAreaChange,
}: {
  items: GoodPracticeFeedback[];
  month: MonthRef;
  /** null = resumo de todas as áreas; com área, a folha detalhada dela. */
  area: string | null;
  onMonthChange: (month: MonthRef) => void;
  onAreaChange: (area: string | null) => void;
}) {
  const people = usePeopleIndex();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [includeItems, setIncludeItems] = useState(true);
  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<Status>(null);

  const pivot = useMemo(() => summarizeAreasPivot(items, month), [items, month]);
  const report = useMemo(() => summarizeArea(items, area ?? "", month), [items, area, month]);
  const areas = useMemo(() => areaCountsInMonth(items, month), [items, month]);
  const monthName = MONTH_LABELS[month.month - 1];
  const previousName = MONTH_LABELS[previousMonth(month).month - 1].toLowerCase();
  const individuals = report.people.filter((row) => !row.isTeam).length;
  const repeaters = report.people.filter((row) => !row.isTeam && row.yearToDate >= 3).length;

  const nameOf: NameOf = (row) => (row.employeeId && people.get(row.employeeId)?.short_name) || row.name;
  const personOf = (row: AreaPersonRow) => (row.employeeId ? (people.get(row.employeeId) ?? null) : null);

  /** Detalhe abre na área com mais feedbacks do mês. */
  function openDetail() {
    setStatus(null);
    const ranked = [...areas].sort((a, b) => b.sent - a.sent);
    onAreaChange(pivot.rows[0]?.area ?? ranked[0]?.area ?? FEEDBACK_AREAS[0]);
  }

  function changeMonth(next: MonthRef) {
    setStatus(null);
    onMonthChange(next);
  }

  async function renderSheet(): Promise<Blob> {
    const node = sheetRef.current;
    if (!node) throw new Error("A folha da área não está na tela.");
    const { renderArtboardPng } = await import("@/components/estudio/export-png");
    return renderArtboardPng(node, node.offsetWidth, node.offsetHeight, 2);
  }

  async function run(kind: Exclude<Busy, null>, action: () => Promise<string>) {
    setBusy(kind);
    setStatus(null);
    try {
      setStatus({ tone: "ok", text: await action() });
    } catch (cause) {
      setStatus({ tone: "error", text: cause instanceof Error ? cause.message : "Não foi possível concluir." });
    } finally {
      setBusy(null);
    }
  }

  const copyImage = () =>
    run("copiar", async () => {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        throw new Error("Este navegador não copia imagem. Use Baixar imagem.");
      }
      // A promessa vai direto no ClipboardItem: o navegador mantém a permissão do clique enquanto a imagem é gerada.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": renderSheet() })]);
      return "Imagem copiada. Cole (Ctrl+V) no Teams, no WhatsApp ou no e-mail.";
    });

  const downloadImage = () =>
    run("baixar", async () => {
      const blob = await renderSheet();
      const { downloadBlob } = await import("@/components/estudio/export-png");
      const slug = (area ?? "resumo das areas")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      downloadBlob(blob, `boas-praticas-${slug}-${monthKey(month)}.png`);
      return "Imagem baixada na pasta de downloads.";
    });

  const copyTable = () =>
    run("tabela", async () => {
      const text = area ? areaReportText(report, nameOf, includeItems) : areasPivotText(pivot, nameOf);
      const html = area ? areaReportHtml(report, nameOf, includeItems) : areasPivotHtml(pivot, nameOf);
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      return "Tabela copiada. No Teams, no Outlook e no Excel ela cola formatada; no WhatsApp, como texto.";
    });

  const actions: { kind: Exclude<Busy, null>; label: string; icon: LucideIcon; onClick: () => void; primary?: boolean }[] = [
    { kind: "copiar", label: "Copiar imagem", icon: ImageIcon, onClick: copyImage, primary: true },
    { kind: "baixar", label: "Baixar imagem", icon: Download, onClick: downloadImage },
    { kind: "tabela", label: "Copiar tabela", icon: Table2, onClick: copyTable },
  ];

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6eef0] px-4 py-2.5">
          <div role="radiogroup" aria-label="Visão" className="inline-flex rounded-md border border-input bg-white p-0.5">
            {[
              { key: "resumo", label: "Resumo das áreas", icon: LayoutList, active: area === null, onClick: () => { setStatus(null); onAreaChange(null); } },
              { key: "detalhe", label: "Detalhe de uma área", icon: Building2, active: area !== null, onClick: () => area === null && openDetail() },
            ].map(({ key, label, icon: Icon, active, onClick }) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={onClick}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-[5px] px-3 text-sm transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
                  active ? "bg-[#347796] font-medium text-white" : "text-muted-foreground hover:bg-[#47cdd0]/10 hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {area === null ? "Clique no mês. O quadro abaixo é o que vai na imagem e na tabela." : "Escolha a área: a folha abaixo é a que vai na imagem e na tabela."}
          </p>
        </div>
        <MonthStrip items={items} month={month} onChange={changeMonth} />
        {area !== null && (
        <div role="radiogroup" aria-label="Área" className="flex flex-wrap gap-1.5 border-t border-[#e6eef0] px-4 py-3">
          {areas.map((row) => {
            const selected = row.area === area;
            return (
              <button
                key={row.area}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setStatus(null);
                  onAreaChange(row.area);
                }}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-xs font-medium ring-1 ring-inset transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                  selected ? "bg-[#10293a] text-white ring-[#10293a]" : "bg-white text-foreground ring-[#dce9eb] hover:ring-[#3e84a8]/40",
                  !selected && row.sent === 0 && "text-muted-foreground"
                )}
              >
                <span className={cn("grid size-7 place-items-center rounded-full", selected ? "bg-white/15 text-white" : getAreaIconStyle(row.area))}>
                  <AreaGlyph area={row.area} className="size-3.5" />
                </span>
                {row.area}
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center tabular-nums",
                    selected ? "bg-white/20 text-white" : row.sent ? "bg-[#eef3f5] text-foreground" : "text-muted-foreground"
                  )}
                >
                  {row.sent || "–"}
                </span>
              </button>
            );
          })}
        </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {area !== null ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={includeItems}
              onChange={(event) => setIncludeItems(event.target.checked)}
              className="size-4 accent-[#347796]"
            />
            Incluir o texto de cada ocorrência
          </label>
        ) : (
          <span className="text-sm text-muted-foreground">Clique numa área do quadro para recolher ou abrir as pessoas.</span>
        )}
        <div className="flex flex-wrap gap-2">
          {actions.map(({ kind, label, icon: Icon, onClick, primary }) => (
            <Button key={kind} type="button" variant={primary ? "default" : "outline"} className="gap-2" disabled={busy !== null} onClick={onClick}>
              {busy === kind ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
              {label}
            </Button>
          ))}
        </div>
      </div>
      <p
        aria-live="polite"
        className={cn(
          "min-h-5 text-sm",
          status?.tone === "error" ? "text-red-700" : "text-emerald-800",
          !status && "sr-only"
        )}
      >
        {status && (
          <span className="inline-flex items-center gap-1.5">
            {status.tone === "ok" && <Check className="size-4" aria-hidden />}
            {status.text}
          </span>
        )}
      </p>

      {/* Folha: é o que vai na imagem. Sem botões nem filtros dentro. */}
      {area === null ? (
        <AreasPivotSheet
          pivot={pivot}
          nameOf={nameOf}
          avatarOf={(employeeId) => (employeeId ? (people.get(employeeId)?.avatar_url ?? null) : null)}
          sheetRef={sheetRef}
        />
      ) : (
      <div className="overflow-x-auto">
        <div ref={sheetRef} className="mx-auto w-full min-w-[640px] max-w-[880px] overflow-hidden rounded-lg border border-[#dce9eb] bg-white text-[#10293a]">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e6eef0] px-6 py-5">
            <div className="flex items-center gap-3.5">
              <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl ring-1 ring-inset", getAreaIconStyle(area))} aria-hidden>
                <AreaGlyph area={area} className="size-6" />
              </span>
              <div>
                <p className="text-xs font-medium text-[#3e84a8]">Feedbacks de boas práticas</p>
                <h3 className="text-xl font-semibold leading-7">{area}</h3>
                <p className="text-sm text-muted-foreground">
                  {monthName} de {month.year}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <BandBadge band={report.band} />
              <span className="text-xs text-muted-foreground">Pessoas e Cultura · ORQESTRAI</span>
            </div>
          </header>

          <dl className="grid grid-cols-4 divide-x divide-[#e6eef0] border-b border-[#e6eef0]">
            <Kpi label="Feedbacks no mês" value={report.total}>
              <Versus current={report.total} previous={report.previousTotal} label={previousName} />
            </Kpi>
            <Kpi label="Pessoas que receberam" value={individuals}>
              {report.people.some((row) => row.isTeam) ? "e a equipe inteira" : repeaters ? `${repeaters} com 3 ou mais no ano` : "na área"}
            </Kpi>
            <Kpi label={`No ano, até ${monthName.toLowerCase()}`} value={report.yearToDate}>
              feedbacks na área
            </Kpi>
            <Kpi label="Retorno do gestor" value={report.total ? `${report.responded} de ${report.total}` : "–"}>
              {report.total ? `${report.respondedFast} em até 2 dias úteis` : "sem feedback no mês"}
            </Kpi>
          </dl>

          {report.total === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Nenhum feedback de boas práticas em {area} em {monthName.toLowerCase()} de {month.year}.
            </p>
          ) : (
            <>
              <SheetSection title="Quem recebeu" meta="no mês, com o total do ano até este mês">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">Pessoa</th>
                      <th className="pb-2 pr-3 text-center font-medium">No mês</th>
                      <th className="pb-2 pr-3 font-medium">Temas</th>
                      <th className="pb-2 pr-3 font-medium">Datas</th>
                      <th className="pb-2 pr-3 text-center font-medium">No ano</th>
                      <th className="pb-2 font-medium">Retorno</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef3f5]">
                    {report.people.map((row) => {
                      const person = personOf(row);
                      return (
                        <tr key={row.key} className="align-top">
                          <td className="py-2.5 pr-3">
                            <span className="flex items-center gap-2.5">
                              <ReportAvatar name={nameOf(row)} avatarUrl={person?.avatar_url ?? null} isTeam={row.isTeam} />
                              <span className="min-w-0">
                                <span className="block font-medium">{nameOf(row)}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {row.isTeam ? "Equipe inteira" : (person?.position ?? "Fora do cadastro do RH")}
                                </span>
                              </span>
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-center text-lg font-semibold tabular-nums">{row.sent}</td>
                          <td className="py-2.5 pr-3">
                            <span className="flex flex-wrap gap-1">
                              {row.categories.map((entry) => (
                                <span
                                  key={entry.category}
                                  className="inline-flex items-center gap-1 rounded-full bg-[#eef6f8] px-2 py-0.5 text-xs text-[#285f7a]"
                                >
                                  <CategoryGlyph category={entry.category} className="size-3 shrink-0" />
                                  {entry.category}
                                  {entry.sent > 1 && <span className="font-semibold tabular-nums">×{entry.sent}</span>}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-xs tabular-nums text-muted-foreground">{row.dates.map(dayMonth).join(" · ")}</td>
                          <td className="py-2.5 pr-3 text-center">
                            {row.isTeam ? (
                              <span className="text-muted-foreground">–</span>
                            ) : (
                              <span
                                className={cn(
                                  "inline-flex min-w-7 justify-center rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums",
                                  row.yearToDate >= 3 ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200" : "text-foreground"
                                )}
                              >
                                {row.yearToDate}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{row.responded}</span> de {row.sent}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {repeaters > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">Em destaque: 3 ou mais feedbacks no ano, até {monthName.toLowerCase()}.</p>
                )}
              </SheetSection>

              <SheetSection title="Temas do mês" meta="capítulo do Manual de Boas Práticas">
                <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  {report.categories.map((row) => (
                    <li key={row.category} className="flex items-start gap-2.5">
                      <CategoryIcon category={row.category} className="size-7" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium leading-5">{row.category}</span>
                          <span className="text-sm font-semibold tabular-nums">{row.sent}</span>
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {[chapterLabel(row.category), ...row.subtopics.map((entry) => `${entry.name} ${entry.sent}`)].filter(Boolean).join(" · ") ||
                            "Fora da numeração do manual"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </SheetSection>

              {includeItems && (
                <SheetSection title="Ocorrências" meta={`${report.items.length} no mês, por data de envio`}>
                  <ol className="divide-y divide-[#eef3f5]">
                    {report.items.map((item) => (
                      <li key={item.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] gap-x-3 py-2.5">
                        <span className="pt-0.5 text-sm font-semibold tabular-nums text-[#285f7a]">{dayMonth(item.sent_on)}</span>
                        <span className="min-w-0">
                          <span className="block text-sm">
                            <span className="font-medium">{nameOf({ name: item.employee_name, employeeId: item.is_team ? null : item.employee_id })}</span>
                            <span className="text-muted-foreground"> · {categoryLabel(item)}</span>
                          </span>
                          <span className="mt-0.5 block text-sm leading-5 text-[#3a4f5c]">{item.description}</span>
                        </span>
                        <FlowStatusBadge status={flowStatus(item)} className="mt-0.5" />
                      </li>
                    ))}
                  </ol>
                </SheetSection>
              )}
            </>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-2 bg-[#f6fafb] px-6 py-3 text-xs text-muted-foreground">
            <span>Registro de Pessoas e Cultura, uso interno.</span>
            <span>Gerado em {formatDate(todayIso())}</span>
          </footer>
        </div>
      </div>
      )}
    </div>
  );
}
