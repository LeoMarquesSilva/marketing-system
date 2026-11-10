"use client";

import { Bus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBrl } from "@/lib/eventos";
import type { TransportPlan } from "@/lib/eventos-orcamento";
import { cn } from "@/lib/utils";

const CARD = "rounded-lg border border-[#dce9eb] bg-card shadow-[0_1px_2px_rgba(3,32,47,0.05)]";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Transporte cobrado por veículo: mostra a conta de hoje, os degraus de custo e a reserva. */
export function EventoTransporteCard({
  title,
  plan,
  busy,
  onEditLine,
  onRaiseLine,
}: {
  title: string;
  plan: TransportPlan;
  busy: boolean;
  onEditLine: () => void;
  onRaiseLine: (amount: number) => void;
}) {
  const capacity = Math.max(plan.vehiclesNow, 1) * plan.seats;
  const filled = Math.min(100, Math.round((plan.peak / capacity) * 100));
  const nextAt = Math.max(plan.vehiclesNow, 1) * plan.seats + 1;
  return (
    <section aria-label="Transporte" className={cn(CARD, "overflow-hidden")}>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[#e6eef0] px-4 py-3">
        <Bus className="size-4 shrink-0 text-[#3e84a8]" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Transporte</h3>
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{title}</p>
        <Button variant="outline" size="sm" onClick={onEditLine}>
          Abrir a despesa
        </Button>
      </div>

      <div className="grid gap-5 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-foreground/80">
            O valor não é por pessoa. Cada micro-ônibus leva <strong className="font-semibold text-foreground">{plan.seats} pessoas</strong> e custa{" "}
            <strong className="font-semibold text-foreground">{formatBrl(plan.unitAmount)}</strong>, ida e volta. Quando os pedidos passam da lotação, entra mais um veículo inteiro.
          </p>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-foreground">
                {plan.peak} de {capacity} lugares pedidos
              </p>
              <p className="text-xs text-muted-foreground">
                {plan.outbound} na ida · {plan.inbound} na volta
              </p>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${filled}% da lotação pedida`}>
              <div className="h-full rounded-full bg-[#347796]" style={{ width: `${filled}%` }} />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {plan.vehiclesNow <= 1 ? "Hoje cabe em 1 micro-ônibus" : `Hoje são ${plan.vehiclesNow} micro-ônibus`}: {formatBrl(Math.max(plan.costNow, plan.unitAmount))}. Sobram{" "}
              {plural(plan.seatsLeft, "lugar", "lugares")}; o {nextAt}º pedido exige mais um veículo.
            </p>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            {plan.waiting > 0
              ? `${plural(plan.waiting, "colaborador ainda não respondeu", "colaboradores ainda não responderam")}. Se todos pedirem transporte, seriam ${plan.worstPeak} pessoas: ${plural(plan.worstVehicles, "micro-ônibus", "micro-ônibus")}, ${formatBrl(plan.worstCost)}.`
              : "Todos os colaboradores já responderam: a quantidade está fechada."}
          </p>
        </div>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-md border border-[#e6eef0]">
            <table className="w-full text-sm">
              <thead className="bg-[#f6fafb] text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Quem pede transporte</th>
                  <th scope="col" className="px-3 py-2 font-medium">Micro-ônibus</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Custo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3f4]">
                {plan.tiers.map((tier) => {
                  const current = tier.vehicles === Math.max(plan.vehiclesNow, 1);
                  const worst = tier.vehicles === plan.worstVehicles && plan.worstVehicles > Math.max(plan.vehiclesNow, 1);
                  return (
                    <tr key={tier.vehicles} className={cn(current && "bg-[#f3fafb]")}>
                      <td className="px-3 py-2 text-foreground">
                        {tier.vehicles === 1 ? `Até ${tier.toPeople} pessoas` : `De ${tier.fromPeople} a ${tier.toPeople} pessoas`}
                        {current && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">hoje</span>}
                        {worst && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">se todos pedirem</span>}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-foreground">{tier.vehicles}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums text-foreground", current && "font-semibold")}>{formatBrl(tier.cost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {plan.shortfall > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-md bg-amber-50 px-3 py-2.5 ring-1 ring-inset ring-amber-200">
              <TriangleAlert className="size-4 shrink-0 text-amber-700" aria-hidden />
              <p className="min-w-0 flex-1 text-sm leading-5 text-amber-900">
                A despesa prevê {formatBrl(plan.budgeted)}, mas os pedidos já exigem {formatBrl(plan.costNow)}.
              </p>
              <Button size="sm" disabled={busy} onClick={() => onRaiseLine(plan.costNow)}>
                Atualizar para {formatBrl(plan.costNow)}
              </Button>
            </div>
          ) : (
            <dl className="grid gap-x-4 gap-y-1 rounded-md bg-[#f6fafb] px-3 py-2.5 text-sm sm:grid-cols-[1fr_auto]">
              <dt className="text-muted-foreground">Na despesa do orçamento (aprovado)</dt>
              <dd className="text-right font-medium tabular-nums text-foreground">{formatBrl(plan.budgeted)}</dd>
              {plan.reserve > 0 && (
                <>
                  <dt className="text-muted-foreground">Reserva, se precisar de mais veículo</dt>
                  <dd className="text-right font-medium tabular-nums text-foreground">{formatBrl(plan.reserve)}</dd>
                  <dt className="font-medium text-foreground">Teto do transporte no total previsto</dt>
                  <dd className="text-right font-semibold tabular-nums text-foreground">{formatBrl(plan.budgeted + plan.reserve)}</dd>
                </>
              )}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}
