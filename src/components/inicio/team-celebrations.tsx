"use client";

import { useState } from "react";
import { Cake, CalendarHeart, Heart, ImageIcon, MessageCircle, Trophy, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import { CelebrationDialog, celebrationCaption, celebrationWhen } from "@/components/inicio/celebration-dialog";
import { toggleLike } from "@/lib/inicio/celebrations-client";
import { shortDate } from "@/lib/inicio/dates";
import type { HomeCelebration, HomeData } from "@/lib/inicio/types";
import { cn } from "@/lib/utils";

/** Quantas linhas cabem em cada coluna antes do "Ver todos". */
const UPCOMING_ON_SCREEN = 5;
const WORK_ON_SCREEN = 4;

const SUBHEADING = "flex items-center gap-1.5 text-xs font-semibold uppercase text-[#48466e]";

const keyOf = (item: HomeCelebration) => `${item.id}:${item.kind}:${item.year}`;

/** Curtidas e comentários de uma comemoração, em números pequenos. */
function Counters({ item }: { item: HomeCelebration }) {
  if (item.likes === 0 && item.comments === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-[#5a717b]">
      {item.likes > 0 && (
        <span className="inline-flex items-center gap-1" aria-label={`${item.likes} ${item.likes === 1 ? "pessoa parabenizou" : "pessoas parabenizaram"}`}>
          <Heart className={cn("size-3.5", item.liked && "fill-[#347796] text-[#347796]")} aria-hidden />
          {item.likes}
        </span>
      )}
      {item.comments > 0 && (
        <span className="inline-flex items-center gap-1" aria-label={`${item.comments} ${item.comments === 1 ? "mensagem" : "mensagens"}`}>
          <MessageCircle className="size-3.5" aria-hidden />
          {item.comments}
        </span>
      )}
    </span>
  );
}

/** Uma pessoa da lista: abre a comemoração dela. */
function CelebrationRow({
  item,
  today,
  onOpen,
  showKind,
}: {
  item: HomeCelebration;
  today: string;
  onOpen: (item: HomeCelebration) => void;
  /** Mostra "Aniversário" / "3 anos de casa" na linha de baixo (listas que misturam os dois tipos). */
  showKind?: boolean;
}) {
  const detail =
    item.kind === "empresa" || showKind
      ? [celebrationCaption(item), item.department].filter(Boolean).join(" · ")
      : (item.department ?? item.position ?? "");
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-[#f4fafb] focus-visible:bg-[#f4fafb] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
      >
        <EmployeeAvatar name={item.name} avatarUrl={item.avatarUrl} className="h-10 w-10" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-[#0d2a38]">{item.name}</span>
            {item.artUrl && <ImageIcon className="size-3.5 shrink-0 text-[#7b929c]" aria-label="Tem arte" />}
          </span>
          <span className="block truncate text-xs text-[#5a717b]">{detail}</span>
        </span>
        <Counters item={item} />
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
            item.inDays === 0 ? "bg-[#347796] text-white" : "bg-[#eaf2f5] text-[#285f7a]"
          )}
        >
          {celebrationWhen(item, today)}
        </span>
      </button>
    </li>
  );
}

/** Quem comemora hoje: a arte em destaque e os botões de parabenizar e comentar. */
function TodayCard({
  item,
  onOpen,
  onChanged,
}: {
  item: HomeCelebration;
  onOpen: (item: HomeCelebration) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const like = async () => {
    setBusy(true);
    try {
      await toggleLike({ employeeId: item.id, kind: item.kind, year: item.year });
      onChanged();
    } catch {
      // A contagem volta ao que estava; o modal da comemoração mostra o erro se a pessoa tentar por lá.
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="block w-full bg-[#0D1E2E] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]"
        aria-label={`Abrir a comemoração de ${item.name}`}
      >
        {item.artUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.artUrl} alt={`Arte de ${celebrationCaption(item).toLowerCase()} de ${item.name}`} className="mx-auto max-h-72 w-auto max-w-full object-contain" />
        ) : (
          <span className="flex items-center gap-4 px-5 py-6 text-left text-white">
            <EmployeeAvatar
              name={item.name}
              avatarUrl={item.avatarUrl}
              className="h-16 w-16 ring-2 ring-[#E1B16D] ring-offset-2 ring-offset-[#0D1E2E]"
              fallbackClassName="bg-[#16324a] text-lg text-white"
            />
            <span className="text-lg font-light lowercase leading-snug">
              {item.kind === "aniversario" ? "feliz aniversário" : "parabéns pelo tempo de casa"}
              <span className="block font-semibold normal-case text-[#E1B16D]">{item.name}</span>
            </span>
          </span>
        )}
      </button>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#0d2a38]">{item.name}</p>
          <p className="truncate text-xs text-[#5a717b]">
            {celebrationCaption(item)} hoje{item.department ? ` · ${item.department}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={item.liked ? "default" : "outline"} size="sm" disabled={busy} aria-pressed={item.liked} onClick={like}>
            <Heart className={cn("size-4", item.liked && "fill-current")} aria-hidden />
            {item.liked ? "Parabenizou" : "Parabenizar"}
            {item.likes > 0 && <span className="tabular-nums">· {item.likes}</span>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpen(item)}>
            <MessageCircle className="size-4" aria-hidden />
            Comentar
            {item.comments > 0 && <span className="tabular-nums">· {item.comments}</span>}
          </Button>
        </div>
      </div>
    </article>
  );
}

/**
 * Aniversários da equipe em três colunas: quem comemora hoje e na última
 * semana (dá para parabenizar), os próximos e os aniversários de empresa.
 */
export function TeamCelebrations({
  data,
  allOpen,
  onAllOpenChange,
  onChanged,
}: {
  data: HomeData;
  allOpen: boolean;
  onAllOpenChange: (open: boolean) => void;
  /** Curtida ou comentário mudou: a tela inicial busca os números de novo. */
  onChanged: () => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const { birthdays, workAnniversaries, recentCelebrations, newcomers, today } = data;
  const todays = [...birthdays, ...workAnniversaries].filter((item) => item.inDays === 0);
  const upcomingBirthdays = birthdays.filter((item) => item.inDays > 0);
  const upcomingWork = workAnniversaries.filter((item) => item.inDays > 0);
  const everything = [...birthdays, ...workAnniversaries, ...recentCelebrations];
  // A comemoração aberta acompanha os números novos quando a tela atualiza.
  const open = openKey ? (everything.find((item) => keyOf(item) === openKey) ?? null) : null;
  const openItem = (item: HomeCelebration) => setOpenKey(keyOf(item));

  return (
    <>
      <div className="grid gap-x-8 gap-y-6 px-5 pb-5 pt-1 lg:grid-cols-3">
        <section className="min-w-0 space-y-3" aria-label="Hoje e nesta semana">
          <p className={SUBHEADING}>
            <CalendarHeart className="size-3.5" aria-hidden />
            Hoje
          </p>
          {todays.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#dce9eb] px-4 py-6 text-center text-sm text-muted-foreground">
              Ninguém comemora hoje.
            </p>
          ) : (
            todays.map((item) => <TodayCard key={keyOf(item)} item={item} onOpen={openItem} onChanged={onChanged} />)
          )}
          {recentCelebrations.length > 0 && (
            <div className="pt-1">
              <p className={SUBHEADING}>Nesta semana · ainda dá para parabenizar</p>
              <ul className="mt-1">
                {recentCelebrations.map((item) => (
                  <CelebrationRow key={keyOf(item)} item={item} today={today} onOpen={openItem} showKind />
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="min-w-0" aria-label="Próximos aniversários">
          <p className={SUBHEADING}>
            <Cake className="size-3.5" aria-hidden />
            Próximos aniversários
          </p>
          {upcomingBirthdays.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum aniversário nos próximos 30 dias.</p>
          ) : (
            <ul className="mt-1">
              {upcomingBirthdays.slice(0, UPCOMING_ON_SCREEN).map((item) => (
                <CelebrationRow key={keyOf(item)} item={item} today={today} onOpen={openItem} />
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 space-y-4" aria-label="Aniversário de empresa e quem chegou">
          <div>
            <p className={SUBHEADING}>
              <Trophy className="size-3.5" aria-hidden />
              Aniversário de empresa
            </p>
            {upcomingWork.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Ninguém completa ano de casa nos próximos 30 dias.</p>
            ) : (
              <ul className="mt-1">
                {upcomingWork.slice(0, WORK_ON_SCREEN).map((item) => (
                  <CelebrationRow key={keyOf(item)} item={item} today={today} onOpen={openItem} />
                ))}
              </ul>
            )}
          </div>
          {newcomers.length > 0 && (
            <div>
              <p className={SUBHEADING}>
                <UserPlus className="size-3.5" aria-hidden />
                Chegaram há pouco
              </p>
              <ul className="mt-1">
                {newcomers.map((person) => (
                  <li key={person.id} className="flex items-center gap-3 py-2">
                    <EmployeeAvatar name={person.name} avatarUrl={person.avatarUrl} className="h-10 w-10" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#0d2a38]">{person.name}</span>
                      <span className="block truncate text-xs text-[#5a717b]">{person.department ?? person.position ?? ""}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[#eaf2f5] px-2.5 py-1 text-xs font-semibold text-[#285f7a]">
                      desde {shortDate(person.since, today)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <Dialog open={allOpen} onOpenChange={onAllOpenChange}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-[#e6eff1] px-6 py-4">
            <DialogTitle>Aniversários dos próximos 30 dias</DialogTitle>
            <DialogDescription>Aniversário das pessoas e de tempo de casa. Clique em alguém para ver a comemoração.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-3">
            <ul>
              {birthdays.map((item) => (
                <CelebrationRow key={keyOf(item)} item={item} today={today} onOpen={openItem} />
              ))}
            </ul>
            {workAnniversaries.length > 0 && (
              <>
                <p className={cn(SUBHEADING, "mt-3 border-t border-[#e6eff1] pt-3")}>
                  <Trophy className="size-3.5" aria-hidden />
                  Aniversário de empresa
                </p>
                <ul className="mt-1">
                  {workAnniversaries.map((item) => (
                    <CelebrationRow key={keyOf(item)} item={item} today={today} onOpen={openItem} />
                  ))}
                </ul>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CelebrationDialog item={open} today={today} onClose={() => setOpenKey(null)} onChanged={onChanged} />
    </>
  );
}
