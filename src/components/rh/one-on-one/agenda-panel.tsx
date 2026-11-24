"use client";

import {
  CalendarSearch,
  CheckCircle2,
  CircleAlert,
  MapPin,
} from "lucide-react";
import type { AvailabilityResult } from "@/lib/rh/one-on-one/types";
import { InfoTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PersonPhoto } from "../pdi/pdi-visuals";

const START_HOUR = 8;
const END_HOUR = 19;
const CELLS = ((END_HOUR - START_HOUR) * 60) / 30;
const TICKS = [8, 10, 12, 14, 16, 18];

/**
 * availabilityView do Outlook: 0 livre, 1 provisório, 2 ocupado, 3 fora do escritório,
 * 4 trabalhando em outro lugar. A grade de horários (isWindowFree) trata 0 e 4 como livres;
 * o painel segue a mesma regra para não mostrar vermelho onde a grade deixa marcar.
 */
const isFree = (char: string) => char === "0" || char === "4";

function cellTone(char: string | undefined): string {
  if (char === undefined) return "bg-[#eef2f3]";
  if (isFree(char)) return "bg-[#d3efe8]";
  if (char === "1") return "bg-amber-300";
  return "bg-rose-400";
}

/** Situação da pessoa/sala no horário escolhido. */
function windowState(
  view: string,
  start: number,
  span: number,
): "livre" | "provisorio" | "ocupado" {
  const cells = view.slice(start, start + span).split("");
  if (cells.every(isFree)) return "livre";
  if (cells.every((char) => isFree(char) || char === "1")) return "provisorio";
  return "ocupado";
}

function hoursLabel(cells: number): string {
  const minutes = cells * 30;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours}h${rest}` : `${hours}h`;
}

function indexOf(time: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const index = (minutes - START_HOUR * 60) / 30;
  return Number.isInteger(index) && index >= 0 && index < CELLS ? index : null;
}

/**
 * Quem teve a agenda consultada no Outlook (líder, liderado e sala), com a linha
 * do dia das 8h às 19h: ocupado, provisório e livre, e o horário escolhido marcado.
 */
export function AgendaPanel({
  people,
  dayLabel,
  time,
  duration,
}: {
  people: AvailabilityResult["people"];
  dayLabel: string;
  time: string;
  duration: number;
}) {
  if (!people.length) return null;
  const start = indexOf(time);
  const span = Math.max(1, Math.ceil(duration / 30));

  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-lg border border-[#e6eff1] bg-[#fafcfc] p-3">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#3b5560]">
            <CalendarSearch className="size-3.5 text-[#3e84a8]" aria-hidden />
            Agendas no Outlook ·{" "}
            <span className="font-normal first-letter:uppercase">
              {dayLabel}
            </span>
          </p>
          <span className="flex items-center gap-3 text-xs text-[#5a717b]">
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-[#d3efe8]" aria-hidden />
              Livre
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-amber-300" aria-hidden />
              Provisório
              <InfoTooltip
                title="Provisório"
                description="Compromisso que a pessoa marcou como Provisório no Outlook: respondeu o convite com Provisório ou deixou o evento como Mostrar como: Provisório. Na grade de horários, conta como ocupado."
              />
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-rose-400" aria-hidden />
              Ocupado
              <InfoTooltip
                title="Ocupado"
                description="Ocupado ou fora do escritório no Outlook. Trabalhando em outro lugar conta como livre, porque dá para fazer a 1:1 pelo Teams."
              />
            </span>
          </span>
        </div>

        <ul className="space-y-2.5">
          {people.map((item) => {
            const busy = item.view
              .split("")
              .filter((char) => !isFree(char)).length;
            const state =
              start !== null && item.ok
                ? windowState(item.view, start, span)
                : null;
            return (
              <li
                key={`${item.kind}-${item.label}`}
                className="grid items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,12.5rem)_1fr]"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {item.person ? (
                    <PersonPhoto person={item.person} size="sm" />
                  ) : (
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700">
                      <MapPin className="size-4" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#0d2a38]">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs",
                        !item.ok || state === "provisorio"
                          ? "text-amber-700"
                          : state === "ocupado"
                            ? "text-rose-700"
                            : "text-[#5a717b]",
                      )}
                    >
                      {!item.ok ? (
                        <>
                          <CircleAlert className="size-3" aria-hidden />
                          Agenda não liberada
                        </>
                      ) : state === "livre" ? (
                        <>
                          <CheckCircle2
                            className="size-3 text-emerald-600"
                            aria-hidden
                          />
                          Livre às {time}
                        </>
                      ) : state === "provisorio" ? (
                        <>
                          <CircleAlert className="size-3" aria-hidden />
                          Provisório às {time}
                        </>
                      ) : state === "ocupado" ? (
                        <>
                          <CircleAlert className="size-3" aria-hidden />
                          Ocupado às {time}
                        </>
                      ) : busy === 0 ? (
                        "Livre o dia todo"
                      ) : (
                        `${hoursLabel(busy)} ocupadas no dia`
                      )}
                    </span>
                  </span>
                </span>

                <span className="relative block pb-5">
                  <span
                    className="flex gap-px overflow-hidden rounded"
                    aria-hidden
                  >
                    {Array.from({ length: CELLS }, (_, index) => (
                      <span
                        key={index}
                        className={cn(
                          "h-3 flex-1",
                          cellTone(item.ok ? item.view[index] : undefined),
                        )}
                      />
                    ))}
                  </span>
                  {start !== null && (
                    <span
                      className="absolute -top-0.5 h-4 rounded-[3px] ring-2 ring-[#347796]"
                      style={{
                        left: `${(start / CELLS) * 100}%`,
                        width: `${(Math.min(span, CELLS - start) / CELLS) * 100}%`,
                      }}
                      aria-hidden
                    />
                  )}
                  <span
                    className="absolute inset-x-0 bottom-0 h-4 text-xs leading-4 text-[#7b929c]"
                    aria-hidden
                  >
                    {TICKS.map((hour) => (
                      <span
                        key={hour}
                        className="absolute -translate-x-1/2 tabular-nums"
                        style={{
                          left: `${((hour - START_HOUR) * 2 * 100) / CELLS}%`,
                        }}
                      >
                        {hour}h
                      </span>
                    ))}
                  </span>
                  <span className="sr-only">
                    {item.ok
                      ? `${item.label}: ${busy === 0 ? "livre o dia todo" : `${hoursLabel(busy)} ocupadas`}`
                      : `${item.label}: agenda não liberada`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </TooltipProvider>
  );
}
