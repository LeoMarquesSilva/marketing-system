"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, CircleDashed, Clock3, Lock, SlidersHorizontal, Square, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/ferias/filters";
import { cn } from "@/lib/utils";
import { DECISION_LABELS, type DecisionStatus, type DocPerson } from "@/lib/documentario/types";

export const CARD = "rounded-lg border border-[#dce9eb] bg-card shadow-[0_1px_2px_rgba(3,32,47,0.05)]";
/** Cores do filme (paleta da festa: azul profundo, dourado e branco). Dourado claro só em fundo escuro. */
export const FILM = { navy: "#0D1E2E", navySoft: "#16304a", gold: "#E1B16D", goldText: "#8a6528", paper: "#FCF9F5" } as const;
export const SELECT =
  "h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:border-[#47cdd0] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40";

/** Chamada à API do documentário: devolve o JSON ou lança a mensagem de erro. */
export async function docRequest<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/documentario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error ?? "Não foi possível concluir. Tente de novo.");
  return data as T;
}

/* ------------------------------------------------------------------ pessoas */

const SUPABASE_PUBLIC_OBJECT = /^(https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1)\/object\/public\/(.+)$/i;

/** Fotos institucionais têm ~4000 px: pede ao Supabase a versão reduzida. */
function facePhotoUrl(url: string | null, pixels: number, height = pixels): string | null {
  if (!url) return null;
  const match = url.match(SUPABASE_PUBLIC_OBJECT);
  if (!match) return url;
  const [path, query = ""] = match[2].split("?");
  const params = new URLSearchParams(query);
  params.set("width", String(pixels));
  params.set("height", String(height));
  params.set("resize", "cover");
  params.set("quality", "75");
  return `${match[1]}/render/image/public/${path}?${params.toString()}`;
}

const FACE_SIZES = {
  xs: { className: "size-6 text-[11px]", pixels: 64 },
  sm: { className: "size-8 text-xs", pixels: 96 },
  md: { className: "size-11 text-sm", pixels: 128 },
  lg: { className: "size-14 text-base", pixels: 160 },
  xl: { className: "size-20 text-lg", pixels: 220 },
  "2xl": { className: "size-24 text-xl", pixels: 260 },
} as const;

