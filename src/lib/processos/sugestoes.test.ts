import { describe, expect, it } from "vitest";
import type { PessoaSugerida } from "./autos-types";
import {
  aplicarNaParte,
  criarConferidor,
  devedoresDoProcesso,
  dividirEmBlocos,
  documentoValido,
  entradaDaLeitura,
  entradaDaPessoa,
  leituraVazia,
  montarSugestoes,
  normalizarContato,
  normalizarNome,
  normalizarOab,
  type LeituraDosAutos,
} from "./sugestoes";
import type { Parte } from "./types";

function parte(dados: Partial<Parte> & Pick<Parte, "id" | "nome">): Parte {
  return { polo: "passivo", papel: "parte", vinculo: null, devedor: false, referenteA: null, origem: "vios", pessoaId: `p-${dados.id}`, documento: null, oab: null, observacao: null, enderecos: [], contatos: [], ...dados };
}

const CREDOR = parte({ id: "credor", nome: "CREDORA ELÉTRICA LTDA.", polo: "ativo" });
const DEVEDOR = parte({ id: "devedor", nome: "Auto Peças Brasil Ltda", devedor: true });
const ADV_CREDOR = parte({ id: "adv-credor", nome: "Maria Advogada", polo: "ativo", papel: "advogado", referenteA: "credor" });

const PAGINAS = [
  "EXECUÇÃO DE TÍTULO EXTRAJUDICIAL\nExequente: CREDORA ELETRICA LTDA, CNPJ 11.222.333/0001-81\nExecutado: AUTO PECAS BRASIL LTDA, inscrita no CNPJ sob o n. 11.444.777/0001-61, com sede na Rua das Flores, 100, Centro, Campinas/SP, CEP 13010-000.",
  "O débito decorre das duplicatas vencidas em 10/02/2023, no valor original de R$ 45.300,00.\nO sócio administrador JOÃO DA SILVA, CPF 529.982.247-25, residente na Av. Paulista, 1000, São Paulo/SP, assinou como avalista. Telefone (11) 98765-4321, e-mail joao@autopecas.com.br.",
  "",
  "CERTIDÃO. Certifico que, em 15/03/2024, citei o executado AUTO PECAS BRASIL LTDA na pessoa de seu representante.\nPelo executado, Dr. Carlos Pereira, OAB/SP 123.456.",
];

function leitura(dados: Partial<LeituraDosAutos>): LeituraDosAutos {
  return { ...leituraVazia(), ...dados };
}

const contexto = (valores: Record<string, unknown> = {}, partes: Parte[] = [CREDOR, DEVEDOR, ADV_CREDOR]) => ({
  valores: { polo_cliente: "Ativo", cliente: "Credora Elétrica", cnj: "1012345-67.2023.8.26.0100", ...valores } as never,
  partes,
});

describe("dividirEmBlocos", () => {
  it("marca cada página, pula as sem texto e respeita o limite", () => {
    const paginas = ["a".repeat(100), "", "b".repeat(100), "c".repeat(100)];
    const blocos = dividirEmBlocos(paginas, 260);
    expect(blocos.map((bloco) => [bloco.inicio, bloco.fim, bloco.paginas])).toEqual([
      [1, 3, 2],
      [4, 4, 1],
    ]);
    expect(blocos[0].texto).toContain("[[PÁGINA 1]]");
    expect(blocos[0].texto).toContain("[[PÁGINA 3]]");
    expect(blocos[0].texto).not.toContain("[[PÁGINA 2]]");
  });

  it("não devolve bloco quando o PDF é só imagem", () => {
    expect(dividirEmBlocos(["", "  ", "carimbo"])).toEqual([]);
  });
});

