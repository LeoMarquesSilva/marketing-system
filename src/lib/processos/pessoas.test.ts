import { describe, expect, it } from "vitest";
import { agruparDuplicadas, chaveDoContato, chaveDoEndereco, chaveNome, escolherPessoaVios, lerPessoaVios, tipoPeloDocumento, type PessoaVios } from "./pessoas";

function vios(dados: Partial<PessoaVios>): PessoaVios {
  return { sioeId: null, ci: "1", nome: "Fulano", documento: null, tipo: null, nomeFantasia: null, categoria: null, grupoCliente: null, etiquetas: [], endereco: null, contatos: [], ...dados };
}

describe("chaves de comparação", () => {
  it("ignora acento, caixa e pontuação no nome", () => {
    expect(chaveNome("Loja Beta Ltda.")).toBe(chaveNome("LOJA  BETA LTDA"));
    expect(chaveNome("João D'Ávila & Cia - ME")).toBe("joao d avila cia me");
  });

  it("deduz o tipo pelo documento", () => {
    expect(tipoPeloDocumento("123.456.789-09")).toBe("fisica");
    expect(tipoPeloDocumento("12.345.678/0001-90")).toBe("juridica");
    expect(tipoPeloDocumento("123")).toBeNull();
  });

  it("reconhece o mesmo telefone e o mesmo e-mail", () => {
    expect(chaveDoContato({ tipo: "celular", valor: "(11) 98888-7777" })).toBe(chaveDoContato({ tipo: "telefone", valor: "5511988887777" }));
    expect(chaveDoContato({ tipo: "email", valor: " Fulano@Empresa.com " })).toBe(chaveDoContato({ tipo: "email", valor: "fulano@empresa.com" }));
    expect(chaveDoEndereco({ endereco: "Rua A, 10 - Centro", cep: "01000-000" })).toBe(chaveDoEndereco({ endereco: "RUA A 10 CENTRO", cep: "01000000" }));
  });
});

describe("lerPessoaVios", () => {
  it("lê a linha do SIOE com endereço e contatos sem repetir", () => {
    const pessoa = lerPessoaVios({
      ci: "4321",
      nome: " Loja Beta Ltda ",
      cpf_cnpj: "12.345.678/0001-90",
      tipo: "PESSOA JURÃ\u008dDICA",
      categoria: "Contrário ativo",
      grupo_cliente: null,
      etiquetas: "Carteira X | Crítico",
      logradouro: "Rua A",
      nro: "10",
      bairro: "Centro",
      cidade: "São Paulo",
      uf: "sp",
      cep: "01000-000",
      telefone: "11988887777",
      telefone_vios: "(11) 98888-7777",
      email: "contato@beta.com",
      email_vios: "CONTATO@beta.com",
    });
    expect(pessoa).toMatchObject({ ci: "4321", nome: "Loja Beta Ltda", tipo: "juridica", categoria: "Contrário ativo", etiquetas: ["Carteira X", "Crítico"] });
    expect(pessoa?.endereco).toMatchObject({ endereco: "Rua A, 10, Centro", cidade: "São Paulo", uf: "SP", origem: "vios" });
    expect(pessoa?.contatos.map((contato) => contato.tipo)).toEqual(["celular", "email"]);
  });

  it("sem tipo no VIOS, usa o documento; sem nome ou CI, descarta", () => {
    expect(lerPessoaVios({ ci: 9, nome: "Fulano", cpf_cnpj: "123.456.789-09", tipo: "OUTROS" })?.tipo).toBe("fisica");
    expect(lerPessoaVios({ ci: 9, nome: "Fulano", tipo: "OUTROS" })?.tipo).toBeNull();
    expect(lerPessoaVios({ ci: null, nome: "Fulano" })).toBeNull();
    expect(lerPessoaVios({ ci: 9, nome: " " })).toBeNull();
  });
});

describe("escolherPessoaVios", () => {
  const cnpj = "12.345.678/0001-90";
  const cpf = "123.456.789-09";

  it("uma candidata é ela; nenhuma é nenhuma", () => {
    expect(escolherPessoaVios([vios({ ci: "7" })])).toMatchObject({ situacao: "achada", pessoa: { ci: "7" } });
    expect(escolherPessoaVios([])).toEqual({ situacao: "nenhuma" });
  });

  it("empresa repetida no cadastro (uma com CNPJ, outra sem) é a mesma", () => {
    const escolha = escolherPessoaVios([vios({ ci: "1" }), vios({ ci: "2", documento: cnpj })]);
    expect(escolha).toMatchObject({ situacao: "achada", pessoa: { ci: "2" } });
  });

  it("pessoa física repetida, uma com CPF e outra sem, fica como homônimo", () => {
    expect(escolherPessoaVios([vios({ ci: "1" }), vios({ ci: "2", documento: cpf })])).toEqual({ situacao: "homonimos", quantas: 2 });
  });

  it("documentos diferentes ou nenhuma com documento: homônimos", () => {
    expect(escolherPessoaVios([vios({ ci: "1", documento: cpf }), vios({ ci: "2", documento: "987.654.321-00" })]).situacao).toBe("homonimos");
    expect(escolherPessoaVios([vios({ ci: "1" }), vios({ ci: "2" })]).situacao).toBe("homonimos");
  });

  it("todas com o mesmo CPF: é a mesma pessoa", () => {
    expect(escolherPessoaVios([vios({ ci: "1", documento: cpf }), vios({ ci: "2", documento: "12345678909" })])).toMatchObject({ situacao: "achada", pessoa: { ci: "1" } });
  });

  it("com o documento em mãos, vale o documento", () => {
    const candidatas = [vios({ ci: "1", documento: cpf }), vios({ ci: "2", documento: "987.654.321-00" })];
    expect(escolherPessoaVios(candidatas, "98765432100")).toMatchObject({ situacao: "achada", pessoa: { ci: "2" } });
    expect(escolherPessoaVios(candidatas, "111.111.111-11")).toEqual({ situacao: "nenhuma" });
    expect(escolherPessoaVios([vios({ ci: "3" })], cpf)).toMatchObject({ situacao: "achada", pessoa: { ci: "3" } });
  });
});

describe("agruparDuplicadas", () => {
  const p = (id: string, nome: string, documento: string | null = null, viosCi: string | null = null) => ({ id, nomeChave: chaveNome(nome), documento, viosCi });

  it("junta por documento e, sem documento conflitante, por nome", () => {
    const grupos = agruparDuplicadas([
      p("a", "Loja Beta", "12.345.678/0001-90"),
      p("b", "Loja Beta Comércio", "12345678000190"),
      p("c", "João Silva"),
      p("d", "JOAO SILVA", "123.456.789-09"),
      p("e", "Única"),
    ]);
    expect(grupos).toHaveLength(2);
    expect(grupos[0]).toMatchObject({ motivo: "documento" });
    expect(grupos[0].pessoas.map((item) => item.id)).toEqual(["a", "b"]);
    expect(grupos[1]).toMatchObject({ motivo: "nome" });
    expect(grupos[1].pessoas.map((item) => item.id)).toEqual(["c", "d"]);
  });

  it("homônimos com documentos ou CIs diferentes não são duplicata", () => {
    expect(agruparDuplicadas([p("a", "João Silva", "123.456.789-09"), p("b", "João Silva", "987.654.321-00")])).toEqual([]);
    expect(agruparDuplicadas([p("a", "João Silva", null, "10"), p("b", "João Silva", null, "20")])).toEqual([]);
  });
});