export function Face({
  name,
  avatarUrl,
  size = "sm",
  className,
}: {
  name: string;
  avatarUrl: string | null;
  size?: keyof typeof FACE_SIZES;
  className?: string;
}) {
  const src = facePhotoUrl(avatarUrl, FACE_SIZES[size].pixels);
  return (
    <Avatar className={cn("shrink-0 ring-1 ring-black/5", FACE_SIZES[size].className, className)}>
      {src && <AvatarImage src={src} alt="" className="object-cover" />}
      <AvatarFallback className="bg-[#e8f1f5] font-semibold text-[#315f73]">{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

/** Retrato 3:4 (cartela do filme e cartões dos sócios). */
export function Portrait({ name, avatarUrl, className }: { name: string; avatarUrl: string | null; className?: string }) {
  const src = facePhotoUrl(avatarUrl, 360, 480);
  return (
    <span className={cn("relative block aspect-[3/4] overflow-hidden rounded-md bg-[#e8f1f5]", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full object-cover object-top" />
      ) : (
        <span className="grid size-full place-items-center text-2xl font-semibold text-[#315f73]">{getInitials(name)}</span>
      )}
    </span>
  );
}

/** Título de bloco: nome forte, uma linha de apoio e ações à direita. */
export function BlockHeader({ id, title, hint, children, className }: { id?: string; title: string; hint?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-[17px] font-semibold leading-6 text-foreground">
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{hint}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function personOf(people: DocPerson[], key: string): DocPerson | undefined {
  return people.find((person) => person.key === key);
}

/* ------------------------------------------------------------------ decisões */

export const DECISION_STYLE: Record<DecisionStatus, string> = {
  pendente: "bg-slate-50 text-slate-600 ring-slate-200",
  aprovado: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  ajustar: "bg-amber-50 text-amber-800 ring-amber-200",
  recusado: "bg-rose-50 text-rose-700 ring-rose-200",
};

export const DECISION_ICON = {
  pendente: CircleDashed,
  aprovado: Check,
  ajustar: SlidersHorizontal,
  recusado: X,
} as const;

export function DecisionBadge({ status, label, className }: { status: DecisionStatus; label?: string; className?: string }) {
  const Icon = DECISION_ICON[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", DECISION_STYLE[status], className)}>
      <Icon className="size-3" aria-hidden />
      {label ?? DECISION_LABELS[status]}
    </span>
  );
}

export function SensitiveBadge({ className, label = "Sensível" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full bg-[#48466e]/10 px-2 py-0.5 text-xs font-medium text-[#48466e]", className)}>
      <Lock className="size-3" aria-hidden />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ tempo */

/** Relógio que atualiza a cada `ms` (cronômetro, contagem até a festa). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

export function formatDateTimeShort(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function formatDateBr(iso: string | null): string {
  if (!iso) return "";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/* ------------------------------------------------------------------ markdown */

function inline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|<https?:\/\/[^>\s]+>|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g);
  return parts.map((part, index) => {
    const key = `${keyBase}-${index}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={key} className="font-semibold text-foreground">{inline(part.slice(2, -2), key)}</strong>;
    if (/^\*[^*\s][^*]*\*$/.test(part)) return <em key={key}>{part.slice(1, -1)}</em>;
    const auto = part.match(/^<(https?:\/\/[^>\s]+)>$/);
    if (auto) {
      return (
        <a key={key} href={auto[1]} target="_blank" rel="noreferrer" className="break-all text-[#285f7a] underline underline-offset-2 hover:text-[#347796]">
          {auto[1].replace(/^https?:\/\/(www\.)?/, "")}
        </a>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noreferrer" className="text-[#285f7a] underline underline-offset-2 hover:text-[#347796]">
          {link[1]}
        </a>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

type Block =
  | { type: "h"; level: 3 | 4; text: string }
  | { type: "p"; lines: string[] }
  | { type: "quote"; lines: string[] }
  | { type: "ul"; items: string[]; checks: boolean }
  | { type: "ol"; items: string[] }
  | { type: "table"; rows: string[][] }
  | { type: "hr" };

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }
    const heading = trimmed.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "h", level: heading[1].length >= 4 ? 4 : 3, text: heading[2] });
      index += 1;
      continue;
    }
    if (/^-{3,}$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }
    if (trimmed.startsWith("|")) {
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        const cells = lines[index].trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-{2,}:?$/.test(cell))) rows.push(cells);
        index += 1;
      }
      blocks.push({ type: "table", rows });
      continue;
    }
    if (trimmed.startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quote.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", lines: quote });
      continue;
    }
    if (/^- /.test(trimmed)) {
      const items: string[] = [];
      let checks = false;
      while (index < lines.length && /^- /.test(lines[index].trim())) {
        const item = lines[index].trim().slice(2);
        if (/^\[[ xX]\]\s/.test(item)) checks = true;
        items.push(item.replace(/^\[[ xX]\]\s/, ""));
        index += 1;
      }
      blocks.push({ type: "ul", items, checks });
      continue;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s/, ""));
        index += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{2,4}\s|>|\||- |\d+\.\s|-{3,}$)/.test(lines[index].trim())) {
      paragraph.push(lines[index].replace(/\s+$/, ""));
      index += 1;
    }
    blocks.push({ type: "p", lines: paragraph });
  }
  return blocks;
}

/** Leitor do texto das seções (markdown simples: títulos, listas, tabelas, citações, links). */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseBlocks(source);
  if (!blocks.length) return null;
  return (
    <div className={cn("space-y-3 text-sm leading-6 text-foreground/85", className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.type) {
          case "h":
            return block.level === 3 ? (
              <h3 key={key} className="pt-2 text-[15px] font-semibold text-foreground">
                {inline(block.text, key)}
              </h3>
            ) : (
              <h4 key={key} className="pt-1 text-sm font-semibold text-foreground">
                {inline(block.text, key)}
              </h4>
            );
          case "hr":
            return <hr key={key} className="border-[#e6eef0]" />;
          case "p":
            return (
              <p key={key} className="max-w-[72ch]">
                {block.lines.map((line, lineIndex) => (
                  <Fragment key={lineIndex}>
                    {lineIndex > 0 && <br />}
                    {inline(line, `${key}-${lineIndex}`)}
                  </Fragment>
                ))}
              </p>
            );
          case "quote":
            return (
              <blockquote key={key} className="max-w-[72ch] rounded-md bg-[#f3f8fa] px-4 py-3 text-foreground/90">
                {block.lines.map((line, lineIndex) => (
                  <p key={lineIndex}>{inline(line, `${key}-${lineIndex}`)}</p>
                ))}
              </blockquote>
            );
          case "ul":
            return (
              <ul key={key} className={cn("max-w-[72ch] space-y-1.5", !block.checks && "list-disc pl-5 marker:text-[#3e84a8]")}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className={cn(block.checks && "flex items-start gap-2")}>
                    {block.checks && <Square className="mt-1 size-3.5 shrink-0 text-[#3e84a8]" aria-hidden />}
                    <span>{inline(item, `${key}-${itemIndex}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} className="max-w-[72ch] list-decimal space-y-1.5 pl-5 marker:font-medium marker:text-[#3e84a8]">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{inline(item, `${key}-${itemIndex}`)}</li>
                ))}
              </ol>
            );
          case "table": {
            const [head, ...body] = block.rows;
            return (
              <div key={key} className="overflow-x-auto rounded-md border border-[#e6eef0]">
                <table className="w-full min-w-[560px] border-collapse text-left text-[13px] leading-5">
                  {head && (
                    <thead className="bg-[#f6fafb] text-xs text-muted-foreground">
                      <tr>
                        {head.map((cell, cellIndex) => (
                          <th key={cellIndex} className="px-3 py-2 font-semibold">
                            {inline(cell, `${key}-h${cellIndex}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody className="divide-y divide-[#eef3f4]">
                    {body.map((row, rowIndex) => (
                      <tr key={rowIndex} className="align-top">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className={cn("px-3 py-2", cellIndex === 0 && "whitespace-nowrap")}>
                            {inline(cell, `${key}-${rowIndex}-${cellIndex}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ estados */

export function DocAcessoNegado() {
  return (
    <div className={cn(CARD, "mx-auto mt-10 flex max-w-md flex-col items-center gap-3 px-6 py-12 text-center")}>
      <Lock className="size-6 text-[#48466e]" aria-hidden />
      <p className="text-base font-semibold text-foreground">Projeto restrito</p>
      <p className="text-sm text-muted-foreground">
        O minidocumentário contém tópicos biográficos dos sócios. Peça acesso a quem coordena a produção.
      </p>
      <Link href="/" className="text-sm font-medium text-[#285f7a] underline underline-offset-2">
        Voltar ao início
      </Link>
    </div>
  );
}

export function EmptyState({ icon: Icon = Clock3, title, text, children }: { icon?: typeof Clock3; title: string; text: string; children?: ReactNode }) {
  return (
    <div className={cn(CARD, "flex flex-col items-center gap-2 px-6 py-12 text-center")}>
      <Icon className="size-6 text-[#3e84a8]" aria-hidden />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}

/** Aviso curto de sucesso ou erro no topo das telas. */
export function Feedback({ message, onClose }: { message: { type: "ok" | "erro"; text: string } | null; onClose: () => void }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
        message.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800",
      )}
    >
      <span>{message.text}</span>
      <button type="button" onClick={onClose} aria-label="Fechar aviso" className="rounded p-1 hover:bg-black/5">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