describe("criarConferidor", () => {
  const conferidor = criarConferidor(PAGINAS);

  it("acha o trecho apesar de acento, caixa e quebra de linha", () => {
    expect(conferidor.trecho(4, "certifico que, em 15/03/2024, CITEI o executado")).toEqual({ pagina: 4, conferido: true });
  });

  it("corrige a página quando o modelo errou por pouco", () => {
    expect(conferidor.trecho(1, "duplicatas vencidas em 10/02/2023")).toEqual({ pagina: 2, conferido: true });
  });

  it("não confere trecho que não está no PDF nem trecho curto demais", () => {
    expect(conferidor.trecho(2, "o devedor confessou a dívida de R$ 99.999,00")).toEqual({ pagina: 2, conferido: false });
    expect(conferidor.trecho(2, "R$")).toEqual({ pagina: 2, conferido: false });
    expect(conferidor.trecho(99, "texto que não existe em lugar nenhum")).toEqual({ pagina: null, conferido: false });
  });

  it("confere se o valor está na página", () => {
    expect(conferidor.contem(2, "529.982.247-25")).toBe(true);
    expect(conferidor.contem(1, "529.982.247-25")).toBe(false);
  });
});

describe("documentos, OAB e contatos", () => {
  it("valida CPF e CNPJ pelos dígitos verificadores", () => {
    expect(documentoValido("52998224725")).toBe("529.982.247-25");
    expect(documentoValido("529.982.247-26")).toBeNull();
    expect(documentoValido("11222333000181")).toBe("11.222.333/0001-81");
    expect(documentoValido("11.222.333/0001-82")).toBeNull();
    expect(documentoValido("***.982.247-**")).toBeNull();
    expect(documentoValido("111.111.111-11")).toBeNull();
  });

  it("aceita o CNPJ alfanumérico", () => {
    expect(documentoValido("12.ABC.345/01DE-35")).toBe("12.ABC.345/01DE-35");
    expect(documentoValido("12.ABC.345/01DE-36")).toBeNull();
  });

  it("padroniza a OAB", () => {
    expect(normalizarOab("OAB/SP 123.456")).toBe("SP 123.456");
    expect(normalizarOab("123456/SP")).toBe("SP 123.456");
    expect(normalizarOab("OAB 123456")).toBeNull();
  });

  it("padroniza telefone e e-mail e recusa o que não serve", () => {
    expect(normalizarContato("telefone", "11 98765-4321", true)).toEqual({ tipo: "celular", valor: "(11) 98765-4321", whatsapp: true });
    expect(normalizarContato("celular", "+55 (19) 3232-1010", false)).toEqual({ tipo: "telefone", valor: "(19) 3232-1010", whatsapp: false });
    expect(normalizarContato("email", "JOAO@AutoPecas.com.br", true)).toEqual({ tipo: "email", valor: "joao@autopecas.com.br", whatsapp: false });
    expect(normalizarContato("telefone", "98765-4321", false)).toBeNull();
    expect(normalizarContato("telefone", "0800 123 4567", false)).toBeNull();
    expect(normalizarContato("email", "sem arroba", false)).toBeNull();
  });

  it("compara nomes sem acento, pontuação nem tipo societário", () => {
    expect(normalizarNome("Credora Elétrica Ltda.")).toBe(normalizarNome("CREDORA ELETRICA LTDA"));
    expect(normalizarNome("Banco Alfa S/A")).toBe(normalizarNome("BANCO ALFA S.A. - EM RECUPERAÇÃO JUDICIAL"));
  });
});

describe("devedoresDoProcesso", () => {
  it("usa a marca de devedor e, sem ela, o polo oposto ao do cliente", () => {
    expect(devedoresDoProcesso([CREDOR, DEVEDOR], "Ativo").map((item) => item.id)).toEqual(["devedor"]);
    const semMarca = [CREDOR, { ...DEVEDOR, devedor: false }];
    expect(devedoresDoProcesso(semMarca, "Ativo").map((item) => item.id)).toEqual(["devedor"]);
    expect(devedoresDoProcesso(semMarca, "Passivo").map((item) => item.id)).toEqual(["credor"]);
  });
});

