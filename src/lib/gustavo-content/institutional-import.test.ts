import { describe, expect, it } from "vitest";
import {
  pickInstitutionalCandidates,
  shouldSkipInstitutionalTitle,
} from "@/lib/gustavo-content/institutional-import";

describe("shouldSkipInstitutionalTitle", () => {
  it("descarta ruído institucional que não é pauta de thought leadership", () => {
    expect(
      shouldSkipInstitutionalTitle(
        "OAB/MS e ESA/MS realizam aula magna sobre recuperação judicial"
      )
    ).toBe(true);
    expect(
      shouldSkipInstitutionalTitle(
        "Gráfico mostra dados de recuperação judicial, não de falência - AFP Chegamos"
      )
    ).toBe(true);
    expect(
      shouldSkipInstitutionalTitle("Habib’s entra em RJ com dívidas de R$ 265 milhões")
    ).toBe(false);
  });
});

describe("pickInstitutionalCandidates", () => {
  it("não reaproveita o mesmo fato já no radar do Gustavo", () => {
    const picked = pickInstitutionalCandidates(
      [
        {
          title: "Casas Bahia protocola pedido de recuperação judicial - Meio e Mensagem",
          link: "https://a.com/cb",
        },
        {
          title: "Braskem protocola recuperação extrajudicial - Folha",
          link: "https://a.com/braskem",
        },
      ],
      [
        {
          title: "Casas Bahia protocola pedido de recuperação judicial | Valor",
          link: "https://b.com/cb",
          content_snippet: "Pedido de RJ",
          published_at: "2026-08-17T00:00:00.000Z",
        },
        {
          title: "Mais uma: fabricante de pás eólicas Aeris pede cautelar contra credores",
          link: "https://braziljournal.com/aeris",
          content_snippet: "Aeris pediu cautelar",
          published_at: "2026-08-21T00:00:00.000Z",
        },
      ],
      8
    );
    expect(picked.map((item) => item.title)).toEqual([
      "Mais uma: fabricante de pás eólicas Aeris pede cautelar contra credores",
    ]);
  });
});
