import {
  CalendarDays,
  CalendarPlus,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEAVE_KIND_LABEL, formatISODateBR } from "@/lib/ferias/balance";
import type { VacationLeave } from "@/lib/ferias/types";
import { isVacationCreditKind } from "@/lib/ferias/types";
import { cn } from "@/lib/utils";

export interface VacationLaunchGroup {
  leave: VacationLeave;
  credits: VacationLeave[];
}

export interface GroupedVacationLaunches {
  groups: VacationLaunchGroup[];
  unlinkedCredits: VacationLeave[];
}

function isCompatibleCredit(leave: VacationLeave, credit: VacationLeave): boolean {
  const expectedKind =
    leave.kind === "recesso"
      ? "trabalho_recesso"
      : leave.kind === "ferias"
        ? "trabalho_ferias"
        : null;

  return (
    credit.kind === expectedKind &&
    credit.start_date >= leave.start_date &&
    credit.end_date <= leave.end_date
  );
}

export function groupVacationLaunches(
  leaves: VacationLeave[]
): GroupedVacationLaunches {
  const groups = leaves
    .filter((leave) => !isVacationCreditKind(leave.kind))
    .map((leave) => ({ leave, credits: [] as VacationLeave[] }));
  const unlinkedCredits: VacationLeave[] = [];

  for (const credit of leaves.filter((leave) => isVacationCreditKind(leave.kind))) {
    const matchingGroup = groups.find(({ leave }) => isCompatibleCredit(leave, credit));
    if (matchingGroup) {
      matchingGroup.credits.push(credit);
    } else {
      unlinkedCredits.push(credit);
    }
  }

  return { groups, unlinkedCredits };
}

interface LeaveLaunchesSectionProps {
  leaves: VacationLeave[];
  error: string | null;
  onRegisterWorkedDay: (leave: VacationLeave) => void;
  onEdit: (leave: VacationLeave) => void;
  onDelete: (leave: VacationLeave) => void;
}

function CreditRow({
  credit,
  onEdit,
  onDelete,
}: {
  credit: VacationLeave;
  onEdit: (leave: VacationLeave) => void;
  onDelete: (leave: VacationLeave) => void;
}) {
  const dateLabel =
    credit.start_date === credit.end_date
      ? formatISODateBR(credit.start_date)
      : `${formatISODateBR(credit.start_date)} a ${formatISODateBR(credit.end_date)}`;
  const daysLabel =
    credit.days === 1
      ? "1 dia devolvido ao saldo"
      : `${credit.days} dias devolvidos ao saldo`;

  return (
    <div className="flex flex-wrap items-center gap-3 py-2.5 pl-7">
      <RotateCcw
        className="h-4 w-4 shrink-0 text-emerald-700"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{dateLabel}</p>
        <p className="text-xs font-medium text-emerald-700">{daysLabel}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Editar crédito de ${dateLabel}`}
          title="Editar crédito"
          onClick={() => onEdit(credit)}
        >
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Excluir crédito de ${dateLabel}`}
          title="Excluir crédito"
          onClick={() => onDelete(credit)}
        >
          <Trash2 className="text-destructive" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function LeaveLaunchesSection({
  leaves,
  error,
  onRegisterWorkedDay,
  onEdit,
  onDelete,
}: LeaveLaunchesSectionProps) {
  const { groups, unlinkedCredits } = groupVacationLaunches(leaves);
  const isEmpty = groups.length === 0 && unlinkedCredits.length === 0;

  return (
    <section className="space-y-3" aria-labelledby="vacation-launches-title">
      <div>
        <h3
          id="vacation-launches-title"
          className="text-sm font-semibold text-foreground"
        >
          Lançamentos
        </h3>
        <p className="mt-0.5 max-w-[65ch] text-xs text-muted-foreground">
          Consulte cada período e registre compensações sem perder o contexto.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {isEmpty ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-5">
          <CalendarDays
            className="h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium text-foreground">
              Nenhum lançamento registrado
            </p>
            <p className="text-xs text-muted-foreground">
              Use “Registrar” para incluir férias, recesso ou abono.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {groups.map(({ leave, credits }) => {
            const canRegisterWorkedDay =
              leave.kind === "recesso" || leave.kind === "ferias";
            const dateLabel =
              leave.start_date === leave.end_date
                ? formatISODateBR(leave.start_date)
                : `${formatISODateBR(leave.start_date)} a ${formatISODateBR(leave.end_date)}`;
            const kindLabel = LEAVE_KIND_LABEL[leave.kind];
            const redundantNote =
              leave.notes?.trim().toLocaleLowerCase("pt-BR") ===
              kindLabel.toLocaleLowerCase("pt-BR");

            return (
              <article
                key={leave.id}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          leave.kind === "recesso"
                            ? "bg-violet-100 text-violet-800"
                            : leave.kind === "abono"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-[#e8f8f8] text-[#285f7a]"
                        )}
                      >
                        {kindLabel.toLocaleUpperCase("pt-BR")}
                      </span>
                      <p className="text-sm font-semibold text-foreground">
                        {dateLabel}
                      </p>
                    </div>
                    {!redundantNote && leave.notes && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {leave.notes}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <p className="font-mono text-base font-semibold tabular-nums text-foreground">
                      −{leave.days} {leave.days === 1 ? "dia" : "dias"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      descontados do saldo
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2 sm:px-4">
                  <p className="text-xs text-muted-foreground">
                    {credits.length === 0
                      ? "Nenhuma compensação registrada"
                      : `${credits.length} ${
                          credits.length === 1
                            ? "compensação registrada"
                            : "compensações registradas"
                        }`}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    {canRegisterWorkedDay && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="min-h-9"
                        onClick={() => onRegisterWorkedDay(leave)}
                      >
                        <CalendarPlus aria-hidden="true" />
                        Registrar dia trabalhado
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ${kindLabel} de ${dateLabel}`}
                      title="Editar lançamento"
                      onClick={() => onEdit(leave)}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Excluir ${kindLabel} de ${dateLabel}`}
                      title="Excluir lançamento"
                      onClick={() => onDelete(leave)}
                    >
                      <Trash2 className="text-destructive" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {credits.length > 0 && (
                  <div className="border-t border-emerald-200 bg-emerald-50/55 px-3 sm:px-4">
                    <p className="pt-2.5 text-xs font-semibold text-emerald-800">
                      Créditos neste período
                    </p>
                    <div className="divide-y divide-emerald-200/70">
                      {credits.map((credit) => (
                        <CreditRow
                          key={credit.id}
                          credit={credit}
                          onEdit={onEdit}
                          onDelete={onDelete}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          {unlinkedCredits.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/45 px-3 sm:px-4">
              <div className="border-b border-emerald-200/70 py-2.5">
                <p className="text-sm font-semibold text-emerald-900">
                  Outros créditos
                </p>
                <p className="text-xs text-emerald-800">
                  Compensações sem um período correspondente nesta ficha.
                </p>
              </div>
              <div className="divide-y divide-emerald-200/70">
                {unlinkedCredits.map((credit) => (
                  <CreditRow
                    key={credit.id}
                    credit={credit}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
