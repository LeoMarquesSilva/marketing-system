import { describe, expect, it } from "vitest";
import { consultaProcessual } from "./consulta-processual";

describe("consultaProcessual", () => {
  it("abre o PJe do TRT do próprio número", () => {
    expect(consultaProcessual("TRT15", "0010743-04.2022.5.15.0116")).toEqual({
      url: "https://pje.trt15.jus.br/consultaprocessual/detalhe-processo/0010743-04.2022.5.15.0116",
      onde: "no PJe do TRT15",
      preenchida: false,
    });
    expect(consultaProcessual("TRT2", "10011609820235020602")?.url).toBe(
      "https://pje.trt2.jus.br/consultaprocessual/detalhe-processo/1001160-98.2023.5.02.0602"
    );
  });

  it("segue o número quando o diário é de outro TRT (carta precatória) e ignora o sufixo de incidente", () => {
    expect(consultaProcessual("TRT2", "0000254-31.2026.5.17.0141/5000")?.url).toBe(
      "https://pje.trt17.jus.br/consultaprocessual/detalhe-processo/0000254-31.2026.5.17.0141"
    );
  });

  it("no TST usa o PJe do TST com o número da origem", () => {
    expect(consultaProcessual("TST", "0012321-67.2024.5.15.0007")).toMatchObject({
      url: "https://pje.tst.jus.br/consultaprocessual/detalhe-processo/0012321-67.2024.5.15.0007",
      onde: "no PJe do TST",
    });
  });

  it("no STJ pesquisa pelo número único da origem", () => {
    expect(consultaProcessual("STJ", "2230299-05.2024.8.26.0000")?.url).toBe(
      "https://processo.stj.jus.br/processo/pesquisa/?tipoPesquisa=tipoPesquisaNumeroUnico&termo=2230299-05.2024.8.26.0000&totalRegistrosPorPagina=40&aplicacao=processos.ea"
    );
  });

  it("no TJSP abre o e-SAJ de 1º grau, o de 2º grau (origem 0000) e a consulta unificada do eproc", () => {
    expect(consultaProcessual("TJSP", "1001689-76.2018.8.26.0634")?.url).toBe(
      "https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=1001689-76.2018&foroNumeroUnificado=0634&dadosConsulta.valorConsultaNuUnificado=1001689-76.2018.8.26.0634&dadosConsulta.valorConsultaNuUnificado=UNIFICADO&dadosConsulta.valorConsulta=&dadosConsulta.tipoNuProcesso=UNIFICADO"
    );
    expect(consultaProcessual("TJSP", "2139342-84.2026.8.26.0000")?.url).toBe(
      "https://esaj.tjsp.jus.br/cposg/search.do?conversationId=&paginaConsulta=0&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=2139342-84.2026&foroNumeroUnificado=0000&dePesquisaNuUnificado=2139342-84.2026.8.26.0000&dePesquisaNuUnificado=UNIFICADO&dePesquisa=&tipoNuProcesso=UNIFICADO"
    );
    expect(consultaProcessual("TJSP", "4062498-59.2026.8.26.0000")).toEqual({
      url: "https://eproc-consulta.tjsp.jus.br/consulta_1g/externo_controlador.php?acao=tjsp@consulta_unificada_publica/consultar&num_processo=4062498-59.2026.8.26.0000",
      onde: "na consulta unificada do TJSP (eproc e e-SAJ)",
      preenchida: true,
    });
  });

  it("no TJAL e no TJMS só o 1º grau do e-SAJ", () => {
    expect(consultaProcessual("TJAL", "0734574-42.2021.8.02.0001")?.url).toMatch(/^https:\/\/www2\.tjal\.jus\.br\/cpopg\/search\.do\?/);
    expect(consultaProcessual("TJMS", "0801300-80.2026.8.12.0021")?.url).toMatch(/^https:\/\/esaj\.tjms\.jus\.br\/cpopg5\/search\.do\?/);
    expect(consultaProcessual("TJAL", "0800001-10.2026.8.02.0000")).toBeNull();
  });

  it("sem endereço conhecido ou sem CNJ fica sem link", () => {
    expect(consultaProcessual("TJMG", "5018595-38.2023.8.13.0027")).toBeNull();
    expect(consultaProcessual("TRF3", "5006327-52.2025.4.03.6183")).toBeNull();
    expect(consultaProcessual("TJSP", "123456")).toBeNull();
    expect(consultaProcessual("TRT2", null)).toBeNull();
  });
});
