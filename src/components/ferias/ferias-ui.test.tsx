import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import { VacationStatusBadge } from "@/components/ferias/status-badge";
import {
  nextRecessDebtWarning,
  scheduledWhileInDebtWarning,
  splitScheduledLeaves,
  VacationDebtTags,
  VacationSituationCells,
} from "@/components/ferias/vacation-debt-tags";
import { PERIOD_STATUS_LABEL } from "@/lib/ferias/balance";
import type { EmployeeBalance } from "@/lib/ferias/types";

describe("VacationStatusBadge", () => {
  it("rotula os quatro status em português", () => {
    expect(PERIOD_STATUS_LABEL.quitado).toBe("Quitado");
    expect(PERIOD_STATUS_LABEL.em_dia).toBe("Em dia");
    expect(PERIOD_STATUS_LABEL.a_vencer).toBe("A vencer");
    expect(PERIOD_STATUS_LABEL.vencido).toBe("Vencido");
  });

  it("renderiza o rótulo visível", () => {
    const markup = renderToStaticMarkup(<VacationStatusBadge status="a_vencer" />);
    expect(markup).toContain("A vencer");
  });
});

describe("VacationDebtTags", () => {
  const felipeBalance: EmployeeBalance = {
    totalEntitledDays: 180,
    totalTakenDays: 129,
    pendingDays: 51,
    overdueDays: 0,
    dueTodayDays: 21,
    dueSoonDays: 0,
    onTimeDays: 30,
    unallocatedDays: 0,
    scheduledDays: 0,
    status: "a_vencer",
    periods: [],
    currentPeriod: null,
    onLeaveNow: null,
    scheduledLeaves: [],
  };

  it("mostra o desdobramento do saldo, sem tratar pendência como dívida", () => {
    const markup = renderToStaticMarkup(<VacationDebtTags balance={felipeBalance} />);
    expect(markup).toContain("21 dias vencem hoje");
    expect(markup).toContain("30 dias positivos");
    expect(markup).not.toContain("Deve");
    expect(markup).not.toContain("a gozar");
    expect(markup).not.toContain("vencidos");
  });

  it("mostra o excesso gozado como saldo negativo", () => {
    const markup = renderToStaticMarkup(
      <VacationDebtTags
        balance={{ ...felipeBalance, unallocatedDays: 5, pendingDays: -5 }}
      />
    );
    expect(markup).toContain("-5");
    expect(markup).not.toContain("dias a mais");
    expect(markup).not.toContain("Deve 5");
  });

  it("avisa no badge quando já deve e ainda tem férias programadas", () => {
    expect(
      scheduledWhileInDebtWarning({ unallocatedDays: 2, scheduledDays: 4 })
    ).toBe(
      "Já deve 2 dias e ainda tem 4 dias programados. Quando o gozo começar, a dívida aumenta."
    );
    expect(scheduledWhileInDebtWarning({ unallocatedDays: 0, scheduledDays: 4 })).toBeNull();
    expect(scheduledWhileInDebtWarning({ unallocatedDays: 2, scheduledDays: 0 })).toBeNull();

    const markup = renderToStaticMarkup(
      <VacationDebtTags
        balance={{
          ...felipeBalance,
          unallocatedDays: 2,
          pendingDays: -2,
          scheduledDays: 4,
          dueTodayDays: 0,
          onTimeDays: 0,
        }}
        compact
      />
    );
    expect(markup).toContain("4 dias programados");
    expect(markup).not.toMatch(/title="[^"]*Já deve/);
  });

  it("avisa de outra forma quando o programado passa do saldo atual", () => {
    const markup = renderToStaticMarkup(
      <VacationDebtTags
        balance={{
          ...felipeBalance,
          pendingDays: 1,
          dueTodayDays: 0,
          onTimeDays: 0,
          scheduledDays: 5,
          scheduledLeaves: [
            {
              id: "prog",
              employee_id: "x",
              start_date: "2026-10-10",
              end_date: "2026-10-14",
              days: 5,
              kind: "ferias",
              notes: null,
            },
          ],
        }}
        admissionDate="2025-01-27"
        referenceDate="2026-09-01"
        compact
      />
    );
    expect(markup).toContain("5 dias programados");
    expect(markup).not.toMatch(/title="[^"]*Saldo insuficiente/);
    expect(markup).not.toContain("Já deve");
  });

  it("escreve 'dias programados' na situação compacta", () => {
    const markup = renderToStaticMarkup(
      <VacationDebtTags
        balance={{ ...felipeBalance, scheduledDays: 4, dueTodayDays: 0, onTimeDays: 0 }}
        compact
      />
    );
    expect(markup).toContain("4 dias programados");
    expect(markup).not.toContain("4 programados");
  });

  it("na lista mostra situação, programação e próximo recesso", () => {
    const markup = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <VacationSituationCells
              balance={{
                ...felipeBalance,
                unallocatedDays: 2,
                overdueDays: 10,
                dueSoonDays: 4,
                scheduledDays: 22,
                scheduledLeaves: [
                  {
                    id: "ferias",
                    employee_id: "x",
                    start_date: "2026-10-10",
                    end_date: "2026-10-14",
                    days: 5,
                    kind: "ferias",
                    notes: null,
                  },
                  {
                    id: "recesso",
                    employee_id: "x",
                    start_date: "2026-12-22",
                    end_date: "2027-01-07",
                    days: 17,
                    kind: "recesso",
                    notes: null,
                  },
                ],
                onLeaveNow: {
                  id: "now",
                  employee_id: "x",
                  start_date: "2026-08-20",
                  end_date: "2026-09-03",
                  days: 15,
                  kind: "ferias",
                  notes: null,
                },
              }}
            />
          </tr>
        </tbody>
      </table>
    );
    expect(markup).toContain('data-situation="em_ferias"');
    expect(markup).toContain('data-situation="programados"');
    expect(markup).toContain('data-situation="proximo_recesso"');
    expect(markup).toContain("Em férias");
    expect(markup).toMatch(/data-situation="programados"[^>]*>[\s\S]*5/);
    expect(markup).toMatch(/data-situation="proximo_recesso"[^>]*>[\s\S]*17/);
    expect(markup).not.toContain("22/12/2026");
    expect(markup).not.toMatch(/title="[^"]*Já deve/);
    expect(
      nextRecessDebtWarning(
        { unallocatedDays: 2, pendingDays: -2, scheduledLeaves: [] },
        {
          id: "recesso",
          employee_id: "x",
          start_date: "2026-12-22",
          end_date: "2027-01-07",
          days: 17,
          kind: "recesso",
          notes: null,
        }
      )?.warning
    ).toContain("22/12/2026");
    expect(markup).not.toContain('data-situation="deve"');
    expect(markup).not.toContain('data-situation="vencidas"');
    expect(markup).not.toContain('data-situation="a_vencer"');
    expect(markup).not.toContain('data-situation="positivo"');
  });

  it("não mistura recesso na coluna de programação", () => {
    const split = splitScheduledLeaves([
      {
        id: "ferias",
        employee_id: "x",
        start_date: "2026-10-10",
        end_date: "2026-10-14",
        days: 5,
        kind: "ferias",
        notes: null,
      },
      {
        id: "recesso",
        employee_id: "x",
        start_date: "2026-12-22",
        end_date: "2027-01-07",
        days: 17,
        kind: "recesso",
        notes: null,
      },
    ]);
    expect(split.programmingDays).toBe(5);
    expect(split.nextRecess?.days).toBe(17);

    expect(
      nextRecessDebtWarning(
        { unallocatedDays: 2, pendingDays: -2, scheduledLeaves: [] },
        split.nextRecess!
      )?.tone
    ).toBe("debt");
  });

  it("mostra traço na situação quando não está de férias", () => {
    const markup = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <VacationSituationCells balance={felipeBalance} />
          </tr>
        </tbody>
      </table>
    );
    expect(markup).toContain(">-<");
    expect(markup).not.toContain("Não");
    expect(markup).not.toContain("Em férias");
  });

  it("destaca férias vencidas quando o concessivo já passou", () => {
    const markup = renderToStaticMarkup(
      <VacationDebtTags
        balance={{ ...felipeBalance, overdueDays: 10, dueTodayDays: 0, onTimeDays: 41 }}
      />
    );
    expect(markup).toContain("10 dias vencidos");
  });
});

describe("EmployeeAvatar", () => {
  it("mostra iniciais quando não há foto", () => {
    const markup = renderToStaticMarkup(
      <EmployeeAvatar name="Felipe Soares de Camargo" avatarUrl={null} />
    );
    expect(markup).toContain("FS");
  });

  it("marca quando há foto (Radix AvatarImage não hidrata no SSR)", () => {
    const markup = renderToStaticMarkup(
      <EmployeeAvatar
        name="Felipe Soares de Camargo"
        avatarUrl="https://www.bismarchipires.com.br/img/team/legal-ops/felipe-carmargo.jpg"
      />
    );
    expect(markup).toContain('data-has-photo="true"');
    expect(markup).toContain("Felipe Soares de Camargo");
  });
});
