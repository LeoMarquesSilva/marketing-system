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
  entradaDaSintese,
  fatosParaSintese,
  juntarLeituras,
  leituraVazia,
  montarSugestoes,
  normalizarContato,
  normalizarNome,
  normalizarOab,
  sugestoesDaSintese,
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
    expect(normalizarNome("J.b. Exemplo & Cia Ltda - Epp")).toBe(normalizarNome("J.B EXEMPLO E CIA LTDA"));
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

  it("junta as grafias do mesmo endereço numa proposta só, a mais completa", () => {
    const paginas = [
      "Executada com sede na Av. Joaquim Exemplo Ramos, nº 3.177, bairro Jardim, Vila Modelo.",
      "Endereço: R JOAQUIM EXEMPLO RAMOS 3177, JARDIM, VILA MODELO, MT, CEP 13000-000. Filial na Rodovia MT 999, Km 12, saída para Vila Distante.",
    ];
    const lido = leitura({
      enderecos: [
        { pessoa: "Auto Peças Brasil Ltda", endereco: "Av. Joaquim Exemplo Ramos, nº 3.177, bairro Jardim", cidade: "Vila Modelo", uf: null, cep: null, pagina: 1, trecho: "com sede na Av. Joaquim Exemplo Ramos, nº 3.177, bairro Jardim", confianca: "alta" },
        { pessoa: "Auto Peças Brasil Ltda", endereco: "R JOAQUIM EXEMPLO RAMOS 3177, JARDIM", cidade: "VILA MODELO", uf: "MT", cep: "13000-000", pagina: 2, trecho: "R JOAQUIM EXEMPLO RAMOS 3177, JARDIM, VILA MODELO, MT", confianca: "alta" },
        { pessoa: "Auto Peças Brasil Ltda", endereco: "Rodovia MT 999, Km 12, saída para Vila Distante", cidade: null, uf: "MT", cep: null, pagina: 2, trecho: "Filial na Rodovia MT 999, Km 12, saída para Vila Distante", confianca: "alta" },
      ],
    });
    const sugestoes = montarSugestoes(lido, contexto(), paginas);
    expect(sugestoes.map((item) => (item.valor as { endereco: string }).endereco)).toEqual(["R JOAQUIM EXEMPLO RAMOS 3177, JARDIM", "Rodovia MT 999, Km 12, saída para Vila Distante"]);
    expect(sugestoes[0]).toMatchObject({ pagina: 2, valor: { cep: "13000-000", uf: "MT" } });
  });

  it("fica com no máximo três propostas por campo, as mais confiáveis e das primeiras páginas", () => {
    const paginas = ["total de R$ 100,00", "nota de R$ 20,00", "nota de R$ 30,00", "nota de R$ 40,00", "nota de R$ 50,00"];
    const lido = leitura({
      campos: [
        { campo: "valor_original", valor: "50.00", pagina: 5, trecho: "nota de R$ 50,00", confianca: "alta" },
        { campo: "valor_original", valor: "40.00", pagina: 4, trecho: "nota de R$ 40,00", confianca: "media" },
        { campo: "valor_original", valor: "30.00", pagina: 3, trecho: "nota de R$ 30,00", confianca: "alta" },
        { campo: "valor_original", valor: "20.00", pagina: 2, trecho: "nota de R$ 20,00", confianca: "alta" },
        { campo: "valor_original", valor: "100.00", pagina: 1, trecho: "total de R$ 100,00", confianca: "alta" },
      ],
    });
    expect(montarSugestoes(lido, contexto(), paginas).map((item) => (item.valor as { valor: number }).valor)).toEqual([100, 20, 30]);
  });

  it("reconhece o mesmo advogado pela OAB e a filial do cliente pela raiz do CNPJ", () => {
    const paginas = ["Pelo executado: MARINA COSTA LOPES, OAB/MG 999.111.", "Marina Souza Lopes - OAB/MG 999.111. Exequente CREDORA ELETRICA INDUSTRIA LTDA, CNPJ 11.222.333/0002-62."];
    const lido = leitura({
      pessoas: [
        { nome: "MARINA COSTA LOPES", papel: "advogado", referente_a: "Auto Pecas Brasil Ltda", documento: null, oab: "MG 999111", pagina: 1, trecho: "Pelo executado: MARINA COSTA LOPES, OAB/MG 999.111", confianca: "media" },
        { nome: "Marina Souza Lopes", papel: "advogado", referente_a: "AUTO PECAS BRASIL", documento: null, oab: "OAB/MG 999.111", pagina: 2, trecho: "Marina Souza Lopes - OAB/MG 999.111", confianca: "alta" },
        { nome: "CREDORA ELETRICA INDUSTRIA LTDA", papel: "parte_ativa", referente_a: null, documento: "11.222.333/0002-62", oab: null, pagina: 2, trecho: "Exequente CREDORA ELETRICA INDUSTRIA LTDA, CNPJ 11.222.333/0002-62", confianca: "alta" },
        { nome: "Outra Credora S.A.", papel: "parte_ativa", referente_a: null, documento: null, oab: null, pagina: 2, trecho: "Exequente CREDORA ELETRICA INDUSTRIA", confianca: "alta" },
      ],
    });
    const comDocumento = [{ ...CREDOR, documento: "11.222.333/0001-81" }, DEVEDOR];
    const sugestoes = montarSugestoes(lido, contexto({}, comDocumento), paginas);
    // a filial é o próprio cliente (já tem CNPJ) e parte nova no polo do cliente não é proposta
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].valor).toMatchObject({ papel: "advogado", nome: "Marina Souza Lopes", oab: "MG 999.111" });
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

