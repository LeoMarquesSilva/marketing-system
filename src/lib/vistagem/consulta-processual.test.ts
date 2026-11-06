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
    expect(consultaProcessual("TRT1", "0100711-82.2024.5.01.0401")?.url).toBe(
      "https://pje.trt1.jus.br/consultaprocessual/detalhe-processo/0100711-82.2024.5.01.0401"
    );
  });

  it("segue o número quando o diário é de outro TRT (carta precatória) e ignora o sufixo de incidente", () => {
    expect(consultaProcessual("TRT2", "0000254-31.2026.5.17.0141/5000")?.url).toBe(
      "https://pje.trt17.jus.br/consultaprocessual/detalhe-processo/0000254-31.2026.5.17.0141"
    );
  });

  it("no TST usa a consulta pela numeração única, que acha o e-SIJ e redireciona para o PJe do TST", () => {
    // Recurso de 2015 que está no e-SIJ: o PJe do TST só mostra o 1º e o 2º grau dele.
    expect(consultaProcessual("TST", "1000139-05.2015.5.02.0720")).toEqual({
      url: "https://consultaprocessual.tst.jus.br/consultaProcessual/consultaTstNumUnica.do?consulta=Consultar&conscsjt=&numeroTst=1000139&digitoTst=05&anoTst=2015&orgaoTst=5&tribunalTst=02&varaTst=0720&submit=Consultar",
      onde: "na consulta processual do TST",
      preenchida: false,
    });
    expect(consultaProcessual("TST", "0010824-85.2024.5.15.0114")?.url).toBe(
      "https://consultaprocessual.tst.jus.br/consultaProcessual/consultaTstNumUnica.do?consulta=Consultar&conscsjt=&numeroTst=0010824&digitoTst=85&anoTst=2024&orgaoTst=5&tribunalTst=15&varaTst=0114&submit=Consultar"
    );
    // Processo originário do TST (5.00) vai para o TST mesmo vindo de outro diário.
    expect(consultaProcessual("TRT2", "1000123-45.2024.5.00.0000")?.onde).toBe("na consulta processual do TST");
  });

  it("no STJ pesquisa pelo número único (o CNJ da origem) com os 20 dígitos", () => {
    expect(consultaProcessual("STJ", "2230299-05.2024.8.26.0000")).toEqual({
      url: "https://processo.stj.jus.br/processo/pesquisa/?tipoPesquisa=tipoPesquisaNumeroUnico&termo=22302990520248260000&totalRegistrosPorPagina=40&aplicacao=processos.ea",
      onde: "na pesquisa processual do STJ",
      preenchida: false,
    });
    // Número do próprio STJ (J = 3), mesmo sem a sigla.
    expect(consultaProcessual(null, "0204536-69.2009.3.00.0000")?.url).toContain("termo=02045366920093000000");
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

  it("no TJAL abre o 1º grau (cpopg) e o 2º grau (cposg5); no TJMS só o 1º grau", () => {
    expect(consultaProcessual("TJAL", "0734574-42.2021.8.02.0001")?.url).toBe(
      "https://www2.tjal.jus.br/cpopg/search.do?conversationId=&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=0734574-42.2021&foroNumeroUnificado=0001&dadosConsulta.valorConsultaNuUnificado=0734574-42.2021.8.02.0001&dadosConsulta.valorConsultaNuUnificado=UNIFICADO&dadosConsulta.valorConsulta=&dadosConsulta.tipoNuProcesso=UNIFICADO"
    );
    expect(consultaProcessual("TJAL", "0814579-15.2025.8.02.0000")?.url).toBe(
      "https://www2.tjal.jus.br/cposg5/search.do?conversationId=&paginaConsulta=0&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=0814579-15.2025&foroNumeroUnificado=0000&dePesquisaNuUnificado=0814579-15.2025.8.02.0000&dePesquisaNuUnificado=UNIFICADO&dePesquisa=&tipoNuProcesso=UNIFICADO"
    );
    expect(consultaProcessual("TJMS", "0801300-80.2026.8.12.0021")).toMatchObject({
      url: expect.stringMatching(/^https:\/\/esaj\.tjms\.jus\.br\/cpopg5\/search\.do\?/),
      preenchida: true,
    });
    expect(consultaProcessual("TJMS", "1400001-10.2026.8.12.0000")).toBeNull();
  });

  it("consulta só por formulário: abre a página do tribunal e copia o número para colar", () => {
    // Números reais que chegaram na vistagem.
    expect(consultaProcessual("TRF3", "5000136-96.2024.4.03.6127")).toEqual({
      url: "https://pje1g.trf3.jus.br/pje/ConsultaPublica/listView.seam",
      onde: "na consulta pública do PJe do TRF3 (1º grau)",
      preenchida: false,
      copiar: "5000136-96.2024.4.03.6127",
    });
    expect(consultaProcessual("TRF3", "5006327-52.2025.4.03.0000")?.url).toBe("https://pje2g.trf3.jus.br/pje/ConsultaPublica/listView.seam");
    expect(consultaProcessual("TJBA", "8139252-58.2023.8.05.0001")).toMatchObject({
      url: "https://consultapublicapje.tjba.jus.br/pje/ConsultaPublica/listView.seam",
      copiar: "8139252-58.2023.8.05.0001",
    });
    expect(consultaProcessual("TJBA", "8000001-10.2025.8.05.0000")?.url).toBe("https://pje2g.tjba.jus.br/pje/ConsultaPublica/listView.seam");
    expect(consultaProcessual("TJCE", "3011069-62.2025.8.06.0000")).toMatchObject({
      url: "https://pje-consulta.tjce.jus.br/pje2grau/ConsultaPublica/listView.seam",
      copiar: "3011069-62.2025.8.06.0000",
    });
    expect(consultaProcessual("TJCE", "0200001-10.2024.8.06.0001")?.url).toBe("https://pje-consulta.tjce.jus.br/pje1grau/ConsultaPublica/listView.seam");
    expect(consultaProcessual("TJES", "0021350-12.2019.8.08.0024")).toMatchObject({
      url: "https://portaldeservicos.pdpj.jus.br/consulta",
      onde: "na consulta do JUS.BR (TJES; pede login)",
      copiar: "0021350-12.2019.8.08.0024",
    });
  });

  it("no TJGO copia o número e o dígito, sem os zeros da frente (como a busca do PROJUDI pede)", () => {
    expect(consultaProcessual("TJGO", "5759700-75.2022.8.09.0034")).toMatchObject({
      url: "https://projudi.tjgo.jus.br/BuscaProcesso",
      copiar: "5759700-75",
    });
    expect(consultaProcessual("TJGO", "0148032-91.2009.8.09.0002")?.copiar).toBe("148032-91");
  });

  it("os links que abrem direto não pedem para copiar", () => {
    expect(consultaProcessual("TRT15", "0010743-04.2022.5.15.0116")?.copiar).toBeUndefined();
    expect(consultaProcessual("TJSP", "1001689-76.2018.8.26.0634")?.copiar).toBeUndefined();
  });

  it("sem endereço conhecido ou sem CNJ fica sem link", () => {
    expect(consultaProcessual("TJMG", "5018595-38.2023.8.13.0027")).toBeNull();
    expect(consultaProcessual("TRF1", "1000123-45.2024.4.01.3400")).toBeNull();
    expect(consultaProcessual("STF", "0001234-56.2024.1.00.0000")).toBeNull();
    expect(consultaProcessual("TRT2", "0001234-56.2024.5.25.0001")).toBeNull();
    expect(consultaProcessual("TJSP", "123456")).toBeNull();
    expect(consultaProcessual("TRT2", null)).toBeNull();
  });
});