describe("montarSugestoes", () => {
  it("sugere só os campos vazios, com valor convertido, página e trecho conferidos", () => {
    const lido = leitura({
      campos: [
        { campo: "valor_original", valor: "45300.00", pagina: 2, trecho: "no valor original de R$ 45.300,00", confianca: "alta" },
        { campo: "data_origem_debito", valor: "10/02/2023", pagina: 2, trecho: "duplicatas vencidas em 10/02/2023", confianca: "alta" },
        { campo: "data_citacao", valor: "2024-03-15", pagina: 4, trecho: "em 15/03/2024, citei o executado", confianca: "alta" },
        { campo: "valor_acordo", valor: "não houve", pagina: 4, trecho: "citei o executado", confianca: "baixa" },
      ],
    });
    const sugestoes = montarSugestoes(lido, contexto({ data_citacao: "2024-03-20" }), PAGINAS);
    expect(sugestoes.map((item) => [item.campo, (item.valor as { valor: unknown }).valor, item.pagina, item.trechoConferido])).toEqual([
      ["valor_original", 45300, 2, true],
      ["data_origem_debito", "2023-02-10", 2, true],
    ]);
    expect(sugestoes[0].resumo).toContain("45.300,00");
    expect(sugestoes[0].item).toBe("valor_original");
  });

  it("rebaixa a confiança quando o trecho não está no PDF", () => {
    const lido = leitura({ campos: [{ campo: "valor_acordo", valor: "10000.00", pagina: 2, trecho: "as partes celebraram acordo de dez mil reais", confianca: "alta" }] });
    const [sugestao] = montarSugestoes(lido, contexto(), PAGINAS);
    expect(sugestao).toMatchObject({ trechoConferido: false, confianca: "baixa" });
  });

  it("junta a mesma proposta lida em dois blocos e fica com a mais confiável", () => {
    const lido = leitura({
      campos: [
        { campo: "valor_original", valor: "45300.00", pagina: 1, trecho: "valor citado de passagem que não está no texto", confianca: "media" },
        { campo: "valor_original", valor: "45300", pagina: 2, trecho: "no valor original de R$ 45.300,00", confianca: "alta" },
      ],
    });
    const sugestoes = montarSugestoes(lido, contexto(), PAGINAS);
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ pagina: 2, confianca: "alta", trechoConferido: true });
  });

  it("propõe o documento que falta a quem já é parte e não repete o que já existe", () => {
    const lido = leitura({
      pessoas: [
        { nome: "AUTO PEÇAS BRASIL LTDA.", papel: "parte_passiva", referente_a: null, documento: "11.444.777/0001-61", oab: null, pagina: 1, trecho: "inscrita no CNPJ sob o n. 11.444.777/0001-61", confianca: "alta" },
        { nome: "Credora Eletrica Ltda", papel: "parte_ativa", referente_a: null, documento: "11.222.333/0001-81", oab: null, pagina: 1, trecho: "CREDORA ELETRICA LTDA, CNPJ 11.222.333/0001-81", confianca: "alta" },
      ],
    });
    const comDocumento = [{ ...CREDOR, documento: "11.222.333/0001-81" }, DEVEDOR];
    const sugestoes = montarSugestoes(lido, contexto({}, comDocumento), PAGINAS);
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ tipo: "parte_documento", parteId: "devedor", item: "parte_passiva_documento", valor: { documento: "11.444.777/0001-61" }, trechoConferido: true });
  });

  it("descarta documento com dígito verificador errado e desconfia de documento que não está na página", () => {
    const lido = leitura({
      pessoas: [
        { nome: "Auto Peças Brasil Ltda", papel: "parte_passiva", referente_a: null, documento: "11.444.777/0001-62", oab: null, pagina: 1, trecho: "inscrita no CNPJ sob o n.", confianca: "alta" },
        { nome: "Credora Eletrica Ltda", papel: "parte_ativa", referente_a: null, documento: "11.444.777/0001-61", oab: null, pagina: 2, trecho: "O débito decorre das duplicatas vencidas", confianca: "alta" },
      ],
    });
    const sugestoes = montarSugestoes(lido, contexto(), PAGINAS);
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ parteId: "credor", trechoConferido: false, confianca: "baixa" });
  });

  it("cria a pessoa nova com papel, vínculo, endereço e contatos, e liga endereço do devedor a ele", () => {
    const lido = leitura({
      pessoas: [
        { nome: "João da Silva", papel: "socio", referente_a: "Auto Pecas Brasil Ltda", documento: "529.982.247-25", oab: null, pagina: 2, trecho: "O sócio administrador JOÃO DA SILVA, CPF 529.982.247-25", confianca: "alta" },
        { nome: "JOAO DA SILVA", papel: "avalista", referente_a: "Auto Pecas Brasil Ltda", documento: null, oab: null, pagina: 2, trecho: "assinou como avalista", confianca: "media" },
      ],
      enderecos: [
        { pessoa: "João da Silva", endereco: "Av. Paulista, 1000", cidade: "São Paulo", uf: "SP", cep: null, pagina: 2, trecho: "residente na Av. Paulista, 1000, São Paulo/SP", confianca: "alta" },
        { pessoa: "AUTO PECAS BRASIL LTDA", endereco: "Rua das Flores, 100, Centro", cidade: "Campinas", uf: "SP", cep: "13010000", pagina: 1, trecho: "com sede na Rua das Flores, 100, Centro, Campinas/SP", confianca: "alta" },
        { pessoa: "Credora Eletrica Ltda", endereco: "Rua do Credor, 1", cidade: null, uf: null, cep: null, pagina: 1, trecho: "Exequente: CREDORA ELETRICA LTDA", confianca: "alta" },
      ],
      contatos: [
        { pessoa: "João da Silva", tipo: "telefone", valor: "(11) 98765-4321", whatsapp: false, pagina: 2, trecho: "Telefone (11) 98765-4321", confianca: "alta" },
        { pessoa: "João da Silva", tipo: "email", valor: "joao@autopecas.com.br", whatsapp: false, pagina: 2, trecho: "e-mail joao@autopecas.com.br", confianca: "alta" },
      ],
    });
    const sugestoes = montarSugestoes(lido, contexto(), PAGINAS);
    expect(sugestoes.map((item) => item.tipo)).toEqual(["parte_endereco", "parte_nova"]);

    const endereco = sugestoes[0];
    expect(endereco).toMatchObject({ parteId: "devedor", item: "executado_enderecos", valor: { endereco: "Rua das Flores, 100, Centro", cidade: "Campinas", uf: "SP", cep: "13010-000" } });

    const nova = sugestoes[1];
    const pessoa = nova.valor as PessoaSugerida;
    // avalista pesa mais que sócio; o CPF veio da outra menção
    expect(pessoa).toMatchObject({ papel: "avalista", polo: "passivo", documento: "529.982.247-25", referenteNome: "Auto Peças Brasil Ltda" });
    expect(pessoa.enderecos).toEqual([{ endereco: "Av. Paulista, 1000", cidade: "São Paulo", uf: "SP", cep: null }]);
    expect(pessoa.contatos.map((item) => item.tipo)).toEqual(["celular", "email"]);
    expect(nova.item).toBe("corresponsaveis");
    expect(nova.resumo).toBe("Avalista de Auto Peças Brasil Ltda: JOAO DA SILVA (529.982.247-25)");
  });

  it("propõe o advogado do devedor e ignora o do credor", () => {
    const lido = leitura({
      pessoas: [
        { nome: "Carlos Pereira", papel: "advogado", referente_a: "Auto Peças Brasil Ltda", documento: null, oab: "OAB/SP 123.456", pagina: 4, trecho: "Pelo executado, Dr. Carlos Pereira, OAB/SP 123.456", confianca: "alta" },
        { nome: "Ana Souza", papel: "advogado", referente_a: "Credora Elétrica Ltda", documento: null, oab: "SP 999.999", pagina: 1, trecho: "Exequente: CREDORA ELETRICA LTDA", confianca: "alta" },
      ],
      contatos: [{ pessoa: "Maria Advogada", tipo: "email", valor: "maria@escritorio.com.br", whatsapp: false, pagina: 1, trecho: "Exequente: CREDORA ELETRICA LTDA", confianca: "alta" }],
    });
    const sugestoes = montarSugestoes(lido, contexto(), PAGINAS);
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ tipo: "parte_nova", item: "advogado_executado", trechoConferido: true });
    expect(sugestoes[0].valor).toMatchObject({ papel: "advogado", oab: "SP 123.456", polo: "passivo", referenteNome: "Auto Peças Brasil Ltda" });
  });

  it("não repete endereço nem contato que a parte já tem", () => {
    const devedor = {
      ...DEVEDOR,
      enderecos: [{ endereco: "Rua das Flores, 100 - Centro", cidade: "Campinas", uf: "SP", cep: null, observacao: null }],
      contatos: [{ tipo: "celular" as const, valor: "11987654321", whatsapp: false, observacao: null }],
    };
    const lido = leitura({
      enderecos: [{ pessoa: "Auto Peças Brasil Ltda", endereco: "Rua das Flores, 100, Centro", cidade: "Campinas", uf: "SP", cep: null, pagina: 1, trecho: "com sede na Rua das Flores, 100", confianca: "alta" }],
      contatos: [{ pessoa: "Auto Peças Brasil Ltda", tipo: "celular", valor: "(11) 98765-4321", whatsapp: false, pagina: 2, trecho: "Telefone (11) 98765-4321", confianca: "alta" }],
    });
    expect(montarSugestoes(lido, contexto({}, [CREDOR, devedor]), PAGINAS)).toEqual([]);
  });
});