describe("síntese do processo", () => {
  const fatos = [
    { data: "2024-03-15", fato: "O oficial de justiça citou a executada na pessoa do representante.", pagina: 4 },
    { data: "2023-05-02", fato: "A credora ajuizou execução de duplicatas vencidas, no valor de R$ 45.300,00.", pagina: 1 },
    { data: "2023-05-02", fato: "A credora ajuizou execução de duplicatas vencidas, no valor de R$ 45.300,00.", pagina: 2 },
    { data: "ontem", fato: "O juízo determinou o bloqueio de valores pelo SISBAJUD, que voltou negativo.", pagina: 9 },
    { data: null, fato: "juntada", pagina: 3 },
  ];

  it("junta os fatos de todos os pedaços dos autos", () => {
    const junta = juntarLeituras([leitura({ fatos: [fatos[0]] }), leitura({ fatos: [fatos[1]] })]);
    expect(junta.fatos).toHaveLength(2);
  });

  it("ordena por página, tira repetidos e fatos vazios e descarta data fora do formato", () => {
    const prontos = fatosParaSintese(fatos);
    expect(prontos.map((item) => item.pagina)).toEqual([1, 4, 9]);
    expect(prontos[2].data).toBeNull();
  });

  it("para de incluir quando passa do teto de texto", () => {
    const muitos = Array.from({ length: 50 }, (_, i) => ({ data: null, fato: `Fato relevante número ${i} do processo em questão.`, pagina: i + 1 }));
    expect(fatosParaSintese(muitos, 400).length).toBeLessThan(10);
  });

  it("manda ao modelo quem é quem e os fatos com página e data", () => {
    const entrada = entradaDaSintese(contexto({ acao: "Execução de Título Extrajudicial" }), fatosParaSintese(fatos), 30);
    expect(entrada).toContain("Ação: Execução de Título Extrajudicial");
    expect(entrada).toContain("- Auto Peças Brasil Ltda (polo passivo)");
    expect(entrada).not.toContain("Maria Advogada");
    expect(entrada).toContain("- p. 4, 2024-03-15: O oficial de justiça citou");
    expect(entrada).toContain("(30 páginas)");
  });

  const redigida = { sintese: `Resumo\n${"A credora executa duplicatas vencidas contra a devedora. ".repeat(3)}\n\n\n\nAndamento\n15/03/2024: citação positiva (p. 4)`, objeto: "Execução de duplicatas vencidas e não pagas", fase: null, parecer_risco: null, proximos_passos: null };

  it("vira sugestão da síntese e do objeto quando os dois estão vazios", () => {
    const sugestoes = sugestoesDaSintese(redigida, contexto(), "doc-1", "2026-11-12");
    expect(sugestoes.map((item) => [item.campo, item.chave])).toEqual([
      ["sintese", "campo:sintese:doc-1"],
      ["objeto", "campo:objeto:doc-1"],
    ]);
    const texto = (sugestoes[0].valor as { valor: string }).valor;
    expect(texto.startsWith("Resumo\nA credora executa")).toBe(true);
    expect(texto).not.toContain("\n\n\n");
    expect(sugestoes[0]).toMatchObject({ tipo: "campo", pagina: null, trecho: null, trechoConferido: true });
  });

  it("com síntese no cadastro, mantém o que existe e acrescenta a da IA, datada", () => {
    const sugestoes = sugestoesDaSintese(redigida, contexto({ sintese: "01/02/2024 - Ajuizada a execução.", objeto: "Cobrança" }), "doc-1", "2026-11-12");
    expect(sugestoes).toHaveLength(1);
    const texto = (sugestoes[0].valor as { valor: string }).valor;
    expect(texto.startsWith("01/02/2024 - Ajuizada a execução.\n\n12/11/2026 (IA, leitura dos autos):\nResumo")).toBe(true);
  });

  it("não propõe síntese vazia nem curta demais", () => {
    expect(sugestoesDaSintese({ sintese: "Sem dados.", objeto: null, fase: null, parecer_risco: null, proximos_passos: null }, contexto(), "doc-1", "2026-11-12")).toEqual([]);
  });

  it("propõe a fase e o parecer do risco só quando estão vazios no cadastro", () => {
    const parecer = "A devedora está em recuperação judicial e o bloqueio de valores foi liberado pelo tribunal. Há alienação fiduciária de semirreboques em garantia.";
    const completa = { ...redigida, fase: "Recursal" as const, parecer_risco: parecer };
    const vazio = sugestoesDaSintese(completa, contexto(), "doc-1", "2026-11-12");
    expect(vazio.map((item) => item.campo)).toEqual(["sintese", "fase", "parecer_risco", "objeto"]);
    expect(vazio[1].valor).toEqual({ valor: "Recursal" });
    expect(vazio[2]).toMatchObject({ chave: "campo:parecer_risco:doc-1", valor: { valor: parecer }, trecho: null });
    const preenchido = sugestoesDaSintese(completa, contexto({ fase: "Execução", parecer_risco: "Já avaliado.", objeto: "Cobrança" }), "doc-1", "2026-11-12");
    expect(preenchido.map((item) => item.campo)).toEqual(["sintese"]);
  });

  it("a situação atual vira sugestão do último andamento, datada pelo último marco", () => {
    const comSituacao = {
      ...redigida,
      sintese: `${redigida.sintese}\n20/05/2024: penhora negativa (p. 9)\n\nSituação atual\nAguarda manifestação da credora sobre a penhora negativa.`,
    };
    const vazio = sugestoesDaSintese(comSituacao, contexto(), "doc-1", "2026-11-12").find((item) => item.campo === "ultimo_andamento_texto");
    expect(vazio).toMatchObject({
      chave: "campo:ultimo_andamento_texto:doc-1",
      valor: { valor: "Aguarda manifestação da credora sobre a penhora negativa.", junto: { ultimo_andamento_data: "2024-05-20" } },
    });
    const antigo = sugestoesDaSintese(comSituacao, contexto({ ultimo_andamento_texto: "Citado.", ultimo_andamento_data: "2024-01-10" }), "doc-1", "2026-11-12");
    expect(antigo.some((item) => item.campo === "ultimo_andamento_texto")).toBe(true);
    const recente = sugestoesDaSintese(comSituacao, contexto({ ultimo_andamento_texto: "Acordo.", ultimo_andamento_data: "2025-02-01" }), "doc-1", "2026-11-12");
    expect(recente.some((item) => item.campo === "ultimo_andamento_texto")).toBe(false);
  });

  it("propõe os próximos passos só quando o campo está vazio", () => {
    const passos = "Aguarda o retorno do AR expedido ao novo endereço do devedor.";
    const comPassos = { ...redigida, proximos_passos: passos };
    expect(sugestoesDaSintese(comPassos, contexto(), "doc-1", "2026-11-12").find((item) => item.campo === "proximos_passos")).toMatchObject({
      chave: "campo:proximos_passos:doc-1",
      valor: { valor: passos },
    });
    expect(sugestoesDaSintese(comPassos, contexto({ proximos_passos: "Já anotado." }), "doc-1", "2026-11-12").some((item) => item.campo === "proximos_passos")).toBe(false);
  });
});

