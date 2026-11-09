import { describe, expect, it } from "vitest";
import { diasDeAtraso, montarResumoSla, resumoEmHtml, type PublicacaoDoResumo } from "./resumo-sla";

/** `total` publicações do conjunto: uma por grupo, e o restante repete o primeiro grupo. */
function conjunto(escritorio: string, dia: string, demandaRisco: boolean, grupos: string[], total: number): PublicacaoDoResumo[] {
  return Array.from({ length: total }, (_, i) => ({ escritorio, dia, demandaRisco, grupo: grupos[i] ?? grupos[0] }));
}

const SEGUNDA_MANHA = new Date("2026-11-09T09:18:00-03:00");

describe("resumoEmHtml", () => {
  it("mantém as linhas e escapa o nome dos grupos", () => {
    expect(resumoEmHtml("Grupos: Grupo A & B <C>\nTotal: 1")).toBe("Grupos: Grupo A &amp; B &lt;C&gt;<br>Total: 1");
  });
});

describe("diasDeAtraso", () => {
  it("vale até 12h do próximo dia útil", () => {
    expect(diasDeAtraso("2026-11-06", new Date("2026-11-09T12:00:00-03:00"), [])).toBe(0);
    expect(diasDeAtraso("2026-11-06", new Date("2026-11-09T12:01:00-03:00"), [])).toBe(1);
  });

  it("soma 1 por dia útil depois do limite, sem contar o fim de semana", () => {
    expect(diasDeAtraso("2026-11-05", new Date("2026-11-06T14:00:00-03:00"), [])).toBe(1);
    expect(diasDeAtraso("2026-11-05", new Date("2026-11-07T10:00:00-03:00"), [])).toBe(1);
    expect(diasDeAtraso("2026-11-05", SEGUNDA_MANHA, [])).toBe(1);
    expect(diasDeAtraso("2026-11-05", new Date("2026-11-10T09:00:00-03:00"), [])).toBe(2);
  });

  it("feriado não conta", () => {
    expect(diasDeAtraso("2026-11-19", new Date("2026-11-23T11:00:00-03:00"), ["2026-11-20"])).toBe(0);
  });
});

describe("montarResumoSla", () => {
  it("reproduz o modelo do aviso", () => {
    const publicacoes = [
      ...conjunto("Trabalhista", "2026-11-06", false, ["Grupo B", "Grupo C"], 30),
      ...conjunto("Cível | Insolvência", "2026-11-06", true, ["Grupo Lira", "Grupo Teixeira"], 7),
      ...conjunto("Trabalhista", "2026-11-05", false, ["Grupo A"], 31),
      ...conjunto("Insolvência", "2026-11-06", true, ["Grupo CDA"], 6),
      ...conjunto("Tributário", "2026-11-05", false, ["Grupo Spel"], 1),
    ];
    expect(montarResumoSla(publicacoes, SEGUNDA_MANHA, [])).toBe(
      [
        "📊 Resumo SLA Publicações — JURÍDICO VISTAR",
        "Conjuntos: 5 | Publicações: 75 | Fora SLA: 32",
        "CÍVEL | INSOLVÊNCIA",
        "🟢 06-11-2026 - Demanda de Risco",
        "Grupos: Grupo Lira, Grupo Teixeira",
        "Total: 7 | Dentro SLA: 7 | Fora SLA: 0",
        "Maior atraso: 0 dias",
        "______________________________",
        "INSOLVÊNCIA",
        "🟢 06-11-2026 - Demanda de Risco",
        "Grupos: Grupo CDA",
        "Total: 6 | Dentro SLA: 6 | Fora SLA: 0",
        "Maior atraso: 0 dias",
        "______________________________",
        "TRABALHISTA",
        "🟡 05-11-2026 - Demanda Comum",
        "Grupos: Grupo A",
        "Total: 31 | Dentro SLA: 0 | Fora SLA: 31",
        "Maior atraso: 1 dia",
        "🟢 06-11-2026 - Demanda Comum",
        "Grupos: Grupo B, Grupo C",
        "Total: 30 | Dentro SLA: 30 | Fora SLA: 0",
        "Maior atraso: 0 dias",
        "______________________________",
        "TRIBUTÁRIO",
        "🟡 05-11-2026 - Demanda Comum",
        "Grupos: Grupo Spel",
        "Total: 1 | Dentro SLA: 0 | Fora SLA: 1",
        "Maior atraso: 1 dia",
      ].join("\n"),
    );
  });

  it("deixa Operações Legais de fora", () => {
    const texto = montarResumoSla(
      [...conjunto("Operações Legais", "2026-10-26", false, ["Grupo X"], 5), ...conjunto("Cível", "2026-11-06", false, ["Grupo Y"], 1)],
      SEGUNDA_MANHA,
      [],
    );
    expect(texto).not.toContain("OPERAÇÕES LEGAIS");
    expect(texto).toContain("Conjuntos: 1 | Publicações: 1 | Fora SLA: 0");
  });

  it("marca atraso de 2 dias ou mais em vermelho e põe o risco antes no mesmo dia", () => {
    const texto = montarResumoSla(
      [...conjunto("Cível", "2026-11-04", false, ["Grupo X"], 1), ...conjunto("Cível", "2026-11-04", true, ["Grupo Y"], 1)],
      new Date("2026-11-09T09:00:00-03:00"),
      [],
    );
    expect(texto.indexOf("🔴 04-11-2026 - Demanda de Risco")).toBeGreaterThan(-1);
    expect(texto.indexOf("🔴 04-11-2026 - Demanda de Risco")).toBeLessThan(texto.indexOf("🔴 04-11-2026 - Demanda Comum"));
    expect(texto).toContain("Maior atraso: 2 dias");
  });

  it("fila vazia traz só o cabeçalho zerado", () => {
    expect(montarResumoSla([], SEGUNDA_MANHA, [])).toBe("📊 Resumo SLA Publicações — JURÍDICO VISTAR\nConjuntos: 0 | Publicações: 0 | Fora SLA: 0");
  });
});
