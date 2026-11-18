import { describe, expect, it } from "vitest";
import {
  entityTerms,
  rankRelatedCandidates,
  relatedCandidatesBlock,
  relatedCarouselGuidance,
  stripSourceSuffix,
  subjectTerms,
  toRelatedRef,
  uniquePeople,
  withoutSource,
  type RelatedCandidate,
} from "./related";

function candidate(id: string, title: string, text = "", source: RelatedCandidate["source"] = "instagram"): RelatedCandidate {
  return { source, id, title, text, url: `https://instagram.com/p/${id}`, date: "2026-08-21T12:00:00.000Z" };
}

const historico: RelatedCandidate[] = [
  candidate("casas", "Casas Bahia em recuperação judicial: uma nova etapa na reestruturação do grupo"),
  candidate("rihappy", "Justiça autoriza processamento de recuperação extrajudicial da Ri Happy - TJSP", "", "roteiro"),
  candidate("escala", "Fim da escala 6x1: o que pode mudar para trabalhadores e empresas?"),
  candidate("nr1", "Sua empresa está preparada para a atualização da NR-1?"),
  candidate("contrato", "Contrato de namoro: proteção patrimonial dos relacionamentos"),
  candidate("dados", "Inteligência Artificial exige governança de dados"),
];

describe("já falamos disso?", () => {
  it("tira o veículo da manchete e do resumo", () => {
    expect(stripSourceSuffix("Carbon entra com pedido de recuperação extrajudicial - Capital Aberto")).toBe(
      "Carbon entra com pedido de recuperação extrajudicial",
    );
    expect(withoutSource("Departamento jurídico assume papel - Valor Econômico", "Departamento jurídico assume papel  Valor Econômico").text).not.toContain("Valor");
  });

  it("junta NR-1 e 6x1 num termo só e ignora palavras genéricas", () => {
    expect([...subjectTerms("Atualização da NR-1 e o fim da escala 6x1 na empresa")]).toEqual(["atualizacao", "nr1", "fim", "escala", "6x1"]);
  });

  it("reconhece nomes próprios fora do início da frase", () => {
    expect(entityTerms("Justiça autoriza recuperação do Grupo Casas Bahia")).toEqual(new Set(["casas", "bahia"]));
  });

  it("acha o post do mesmo caso na frente de outro caso que só usa as mesmas palavras de processo", () => {
    const ranked = rankRelatedCandidates(
      { title: "Justiça autoriza processamento de recuperação judicial do Grupo Casas Bahia - TJSP" },
      historico,
    );
    expect(ranked[0]?.candidate.id).toBe("casas");
    expect(ranked.map((entry) => entry.candidate.id)).not.toContain("rihappy");
  });

  it("acha o mesmo tema (6x1, NR-1) e não puxa assunto sem relação", () => {
    expect(rankRelatedCandidates({ title: "Fim da escala 6X1: será mesmo?" }, historico)[0]?.candidate.id).toBe("escala");
    expect(rankRelatedCandidates({ title: "Governo publica nova versão da NR-1 com prazo para empresas" }, historico)[0]?.candidate.id).toBe("nr1");
    expect(rankRelatedCandidates({ title: "STJ decide sobre penhora de salário em execução de dívida" }, historico)).toEqual([]);
  });

  it("leva junto quem fez o post, sem repetir a mesma pessoa", () => {
    const people = uniquePeople([
      { id: "u1", name: "Lavinia Ferraz Crispim" },
      { id: "u1", name: "Lavinia" },
      null,
      { id: "", name: "sem id" },
    ]);
    expect(people).toEqual([{ id: "u1", name: "Lavinia Ferraz Crispim" }]);
    const ref = toRelatedRef({ ...historico[0], people });
    expect(ref.people).toEqual(people);
    expect(toRelatedRef(historico[1])).not.toHaveProperty("people");
  });

  it("monta a lista numerada para a IA e a orientação do carrossel", () => {
    const block = relatedCandidatesBlock(rankRelatedCandidates({ title: "Casas Bahia tem plano aprovado pelos credores" }, historico));
    expect(block).toContain("[1] post no nosso Instagram em 21/08/2026: Casas Bahia");

    const ref = { source: "instagram" as const, id: "casas", title: "Casas Bahia em recuperação judicial", url: null, date: "2026-08-21T12:00:00.000Z" };
    expect(relatedCarouselGuidance("desdobramento", ref, "Credores aprovaram o plano")).toContain("O que há de novo: Credores aprovaram o plano");
    expect(relatedCarouselGuidance("repetido", ref)).toContain("ângulo diferente");
    expect(relatedCarouselGuidance("novo", ref)).toBe("");
    expect(relatedCarouselGuidance("desdobramento", null)).toBe("");
  });
});
