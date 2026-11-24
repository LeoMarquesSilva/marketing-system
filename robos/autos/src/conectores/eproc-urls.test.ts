import { describe, expect, it } from "vitest";
import { lerCnj } from "./esaj-urls";
import {
  perfilDoEproc,
  arquivoEmbutido,
  chaveDaPeca,
  ehAreaLogada,
  ehCapaDoProcesso,
  ehLoginSso,
  emSegredoPelaCapa,
  instanciasDoCnj,
  mensagemDaPesquisa,
  ordenarDocumentos,
  pecasNovas,
  tipoDoArquivo,
  tribunalEproc,
  tribunalEprocDoCnj,
} from "./eproc-urls";

const bytes = (texto: string) => new Uint8Array([...texto].map((letra) => letra.charCodeAt(0)));

describe("instâncias do eproc do TJSP", () => {
  it("começa pelo 1º grau cível e, com origem 0000, pelo 2º grau", () => {
    expect(instanciasDoCnj(lerCnj("1012345-67.2025.8.26.0100")!)[0].base).toBe("https://eproc1g.tjsp.jus.br/eproc");
    const recurso = instanciasDoCnj(lerCnj("2001234-56.2025.8.26.0000")!);
    expect(recurso[0].base).toBe("https://eproc2g.tjsp.jus.br/eproc");
    expect(recurso).toHaveLength(3);
  });
});

// Números fictícios (dígito verificador inválido de propósito).
describe("eproc do TJRJ", () => {
  const tjrj = tribunalEproc("TJRJ");

  it("acha o tribunal do eproc pelo J.TR", () => {
    expect(tribunalEprocDoCnj("0012345-67.2019.8.19.0001")?.sigla).toBe("TJRJ");
    expect(tribunalEprocDoCnj("1012345-67.2025.8.26.0100")?.sigla).toBe("TJSP");
    expect(tribunalEprocDoCnj("0001234-56.2020.8.06.0001")).toBeNull();
    expect(tribunalEprocDoCnj("0001234-56.2020.5.01.0001")).toBeNull();
    expect(tribunalEprocDoCnj("123")).toBeNull();
  });

  it("procura no 1º grau e, com origem 0000, começa pelo 2º grau", () => {
    expect(instanciasDoCnj(lerCnj("0801234-56.2024.8.19.0001")!, tjrj.instancias).map((item) => item.base)).toEqual(["https://eproc1g.tjrj.jus.br/eproc", "https://eproc2g.tjrj.jus.br/eproc"]);
    expect(instanciasDoCnj(lerCnj("0001234-56.2025.8.19.0000")!, tjrj.instancias)[0].base).toBe("https://eproc2g.tjrj.jus.br/eproc");
  });

  it("reconhece o login do SSO do TJRJ, e não o de outro tribunal nem a passagem pela PDPJ", () => {
    expect(ehLoginSso("https://eproc-sso.tjrj.jus.br/realms/eproc/protocol/openid-connect/auth?x=1", tjrj)).toBe(true);
    expect(ehLoginSso("https://sso.cloud.pje.jus.br/auth/realms/pje/broker/eproc-tjrj/endpoint", tjrj)).toBe(false);
    expect(ehLoginSso("https://sso.tjsp.jus.br/realms/eproc/protocol/openid-connect/auth", tjrj)).toBe(false);
    expect(ehLoginSso("https://eproc-sso.tjrj.jus.br/realms/eproc/protocol/openid-connect/auth")).toBe(false);
    expect(ehAreaLogada("https://eproc1g.tjrj.jus.br/eproc/controlador.php?acao=principal&hash=1")).toBe(true);
  });

  it("tem fonte própria do código de 2 fatores", () => {
    expect(tjrj.sistema2fa).toBe("eproc-tjrj");
    expect(tribunalEproc("TJSP").sistema2fa).toBe("eproc");
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

describe("download incremental", () => {
  const doc = (evento: number, nome: string) => ({ evento, ordem: 0, nome, data: "", url: `https://eproc1g.tjsp.jus.br/doc?${evento}${nome}` });
  it("identifica a peça pelo evento e pelo nome", () => {
    expect(chaveDaPeca(doc(12, " pet1 "))).toBe("12:PET1");
  });
  it("traz só as peças que ainda não vieram", () => {
    const documentos = [doc(1, "INIC1"), doc(5, "DEC1"), doc(9, "PET1")];
    expect(pecasNovas(documentos, ["1:INIC1", "5:DEC1"]).map(chaveDaPeca)).toEqual(["9:PET1"]);
    expect(pecasNovas(documentos, undefined)).toHaveLength(3);
    expect(pecasNovas(documentos, ["1:INIC1", "5:DEC1", "9:PET1"])).toEqual([]);
  });
});

describe("aviso da pesquisa", () => {
  it("ignora a faixa de usuário logado", () => {
    expect(mensagemDaPesquisa(["Usuário logado como FULANO/ . Utilize o botão \"Sair do Sistema\" caso queira efetuar novo login.", "Processo não encontrado."])).toBe("Processo não encontrado.");
    expect(mensagemDaPesquisa(["Usuário logado como FULANO. Sair do Sistema"])).toBeNull();
  });
});

describe("seleção de perfil do eproc", () => {
  // Siglas e descrições fictícias, no formato da tela.
  it("escolhe o perfil SP de advogado, mesmo fora da primeira linha", () => {
    expect(perfilDoEproc(["ES000001\tADVOGADO", "SP000002\tADVOGADO"])).toBe(1);
    expect(perfilDoEproc(["SP000002\tADVOGADO", "ES000001\tADVOGADO"])).toBe(0);
  });
  it("sem SP, o primeiro perfil de advogado; sem linhas, nenhum", () => {
    expect(perfilDoEproc(["ES000001\tADVOGADO", "MG000003\tADVOGADO"])).toBe(0);
    expect(perfilDoEproc(["ES000001\tADVOGADO"], "RJ")).toBe(0);
    expect(perfilDoEproc([])).toBe(-1);
  });
  it("respeita outro prefixo configurado", () => {
    expect(perfilDoEproc(["SP000002\tADVOGADO", "ES000001\tADVOGADO"], "ES")).toBe(1);
  });
});
