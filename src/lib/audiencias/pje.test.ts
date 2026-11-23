import { describe, expect, it } from "vitest";
import {
  canceladasSemNovaData,
  chaveDoLink,
  diferencas,
  horaLocalParaIso,
  iniciais,
  ligarRedesignacoes,
  modalidadeDaDescricao,
  normalizarRegistroPje,
  tipoDaDescricao,
  type RegistroPjeBruto,
} from "./pje";

// Registros no formato da Minha Pauta do PJe (dados fictícios).
function bruto(p: Partial<RegistroPjeBruto> & { id: number }): RegistroPjeBruto {
  return {
    nrProcesso: "0011111-22.2026.5.15.0001",
    dataInicio: "2026-11-19T10:20:00",
    dataFim: "2026-11-19T10:40:00",
    status: "M",
    statusDescricao: "Designada",
    tipo: { descricao: "Instrução por videoconferência (rito sumaríssimo)" },
    salaAudiencia: { nome: "Sala 1" },
    urlAudienciaVirtual: null,
    processo: { juizoDigital: true, orgaoJulgador: { descricao: "CON1 - Jundiaí" } },
    poloAtivo: { nome: "FULANO DE TAL DA SILVA" },
    poloPassivo: { nome: "EMPRESA EXEMPLO LTDA" },
    ...p,
  };
}

describe("tipo e modalidade pela descrição", () => {
  it("lê os tipos do PJe-JT", () => {
    expect(tipoDaDescricao("Una por videoconferência (rito sumaríssimo)")).toBe("una");
    expect(tipoDaDescricao("Inicial por videoconferência")).toBe("inicial");
    expect(tipoDaDescricao("Instrução (rito sumaríssimo)")).toBe("instrucao");
    expect(tipoDaDescricao("Conciliação em Execução por videoconferência")).toBe("conciliacao");
    expect(tipoDaDescricao("Encerramento de Instrução")).toBe("encerramento");
    expect(tipoDaDescricao("AUDIÊNCIA UNA/INICIAL")).toBe("una");
  });
  it("modalidade sai da descrição, porque isVirtual vem errado", () => {
    expect(modalidadeDaDescricao("Una por videoconferência")).toBe("video");
    expect(modalidadeDaDescricao("Instrução")).toBe("presencial");
    expect(modalidadeDaDescricao("Instrução híbrida")).toBe("hibrida");
  });
});

describe("normalizarRegistroPje", () => {
  it("converte hora local de Brasília para ISO e guarda só as iniciais do reclamante", () => {
    const r = normalizarRegistroPje(bruto({ id: 10, urlAudienciaVirtual: " https://trt15-jus-br.zoom.us/j/123?pwd=abc " }), "TRT15")!;
    expect(r.chave).toBe("pje:TRT15:10");
    expect(r.inicio).toBe("2026-11-19T13:20:00.000Z");
    expect(r.tipo).toBe("instrucao");
    expect(r.modalidade).toBe("video");
    expect(r.ritoSumarissimo).toBe(true);
    expect(r.link).toBe("https://trt15-jus-br.zoom.us/j/123?pwd=abc");
    expect(r.reclamanteIniciais).toBe("F. T. S.");
    expect(r.situacao).toBe("designada");
  });
  it("descarta registro sem número ou sem data", () => {
    expect(normalizarRegistroPje(bruto({ id: 1, nrProcesso: "123" }), "TRT15")).toBeNull();
    expect(normalizarRegistroPje(bruto({ id: 1, dataInicio: null }), "TRT15")).toBeNull();
  });
  it("hora sem fuso vira -03:00", () => {
    expect(horaLocalParaIso("2026-11-19T08:40:00")).toBe("2026-11-19T11:40:00.000Z");
    expect(iniciais("  ")).toBeNull();
  });
});

describe("mudanças no tribunal", () => {
  const n = (p: Partial<RegistroPjeBruto> & { id: number }) => normalizarRegistroPje(bruto(p), "TRT15")!;

  it("link que só apareceu não é mudança; sala nova é", () => {
    const a = n({ id: 1 });
    const b = n({ id: 2, urlAudienciaVirtual: "https://x.zoom.us/j/1" });
    const c = n({ id: 3, urlAudienciaVirtual: "https://x.zoom.us/j/2?pwd=z" });
    expect(diferencas(a, b)).toEqual([]);
    expect(diferencas(b, c)).toEqual(["link"]);
    expect(chaveDoLink("https://x.zoom.us/j/2?pwd=z")).toBe("x.zoom.us/j/2");
  });

  it("UNA cancelada e instrução designada no mesmo horário: tipo mudou", () => {
    const registros = [
      n({ id: 100, status: "C", statusDescricao: "Cancelada", tipo: { descricao: "Una por videoconferência (rito sumaríssimo)" } }),
      n({ id: 101 }),
    ];
    const [r] = ligarRedesignacoes(registros);
    expect(r).toMatchObject({ chave: "pje:TRT15:101", substitui: ["pje:TRT15:100"], mudancas: ["tipo"] });
  });

  it("horário e vara diferentes; o link antigo fica guardado", () => {
    const registros = [
      n({ id: 5, status: "C", statusDescricao: "Cancelada", dataInicio: "2026-11-25T10:15:00", urlAudienciaVirtual: "https://x.zoom.us/j/8839" }),
      n({ id: 6, status: "C", statusDescricao: "Cancelada", processo: { orgaoJulgador: { descricao: "CON1 - Campinas" } } }),
      n({ id: 7, dataInicio: "2026-11-25T10:40:00", urlAudienciaVirtual: "https://x.zoom.us/j/8830" }),
    ];
    const [r] = ligarRedesignacoes(registros);
    expect(r!.mudancas.sort()).toEqual(["horario", "link", "vara"]);
    expect(r!.linkAnterior).toBe("https://x.zoom.us/j/8839");
  });

  it("cancelado mais novo que o designado não conta; cancelamento puro é listado", () => {
    const outro = "0022222-33.2026.5.15.0002";
    const registros = [
      n({ id: 50 }),
      n({ id: 60, status: "C", statusDescricao: "Cancelada", dataInicio: "2026-11-20T09:00:00" }),
      n({ id: 70, nrProcesso: outro, status: "C", statusDescricao: "Cancelada" }),
    ];
    expect(ligarRedesignacoes(registros)).toEqual([]);
    expect(canceladasSemNovaData(registros).map((r) => r.cnj)).toEqual([outro]);
  });
});
