import { describe, expect, it } from "vitest";
import { lerCnj } from "./esaj-urls";
import { arquivoEmbutido, ehAreaLogada, ehCapaDoProcesso, ehLoginSso, emSegredoPelaCapa, instanciasDoCnj, ordenarDocumentos, tipoDoArquivo } from "./eproc-urls";

const bytes = (texto: string) => new Uint8Array([...texto].map((letra) => letra.charCodeAt(0)));

describe("instâncias do eproc do TJSP", () => {
  it("começa pelo 1º grau cível e, com origem 0000, pelo 2º grau", () => {
    expect(instanciasDoCnj(lerCnj("1012345-67.2025.8.26.0100")!)[0].base).toBe("https://eproc1g.tjsp.jus.br/eproc");
    const recurso = instanciasDoCnj(lerCnj("2001234-56.2025.8.26.0000")!);
    expect(recurso[0].base).toBe("https://eproc2g.tjsp.jus.br/eproc");
    expect(recurso).toHaveLength(3);
  });
});

describe("telas do eproc", () => {
  it("separa o login do SSO, a área pública e a área logada", () => {
    expect(ehLoginSso("https://sso.tjsp.jus.br/realms/eproc/protocol/openid-connect/auth?x=1")).toBe(true);
    expect(ehLoginSso("https://certificado-sso.tjsp.jus.br/realms/eproc/login-actions/authenticate")).toBe(true);
    expect(ehLoginSso("https://eproc1g.tjsp.jus.br/eproc/controlador.php?acao=principal")).toBe(false);
    expect(ehAreaLogada("https://eproc1g.tjsp.jus.br/eproc/controlador.php?acao=painel_adv_listar&hash=1")).toBe(true);
    expect(ehAreaLogada("https://eproc1g.tjsp.jus.br/eproc/externo_controlador.php?acao=principal")).toBe(false);
  });

  it("reconhece a capa do processo pedido, com ou sem máscara", () => {
    const cnj = lerCnj("1012345-67.2025.8.26.0100")!;
    const url = "https://eproc1g.tjsp.jus.br/eproc/controlador.php?acao=processo_selecionar&num_processo=10123456720258260100&hash=1";
    expect(ehCapaDoProcesso(url, "Capa do processo Nº 1012345-67.2025.8.26.0100", cnj)).toBe(true);
    expect(ehCapaDoProcesso(url, "Nº 10123456720258260100", cnj)).toBe(true);
    expect(ehCapaDoProcesso(url, "Nº 1099999-67.2025.8.26.0100", cnj)).toBe(false);
    expect(ehCapaDoProcesso("https://eproc1g.tjsp.jus.br/eproc/controlador.php?acao=principal", "1012345-67.2025.8.26.0100", cnj)).toBe(false);
  });
});

describe("sigilo pela capa", () => {
  it("lê o nível de sigilo", () => {
    expect(emSegredoPelaCapa("Nível de Sigilo do Processo: Sem Sigilo (Nível 0)")).toBe(false);
    expect(emSegredoPelaCapa("Nível de Sigilo do Processo: Segredo de Justiça (Nível 1)")).toBe(true);
    expect(emSegredoPelaCapa("Sigilo: Sigiloso (Nível 3)")).toBe(true);
  });

  it("sem nível, decide pelo texto", () => {
    expect(emSegredoPelaCapa("Classe: Procedimento Comum Cível. Sem sigilo.")).toBe(false);
    expect(emSegredoPelaCapa("Processo em segredo de justiça")).toBe(true);
    expect(emSegredoPelaCapa("Classe: Procedimento Comum Cível")).toBe(false);
  });
});

describe("documentos", () => {
  it("põe em ordem do evento mais antigo e tira repetidos", () => {
    const doc = (evento: number, ordem: number, url: string) => ({ evento, ordem, nome: `DOC${ordem}`, data: "", url });
    const ordem = ordenarDocumentos([doc(33, 1, "u?doc=9&hash=a"), doc(1, 2, "u?doc=2&hash=b"), doc(1, 1, "u?doc=1&hash=c"), doc(40, 1, "u?doc=1&hash=d")]);
    expect(ordem.map((item) => `${item.evento}.${item.ordem}`)).toEqual(["1.1", "1.2", "33.1"]);
  });

  it("reconhece o tipo do arquivo", () => {
    expect(tipoDoArquivo("application/octet-stream", bytes("%PDF-1.7"))).toBe("pdf");
    expect(tipoDoArquivo("", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("imagem-png");
    expect(tipoDoArquivo("", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("imagem-jpg");
    expect(tipoDoArquivo("text/html; charset=iso-8859-1", bytes("<!DOCTYP"))).toBe("html");
    expect(tipoDoArquivo("audio/mpeg", bytes("ID3abcde"))).toBe("outro");
  });

  it("acha o arquivo embutido na página do documento", () => {
    const base = "https://eproc1g.tjsp.jus.br/eproc/controlador.php?acao=acessar_documento&doc=1";
    expect(arquivoEmbutido('<html><iframe id="x" src="controlador.php?acao=acessar_documento_implementacao&amp;doc=1"></iframe>', base)).toBe(
      "https://eproc1g.tjsp.jus.br/eproc/controlador.php?acao=acessar_documento_implementacao&doc=1"
    );
    expect(arquivoEmbutido('<object data="/eproc/doc.pdf"></object>', base)).toBe("https://eproc1g.tjsp.jus.br/eproc/doc.pdf");
    expect(arquivoEmbutido('<iframe src="about:blank"></iframe>', base)).toBeNull();
    expect(arquivoEmbutido("<p>sem arquivo</p>", base)).toBeNull();
  });
});
