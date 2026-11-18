import { describe, expect, it } from "vitest";
import { ehAcaoFinalDeDownload, ehControleDeDownload, lerPedidoDeMapa, nomeDaEtapa, urlSemSegredos } from "./mapeamento-urls";

describe("endereços no mapa", () => {
  it("tira os valores de sessão, login e acesso", () => {
    expect(urlSemSegredos("https://sso.cloud.pje.jus.br/auth?client_id=pje-tjrj-1g&state=abc&session_code=def&tab_id=g")).toBe(
      "https://sso.cloud.pje.jus.br/auth?client_id=pje-tjrj-1g&state=…&session_code=…&tab_id=…"
    );
    expect(urlSemSegredos("https://tjrj.pje.jus.br/1g/listAutosDigitais.seam?idProcesso=1&ca=segredo")).toBe("https://tjrj.pje.jus.br/1g/listAutosDigitais.seam?idProcesso=1&ca=…");
    expect(urlSemSegredos("https://tjrj.pje.jus.br/1g/login.seam;jsessionid=XYZ?code=1")).toBe("https://tjrj.pje.jus.br/1g/login.seam;jsessionid=…?code=…");
    expect(urlSemSegredos("https://www3.tjrj.jus.br/portalservicos/#/consultas")).toBe("https://www3.tjrj.jus.br/portalservicos/#/consultas");
  });
});

describe("controles de download", () => {
  it("reconhece o que leva ao download", () => {
    expect(ehControleDeDownload("Baixar o Processo Atual em PDF")).toBe(true);
    expect(ehControleDeDownload("Download autos do processo")).toBe(true);
    expect(ehControleDeDownload("Salvar Cópia do Documento em Exibição")).toBe(true);
    expect(ehControleDeDownload("Pesquisar")).toBe(false);
  });

  it("separa o que conclui o download, que o mapear nunca clica", () => {
    expect(ehAcaoFinalDeDownload("Salvar processo completo")).toBe(true);
    expect(ehAcaoFinalDeDownload(" Download ")).toBe(true);
    expect(ehAcaoFinalDeDownload("Salvar documentos selecionados")).toBe(true);
    expect(ehAcaoFinalDeDownload("Baixar o Processo Atual em PDF")).toBe(false);
    expect(ehAcaoFinalDeDownload("Download autos do processo")).toBe(false);
  });
});

describe("linha de comando", () => {
  it("lê sistema, número e grau", () => {
    expect(lerPedidoDeMapa(["--mapear", "dcp", "0012345-67.2019.8.19.0001"])).toEqual({ sistema: "dcp", cnj: "0012345-67.2019.8.19.0001", grau: "1g" });
    expect(lerPedidoDeMapa(["--mapear", "PJe", "0001234-56.2025.8.19.0000", "2g"])).toEqual({ sistema: "pje", cnj: "0001234-56.2025.8.19.0000", grau: "2g" });
  });

  it("explica o que falta", () => {
    expect(lerPedidoDeMapa(["--mapear", "0012345-67.2019.8.19.0001"])).toMatch(/dcp ou pje/);
    expect(lerPedidoDeMapa(["--mapear", "dcp", "123"])).toMatch(/20 dígitos/);
  });

  it("dá nome de arquivo à etapa", () => {
    expect(nomeDaEtapa("pje-1g", 3, "Opções de download")).toBe("mapa-pje-1g-03-opcoes-de-download");
  });
});
