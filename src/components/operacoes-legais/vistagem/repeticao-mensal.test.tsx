import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { criarCalendario } from "@/lib/vistagem/dias-uteis";
import type { MesDaRecorrencia } from "@/lib/vistagem/repeticao-mensal";
import { RecorrenciaMensal } from "./repeticao-mensal";

const ehDiaUtil = criarCalendario([]);

const html = (meses: MesDaRecorrencia[] | null, { primeira = "2026-11-30", maximo = 10 } = {}) =>
  renderToStaticMarkup(<RecorrenciaMensal indice={0} primeira={primeira} meses={meses} maximo={maximo} ehDiaUtil={ehDiaUtil} onChange={() => undefined} />);
const texto = (marcacao: string) => marcacao.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("RecorrenciaMensal: COMPROVAR PAGAMENTO recorrente (pedido de 24/11/2026)", () => {
  it("desligada: só o botão, sem a lista de meses", () => {
    const marcacao = html(null);
    expect(marcacao).toMatch(/aria-pressed="false"/);
    expect(texto(marcacao)).toContain("Recorrente todo mês");
    expect(texto(marcacao)).not.toContain("Adicionar mês");
  });

  it("ligada: cada mês com a data editável, tirar e adicionar mês", () => {
    const marcacao = html([
      { meses: 1, fatal: "2026-12-30", editada: false },
      { meses: 2, fatal: "2027-01-25", editada: true },
    ]);
    expect(marcacao).toMatch(/aria-pressed="true"/);
    const lido = texto(marcacao);
    expect(lido).toContain("3 vezes ao todo, uma por mês");
    expect(lido).toContain("1ª 30/11/2026 esta tarefa");
    expect(marcacao).toContain('aria-label="Data fatal da 2ª vez da tarefa 1"');
    expect(marcacao).toContain('aria-label="Data fatal da 3ª vez da tarefa 1"');
    expect(lido).toContain("mudada");
    expect(marcacao).toContain('aria-label="Tirar a 2ª vez da tarefa 1"');
    expect(lido).toContain("Adicionar mês");
    expect(lido).toContain("Dá para mudar ou tirar cada uma.");
  });

  it("aponta o mês sem data, antes da 1ª fatal ou repetido, e avisa o dia sem expediente", () => {
    expect(texto(html([{ meses: 1, fatal: "", editada: false }]))).toContain("Falta a data.");
    expect(texto(html([{ meses: 1, fatal: "2026-11-20", editada: true }]))).toContain("Tem de ser depois da 1ª fatal.");
    expect(
      texto(
        html([
          { meses: 1, fatal: "2026-12-30", editada: false },
          { meses: 2, fatal: "2026-12-30", editada: true },
        ])
      )
    ).toContain("Data repetida.");
    expect(texto(html([{ meses: 1, fatal: "2027-01-30", editada: true }]))).toContain("Não é dia útil.");
  });

  it("no limite de tarefas da publicação, não deixa adicionar nem ligar", () => {
    const cheia = html([{ meses: 1, fatal: "2026-12-30", editada: false }], { maximo: 2 });
    expect(cheia).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Adicionar mês/);
    expect(html(null, { maximo: 1 })).toMatch(/<button[^>]*aria-pressed="false"[^>]*disabled=""|<button[^>]*disabled=""[^>]*aria-pressed="false"/);
  });
});
