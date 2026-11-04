"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Loader2, MessageSquareText, Search, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { quickReplyCategoryLabel, type QuickReply } from "@/lib/whatsapp-quick-replies";
import { QuickReplyCategoryIcon } from "./quick-reply-category-icon";

/** Destaca os [colchetes] que o atendente ainda vai completar. */
export function withPlaceholders(text: string): ReactNode[] {
  return text.split(/(\[[^\]\n]{1,60}\])/g).map((part, index) =>
    /^\[[^\]\n]{1,60}\]$/.test(part) ? (
      <mark
        key={index}
        className="rounded bg-amber-100 px-0.5 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"
      >
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

interface QuickReplyPickerProps {
  listId: string;
  /** Já na ordem de exibição (agrupada sem busca, por relevância com busca). */
  items: QuickReply[];
  grouped: boolean;
  activeIndex: number;
  loaded: boolean;
  /** Com busca própria (aberto pelo botão); sem ela, a busca é o que vem depois da "/". */
  search?: {
    value: string;
    onChange: (value: string) => void;
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  };
  slashText?: string;
  canManage: boolean;
  preview: (reply: QuickReply) => string;
  onActiveIndexChange: (index: number) => void;
  onPick: (reply: QuickReply) => void;
  onClose: () => void;
  onManage: () => void;
}

export function QuickReplyPicker({
  listId,
  items,
  grouped,
  activeIndex,
  loaded,
  search,
  slashText,
  canManage,
  preview,
  onActiveIndexChange,
  onPick,
  onClose,
  onManage,
}: QuickReplyPickerProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const query = search ? search.value : slashText ?? "";

  return (
    <div
      className="absolute inset-x-0 bottom-full z-30 mb-2 flex max-h-[min(26rem,60dvh)] flex-col overflow-hidden rounded-xl border bg-white shadow-[0_18px_50px_-20px_rgba(3,32,47,0.45)] dark:bg-popover"
      onMouseDown={(event) => {
        // Mantém o foco no campo de mensagem (ou na busca) ao clicar na lista.
        if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
      }}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        {search ? (
          <>
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
              onKeyDown={search.onKeyDown}
              placeholder="Buscar resposta pronta…"
              aria-label="Buscar resposta pronta"
              className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
          </>
        ) : (
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
            <MessageSquareText className="size-4 shrink-0 text-[#347796]" />
            Respostas prontas
            {slashText ? (
              <span className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">/{slashText}</span>
            ) : null}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Fechar respostas prontas"
        >
          <X className="size-4" />
        </button>
      </div>

      <div ref={listRef} id={listId} role="listbox" aria-label="Respostas prontas" className="min-h-0 flex-1 overflow-y-auto py-1">
        {!loaded ? (
          <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando respostas…
          </p>
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            {query ? <>Nenhuma resposta com “{query}”.</> : <>Ainda não há respostas prontas.</>}
            {canManage ? (
              <div className="mt-2">
                <Button type="button" variant="outline" size="xs" onClick={onManage}>
                  Criar resposta
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          items.map((reply, index) => {
            const showHeader = grouped && (index === 0 || items[index - 1].category !== reply.category);
            const active = index === activeIndex;
            return (
              <div key={reply.id}>
                {showHeader ? (
                  <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {quickReplyCategoryLabel(reply.category)}
                  </p>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-index={index}
                  onMouseEnter={() => onActiveIndexChange(index)}
                  onClick={() => onPick(reply)}
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-2 text-left transition-colors",
                    active ? "bg-[#347796]/[0.08] dark:bg-[#47cdd0]/10" : "hover:bg-muted/60"
                  )}
                >
                  <QuickReplyCategoryIcon category={reply.category} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{reply.title}</span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">/{reply.shortcut}</span>
                      {!grouped ? (
                        <span className="ml-auto hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
                          {quickReplyCategoryLabel(reply.category)}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                      {withPlaceholders(preview(reply))}
                    </span>
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-3 py-1.5">
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          ↑↓ escolher · Enter inserir · Esc fechar
        </span>
        {canManage ? (
          <Button type="button" variant="ghost" size="xs" className="ml-auto text-muted-foreground" onClick={onManage}>
            <Settings2 />
            Gerenciar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