describe("campos de Recuperação de Crédito lidos dos autos", () => {
  const paginas = [
    "A exequente é credora da executada pela Cédula de Crédito Bancário nº 1161191, de 25/04/2022. Dá-se à causa o valor de R$ 45.300,00. Distribuído em 02/05/2023.",
    "Este cumprimento decorre do processo 1001234-56.2022.8.26.0100. Demonstrativo atualizado do débito: R$ 61.870,44. A recuperação judicial tramita sob o nº 1009999-11.2025.8.26.0100.",
  ];

  it("propõe contrato, valor da causa, valor envolvido e distribuição quando vazios", () => {
    const sugestoes = montarSugestoes(
      leitura({
        campos: [
          { campo: "contrato_credito", valor: "Cédula de Crédito Bancário nº 1161191, de 25/04/2022", pagina: 1, trecho: "Cédula de Crédito Bancário nº 1161191, de 25/04/2022", confianca: "alta" },
          { campo: "contrato_credito", valor: "CCB 1161191", pagina: 2, trecho: "texto que não está na página", confianca: "media" },
          { campo: "valor_acao", valor: "45300.00", pagina: 1, trecho: "Dá-se à causa o valor de R$ 45.300,00", confianca: "alta" },
          { campo: "valor_envolvido", valor: "61870.44", pagina: 2, trecho: "Demonstrativo atualizado do débito: R$ 61.870,44", confianca: "alta" },
          { campo: "data_distribuicao", valor: "2023-05-02", pagina: 1, trecho: "Distribuído em 02/05/2023", confianca: "alta" },
        ],
      }),
      contexto(),
      paginas
    );
    const porCampo = Object.fromEntries(sugestoes.map((item) => [item.campo, (item.valor as { valor: unknown }).valor]));
    expect(porCampo).toEqual({
      contrato_credito: "Cédula de Crédito Bancário nº 1161191, de 25/04/2022",
      valor_acao: 45300,
      valor_envolvido: 61870.44,
      data_distribuicao: "2023-05-02",
    });
  });

  it("não propõe o que o cadastro já tem", () => {
    const sugestoes = montarSugestoes(
      leitura({ campos: [{ campo: "valor_acao", valor: "45300.00", pagina: 1, trecho: "Dá-se à causa o valor de R$ 45.300,00", confianca: "alta" }] }),
      contexto({ valor_acao: 18136.81 }),
      paginas
    );
    expect(sugestoes).toEqual([]);
  });

  it("não propõe data de encerramento nem de arquivamento para processo ativo", () => {
    const lida = leitura({ campos: [{ campo: "data_encerramento", valor: "2023-05-02", pagina: 1, trecho: "Distribuído em 02/05/2023", confianca: "alta" }] });
    expect(montarSugestoes(lida, contexto({ situacao: "Ativo" }), paginas)).toEqual([]);
    expect(montarSugestoes(lida, contexto({ situacao: "Arquivado definitivamente" }), paginas).map((item) => item.campo)).toEqual(["data_encerramento"]);
  });

  it("junta os outros números numa proposta só, mantém os já cadastrados e ignora o próprio processo", () => {
    const sugestoes = montarSugestoes(
      leitura({
        campos: [
          { campo: "outros_numeros", valor: "1001234-56.2022.8.26.0100", pagina: 2, trecho: "decorre do processo 1001234-56.2022.8.26.0100", confianca: "alta" },
          { campo: "outros_numeros", valor: "Recuperação judicial nº 1009999-11.2025.8.26.0100", pagina: 2, trecho: "tramita sob o nº 1009999-11.2025.8.26.0100", confianca: "alta" },
          { campo: "outros_numeros", valor: "1012345-67.2023.8.26.0100", pagina: 1, trecho: "este processo", confianca: "alta" },
          { campo: "outros_numeros", valor: "10012345620228260100", pagina: 2, trecho: "repetido", confianca: "alta" },
        ],
      }),
      contexto({ outros_numeros: ["Outros: 583002023"] }),
      paginas
    );
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ campo: "outros_numeros", trechoConferido: true });
    expect((sugestoes[0].valor as { valor: string }).valor).toBe("Outros: 583002023\n1001234-56.2022.8.26.0100\n1009999-11.2025.8.26.0100");
  });
});
