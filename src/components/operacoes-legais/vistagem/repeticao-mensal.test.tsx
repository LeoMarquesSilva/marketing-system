import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RepeticaoMensal } from "./repeticao-mensal";

const tela = (vezes: number, fatais: string[], maximo = 10) =>
  renderToStaticMarkup(<RepeticaoMensal indice={0} vezes={vezes} maximo={maximo} fatais={fatais} onChange={() => undefined} />)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

describe("RepeticaoMensal: COMPROVAR PAGAMENTO todo mês (pedido de 24/11/2026)", () => {
  it("mostra as fatais de cada mês e marca as que não caem no mesmo dia", () => {
    const texto = tela(4, ["2026-11-30", "2026-12-30", "2027-01-29", "2027-02-26"]);
    expect(texto).toContain("Repetir todo mês");
    expect(texto).toContain("vezes ao todo, uma por mês");
    expect(texto).toContain("30/11/2026 · 30/12/2026 · 29/01/2027* · 26/02/2027*");
    expect(texto).toContain("sem esse dia no mês, o último; sem expediente, o dia útil anterior");
  });

  it("uma vez só: sem a lista de fatais", () => {
    const texto = tela(1, ["2026-11-30"]);
    expect(texto).toContain("vez (só esta fatal)");
    expect(texto).not.toContain("Fatais no VIOS");
  });

  it("sem a fatal escolhida, pede a fatal", () => {
    expect(tela(3, [])).toContain("Escolha a data fatal para ver as dos meses seguintes.");
  });

  it("o + para no limite de tarefas da publicação", () => {
    const html = renderToStaticMarkup(<RepeticaoMensal indice={0} vezes={3} maximo={3} fatais={[]} onChange={() => undefined} />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Uma vez a mais"|<button[^>]*aria-label="Uma vez a mais"[^>]*disabled=""/);
  });
});
