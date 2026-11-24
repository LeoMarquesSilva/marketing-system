"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlarmClock, CalendarCheck2, CalendarPlus, ChevronRight, ListTodo, MapPin, Sprout, UsersRound, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OneOnOneOverview, OneOnOnePairSummary } from "@/lib/rh/one-on-one/types";
import { cn } from "@/lib/utils";
import { AreaTile, BODY, INK, MUTED, PersonPhoto, ProgressBar, SURFACE, StatTile } from "../pdi/pdi-visuals";
import { CadenceBadge, DateBlock, formatDayLong, formatTime } from "./one-on-one-visuals";
import { ScheduleDialog, type PairOption } from "./schedule-dialog";

function PairCard({ pair, overdueDays, asMember }: { pair: OneOnOnePairSummary; overdueDays: number; asMember?: boolean }) {
  const person = asMember ? pair.leader : pair.member;
  return (
    <Link
      href={`/1-1/${pair.leader.id}/${pair.member.id}`}
      className={cn(
        SURFACE,
        "group flex flex-col gap-4 p-4 outline-none transition-shadow hover:shadow-[0_6px_18px_rgba(4,32,47,0.08)] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
      )}
    >
      <div className="flex items-start gap-3">
        <PersonPhoto person={person} size="md" className="size-12" />
        <div className="min-w-0 flex-1">
          {asMember && <p className={cn("text-xs", MUTED)}>Meu gestor</p>}
          <p className={cn("truncate text-[15px] font-semibold", INK)}>{person.name}</p>
          <p className={cn("flex min-w-0 items-center gap-1.5 text-xs", MUTED)}>
            {person.department && <AreaTile area={person.department} className="size-4 rounded [&_svg]:size-3" />}
            <span className="truncate">{person.position ?? person.department ?? "—"}</span>
          </p>
        </div>
        <CadenceBadge cadence={pair.cadence} daysSinceLast={pair.days_since_last} overdueDays={overdueDays} />
      </div>

      <div className={cn("rounded-lg px-3 py-2.5 text-sm", pair.next_meeting ? "bg-[#f4f9fa]" : "bg-[#fafbfc]")}>
        {pair.next_meeting ? (
          <p className={cn("flex flex-wrap items-center gap-x-2", INK)}>
            <CalendarCheck2 className="size-4 text-[#347796]" aria-hidden />
            <span className="first-letter:uppercase">{formatDayLong(pair.next_meeting.starts_at)}</span>
            <span className={cn("tabular-nums", MUTED)}>{formatTime(pair.next_meeting.starts_at)}</span>
          </p>
        ) : (
          <p className={cn("flex items-center gap-2", MUTED)}>
            <CalendarPlus className="size-4" aria-hidden />
            Nenhuma 1:1 marcada
          </p>
        )}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-[#eef3f5] pt-3 text-xs">
        <div>
          <p className={cn("flex items-center gap-1", MUTED)}>
            <Sprout className="size-3.5" aria-hidden />
            PDI
          </p>
          {pair.pdi ? (
            <div className="mt-1 flex items-center gap-2">
              <span className={cn("w-8 font-semibold tabular-nums", INK)}>{pair.pdi.progress}%</span>
              <ProgressBar value={pair.pdi.progress} size="sm" tone={pair.pdi.overdue_actions ? "late" : "default"} />
            </div>
          ) : (
            <p className={cn("mt-1", BODY)}>Sem PDI ativo</p>
          )}
        </div>
        <div>
          <p className={cn("flex items-center gap-1", MUTED)}>
            <ListTodo className="size-3.5" aria-hidden />
            Ações combinadas
          </p>
          <p className={cn("mt-1 font-semibold", pair.open_actions ? INK : MUTED)}>
            {pair.open_actions ? `${pair.open_actions} em aberto` : "nenhuma em aberto"}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function MinhasClient({ overview }: { overview: OneOnOneOverview }) {
  const router = useRouter();
  const [scheduling, setScheduling] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const { asLeader, asMember } = overview;

  const pairOptions: PairOption[] = useMemo(
    () => [
      ...asLeader.map((pair) => ({
        leader: pair.leader,
        member: pair.member,
        label: `Com ${pair.member.name} (minha equipe)`,
        person: pair.member,
        relation: `Minha equipe · ${pair.member.position ?? pair.member.department ?? ""}`.replace(/ · $/, ""),
      })),
      ...asMember.map((pair) => ({
        leader: pair.leader,
        member: pair.member,
        label: `Com ${pair.leader.name} (meu gestor)`,
        person: pair.leader,
        relation: "Meu gestor",
      })),
    ],
    [asLeader, asMember]
  );

  const stats = {
    team: asLeader.length,
    onTrack: asLeader.filter((pair) => pair.cadence === "em_dia").length,
    late: asLeader.filter((pair) => pair.cadence === "atrasada").length,
    open: asLeader.reduce((sum, pair) => sum + pair.open_actions, 0),
  };

  if (!overview.me) {
    return (
      <p className={cn(SURFACE, "px-5 py-6 text-sm", BODY)}>
        Seu usuário ainda não está ligado a um cadastro de colaborador. Fale com Pessoas e Cultura.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn("max-w-2xl text-sm", BODY)}>
          Conversa periódica entre líder e liderado, com pauta combinada, ações e anotações privadas. Em dia = 1:1 realizada nos últimos{" "}
          {overview.overdue_days} dias.
        </p>
        {pairOptions.length > 0 && (
          <Button onClick={() => setScheduling(true)}>
            <CalendarPlus className="size-4" aria-hidden />
            Nova 1:1
          </Button>
        )}
      </div>

      {warning && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{warning}</p>}

      {asLeader.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={UsersRound} value={stats.team} label="Pessoas que eu lidero" tone="bg-[#e6f0f5] text-[#285f7a]" />
          <StatTile icon={CalendarCheck2} value={stats.onTrack} label="Com 1:1 em dia" tone="bg-emerald-50 text-emerald-700" />
          <StatTile icon={AlarmClock} value={stats.late} label="1:1 atrasada" tone="bg-red-50 text-red-700" />
          <StatTile icon={ListTodo} value={stats.open} label="Ações em aberto" tone="bg-[#e3f7f7] text-[#1f7f82]" />
        </div>
      )}

      {overview.upcoming.length > 0 && (
        <section className={cn(SURFACE, "p-5")}>
          <h2 className={cn("text-base font-semibold", INK)}>Próximas 1:1</h2>
          <ul className="mt-3 divide-y divide-[#eef3f5]">
            {overview.upcoming.map((meeting) => (
              <li key={meeting.id}>
                <Link
                  href={`/1-1/${meeting.leader_id}/${meeting.member_id}`}
                  className="group -mx-2 flex items-center gap-3.5 rounded-md px-2 py-3 outline-none hover:bg-[#f4fafb] focus-visible:bg-[#f4fafb]"
                >
                  <DateBlock iso={meeting.starts_at} />
                  <PersonPhoto person={meeting.with} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm font-semibold", INK)}>{meeting.with.name}</span>
                    <span className={cn("flex flex-wrap items-center gap-x-2 text-xs", MUTED)}>
                      <span className="tabular-nums">
                        {formatTime(meeting.starts_at)} às {formatTime(meeting.ends_at)}
                      </span>
                      {meeting.room && (
                        <span className="inline-flex items-center gap-1">
                          {meeting.room === "Somente online" ? <Video className="size-3" aria-hidden /> : <MapPin className="size-3" aria-hidden />}
                          {meeting.room}
                        </span>
                      )}
                      {meeting.category && <span className="truncate">{meeting.category}</span>}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-[#7b929c] transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {asLeader.length > 0 && (
        <section className="space-y-3">
          <h2 className={cn("text-base font-semibold", INK)}>Minha equipe</h2>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {asLeader.map((pair) => (
              <PairCard key={pair.member.id} pair={pair} overdueDays={overview.overdue_days} />
            ))}
          </div>
        </section>
      )}

      {asMember.length > 0 && (
        <section className="space-y-3">
          <h2 className={cn("text-base font-semibold", INK)}>Com o meu gestor</h2>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {asMember.map((pair) => (
              <PairCard key={pair.leader.id} pair={pair} overdueDays={overview.overdue_days} asMember />
            ))}
          </div>
        </section>
      )}

      {asLeader.length === 0 && asMember.length === 0 && (
        <p className={cn(SURFACE, "px-5 py-10 text-center text-sm", MUTED)}>
          Você ainda não tem gestor direto nem liderados cadastrados. Pessoas e Cultura define isso em PDI › Gestão › Gestores diretos.
        </p>
      )}

      {scheduling && (
        <ScheduleDialog
          pairs={pairOptions}
          onClose={() => setScheduling(false)}
          onDone={(message) => {
            setScheduling(false);
            setWarning(message);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