describe("da sugestão ao cadastro", () => {
  it("aplica o dado na parte sem perder o que ela já tem", () => {
    const comContato = { ...DEVEDOR, contatos: [{ id: "c1", tipo: "email" as const, valor: "a@b.com", whatsapp: false, observacao: null, origem: "manual" as const }] };
    expect(aplicarNaParte(comContato, "parte_documento", { documento: "11.444.777/0001-61" })).toMatchObject({ nome: DEVEDOR.nome, documento: "11.444.777/0001-61", devedor: true });
    const comEndereco = aplicarNaParte(comContato, "parte_endereco", { endereco: "Rua A, 1", cidade: "Campinas", uf: "SP", cep: null });
    expect(comEndereco.enderecos).toEqual([{ endereco: "Rua A, 1", cidade: "Campinas", uf: "SP", cep: null, observacao: null, origem: "ia" }]);
    expect(comEndereco.contatos).toHaveLength(1);
    const comMaisUm = aplicarNaParte(comContato, "parte_contato", { tipo: "celular", valor: "(11) 98765-4321", whatsapp: true });
    expect(comMaisUm.contatos.map((item) => item.origem)).toEqual(["manual", "ia"]);
  });

  it("resolve o 'referente a' da pessoa nova pelo nome entre as partes de hoje", () => {
    const pessoa: PessoaSugerida = { polo: "passivo", papel: "socio", vinculo: null, nome: "João da Silva", documento: "529.982.247-25", oab: null, referenteNome: "AUTO PECAS BRASIL LTDA", enderecos: [], contatos: [] };
    expect(entradaDaPessoa(pessoa, [CREDOR, DEVEDOR])).toMatchObject({ papel: "socio", referenteA: "devedor", devedor: false, documento: "529.982.247-25" });
    expect(entradaDaPessoa({ ...pessoa, referenteNome: "Empresa que não está no processo" }, [CREDOR, DEVEDOR]).referenteA).toBeNull();
  });
});

describe("entradaDaLeitura", () => {
  it("diz ao modelo quem é o devedor e que páginas está lendo", () => {
    const [bloco] = dividirEmBlocos(PAGINAS);
    const entrada = entradaDaLeitura(contexto(), bloco, PAGINAS.length);
    expect(entrada).toContain("Auto Peças Brasil Ltda (polo passivo, DEVEDOR)");
    expect(entrada).toContain("Maria Advogada (advogado, polo ativo)");
    expect(entrada).toContain("Páginas 1 a 4 de 4");
    expect(entrada).toContain("[[PÁGINA 4]]");
  });
});
