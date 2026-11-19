import { describe, expect, it } from "vitest";
import type { Acordo } from "./acordos";
import { leituraAcordosVazia, parcelasDoLido, sugestoesDosAcordos, type AcordoSugerido, type LeituraAcordos } from "./acordos-leitura";

const conferidor = { trecho: (pagina: number | null) => ({ pagina, conferido: true }) };
const de = (pagina: number) => ({ pagina, trecho: "trecho do acordo", confianca: "alta" as const });

const acordoLido = (extra: Partial<LeituraAcordos["acordos"][number]> = {}): LeituraAcordos["acordos"][number] => ({
  celebrado_em: "2026-03-01",
  homologado_em: null,
  cliente_paga: false,
  valor_total: 12000,
  entrada_valor: 2000,
  entrada_vencimento: "2026-03-10",
  quantidade_parcelas: 10,
  valor_parcela: 1000,
  primeiro_vencimento: "2026-04-10",
  periodicidade: "mensal",
  multa_percentual: 20,
  condicoes: null,
  ...de(10),
  ...extra,
});

const naFicha: Acordo = {
  id: "a1",
  processoId: "x",
  posicao: "recebe",
  celebradoEm: "2026-03-01",
  homologadoEm: null,
  valorTotal: 12000,
  multaPercentual: 20,
  situacao: "vigente",
  descumpridoEm: null,
  observacao: null,
  origem: "manual",
  documentoId: null,
  pagina: null,
  criadoPorNome: null,
  parcelas: [{ id: "p1", numero: 1, vencimento: "2026-04-10", valor: 1000, pagoEm: "2026-04-09", valorPago: 1000, observacao: null, origem: "manual", documentoId: null, pagina: null }],
};

describe("sugestões de acordo lidas nos autos", () => {
  it("propõe o acordo com o plano de parcelas e quem paga; a homologação ganha da petição", () => {
    const lido = { ...leituraAcordosVazia(), acordos: [acordoLido(), acordoLido({ homologado_em: "2026-03-20", ...de(25) })] };
    const sugestoes = sugestoesDosAcordos(lido, [], conferidor);
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ tipo: "acordo", campo: "acordo", pagina: 25 });
    expect(sugestoes[0].resumo).toContain("homologado em 20/03/2026");
    expect(sugestoes[0].resumo).toContain("o cliente recebe");
    const parcelas = parcelasDoLido((sugestoes[0].valor as AcordoSugerido).dados);
    expect(parcelas).toHaveLength(11);
    expect(parcelas?.[10]).toEqual({ numero: 10, vencimento: "2027-01-10", valor: 1000 });
  });

  it("não propõe acordo sem vencimentos, nem o que a ficha já tem", () => {
    expect(sugestoesDosAcordos({ ...leituraAcordosVazia(), acordos: [acordoLido({ primeiro_vencimento: null })] }, [], conferidor)).toHaveLength(0);
    expect(sugestoesDosAcordos({ ...leituraAcordosVazia(), acordos: [acordoLido()] }, [naFicha], conferidor)).toHaveLength(0);
  });

  it("pagamento já registrado não volta; descumprimento só com acordo", () => {
    const lido: LeituraAcordos = {
      acordos: [],
      pagamentos: [
        { data: "2026-04-10", valor: 1000, parcela_numero: 1, descricao: null, ...de(30) },
        { data: "2026-05-11", valor: 1000, parcela_numero: 2, descricao: "comprovante", ...de(31) },
      ],
      descumprimentos: [{ data: "2026-07-01", descricao: "parcela 4 não paga", ...de(40) }],
    };
    const comFicha = sugestoesDosAcordos(lido, [naFicha], conferidor);
    expect(comFicha.map((item) => item.campo)).toEqual(["pagamento", "descumprimento"]);
    expect(comFicha[0].resumo).toContain("parcela 2");
    const semAcordo = sugestoesDosAcordos(lido, [], conferidor);
    expect(semAcordo.map((item) => item.campo)).toEqual(["pagamento", "pagamento"]);
  });

  it("não repete o que outro documento já sugeriu", () => {
    const ja: AcordoSugerido[] = [{ item: "acordo", dados: { valorTotal: 12000 } }];
    expect(sugestoesDosAcordos({ ...leituraAcordosVazia(), acordos: [acordoLido()] }, [], conferidor, ja)).toHaveLength(0);
  });
});
