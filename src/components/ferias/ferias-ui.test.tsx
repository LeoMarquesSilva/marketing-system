import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import { VacationStatusBadge } from "@/components/ferias/status-badge";
import { VacationDebtTags } from "@/components/ferias/vacation-debt-tags";
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
    expect(markup).toContain("30 dias em dia");
    expect(markup).not.toContain("Deve");
    expect(markup).not.toContain("a gozar");
    expect(markup).not.toContain("vencidos");
  });

  it("usa 'deve' só quando gozou dias além do direito", () => {
    const markup = renderToStaticMarkup(
      <VacationDebtTags
        balance={{ ...felipeBalance, unallocatedDays: 5, pendingDays: -5 }}
        compact
      />
    );
    expect(markup).toContain("Deve 5");
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
