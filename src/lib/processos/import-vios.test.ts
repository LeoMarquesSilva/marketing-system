import { describe, expect, it } from "vitest";
import { juntarFontes, lerCsvProcessos, lerData, lerNumeros, lerPartes, limparExcel, registroDoSioe, separarEtiquetas } from "./import-vios";

describe("células do relatório do VIOS", () => {
  it("tira o truque do Excel e o zero de campo vazio", () => {
    expect(limparExcel('="41835"')).toBe("41835");
    expect(limparExcel("=3")).toBe("3");
    expect(limparExcel("=0")).toBe("");
    expect(limparExcel("3ª")).toBe("3ª");
  });

  it("lê data brasileira e ISO", () => {
    expect(lerData("05/03/2024")).toBe("2024-03-05");
    expect(lerData("05/03/2024 14:10")).toBe("2024-03-05");
    expect(lerData("2024-03-05T10:00:00")).toBe("2024-03-05");
    expect(lerData("")).toBeNull();
  });

  it("separa o CNJ dos outros números, que vêm colados", () => {
    expect(lerNumeros("CNJ: 1234567-89.2023.8.26.0100")).toEqual({ cnj: "1234567-89.2023.8.26.0100", outros: [] });
    expect(lerNumeros("CNJ: 1234567-89.2023.8.26.0100Outros: 583002023")).toEqual({ cnj: "1234567-89.2023.8.26.0100", outros: ["Outros: 583002023"] });
    expect(lerNumeros("2.° Grau: 2234567-89.2023.8.26.0000")).toEqual({ cnj: "2234567-89.2023.8.26.0000", outros: [] });
    expect(lerNumeros("CNJ: 1234567-89.2023.8.26.0100T: 2023/000123-45")).toEqual({ cnj: "1234567-89.2023.8.26.0100", outros: ["T: 2023/000123-45"] });
    expect(lerNumeros("")).toEqual({ cnj: null, outros: [] });
  });

  it("separa as partes pelo tipo, mesmo coladas ao nome anterior", () => {
    expect(lerPartes("Exequente: BANCO ALFA S.A.", "ativo")).toEqual([{ polo: "ativo", tipo: "Exequente", nome: "BANCO ALFA S.A." }]);
    expect(lerPartes("Executado: Loja Beta LtdaExecutado: JOÃO DA SILVA", "passivo")).toEqual([
      { polo: "passivo", tipo: "Executado", nome: "Loja Beta Ltda" },
      { polo: "passivo", tipo: "Executado", nome: "JOÃO DA SILVA" },
    ]);
    expect(lerPartes("Terceiro Interessado: GAMA FOMENTO", "terceiro")).toEqual([{ polo: "terceiro", tipo: "Terceiro Interessado", nome: "GAMA FOMENTO" }]);
    expect(lerPartes("EMPRESA SEM TIPO", "ativo")).toEqual([{ polo: "ativo", tipo: null, nome: "EMPRESA SEM TIPO" }]);
    expect(lerPartes("", "ativo")).toEqual([]);
  });

  it("separa as etiquetas pelo catálogo, sempre pela mais longa", () => {
    const catalogo = ["Carteira X", "Crédito Ativo", "RC-Insolvência", "Demanda de risco", "Crítico"];
    expect(separarEtiquetas("Carteira X RC-Insolvência Crédito Ativo", catalogo)).toEqual(["Carteira X", "RC-Insolvência", "Crédito Ativo"]);
    expect(separarEtiquetas("Carteira X Demanda de risco", catalogo)).toEqual(["Carteira X", "Demanda de risco"]);
    expect(separarEtiquetas("Carteira X Etiqueta Nova Crítico", catalogo)).toEqual(["Carteira X", "Etiqueta Nova", "Crítico"]);
    expect(separarEtiquetas("Sem Catálogo", [])).toEqual(["Sem Catálogo"]);
  });
});

const CSV = [
  '"Vínculo";"CI";"Área";"Data do Cadastro";"Número";"Etiquetas";"Órgão Julgador (Vara/Camara)";"Tipo de órgão julgador (vara/camara)";"Aux.";"Parte ativa";"Parte passiva";"Valor da ação";"Última edição";"Vida Útil";"Grupo Cliente";"Coluna Nova"',
  '"PROCESSO PRINCIPAL";="50001";"Recuperação de Crédito";"02/01/2025";"CNJ: 1234567-89.2023.8.26.0100";"Carteira X Crédito Ativo";="3";"Vara Cível";"ABC";"Exequente: BANCO ALFA S.A.";"Executado: Loja Beta LtdaExecutado: JOÃO DA SILVA";"12.345,67";"09/11/2026";"1 ano e 2 meses";"Grupo X";"qualquer"',
  '"INCIDENTE";="50002";"Recuperação de Crédito";"03/01/2025";"";"";="0";="0";"ABC";"";"";"0,00";"09/11/2026";"3 meses";"Grupo X";""',
  '"Média:";"";"";"";"";"";"";"";"";"";"";"6.172,83";"";"";"";""',
  '"Total: 2";"";"";"";"";"";"";"";"";"";"";"12.345,67";"";"";"";""',
].join("\r\n");

describe("lerCsvProcessos", () => {
  const leitura = lerCsvProcessos(CSV, ["Carteira X", "Crédito Ativo"]);

  it("ignora as linhas de média e total e aponta a coluna que não conhece", () => {
    expect(leitura.registros.map((registro) => registro.ci)).toEqual(["50001", "50002"]);
    expect(leitura.linhasSemCi).toBe(2);
    expect(leitura.colunasIgnoradas).toEqual(["Coluna Nova"]);
  });

  it("converte cada coluna para o campo e o tipo certos", () => {
    const { valores, partes } = leitura.registros[0];
    expect(valores).toMatchObject({
      ci: "50001",
      vinculo: "PROCESSO PRINCIPAL",
      area: "Recuperação de Crédito",
      data_cadastro: "2025-01-02",
      cnj: "1234567-89.2023.8.26.0100",
      outros_numeros: [],
      etiquetas: ["Carteira X", "Crédito Ativo"],
      orgao_julgador: "3",
      tipo_orgao_julgador: "Vara Cível",
      auxiliares: ["ABC"],
      parte_ativa: "BANCO ALFA S.A.",
      parte_passiva: "Loja Beta Ltda; JOÃO DA SILVA",
      valor_acao: 12345.67,
      vios_editado_em: "09/11/2026",
      grupo_cliente: "Grupo X",
    });
    expect(partes).toHaveLength(3);
    expect(partes[1]).toEqual({ polo: "passivo", tipo: "Executado", nome: "Loja Beta Ltda" });
  });

  it("deixa vazio o que veio vazio", () => {
    const { valores, partes } = leitura.registros[1];
    expect(valores.cnj).toBeNull();
    expect(valores.orgao_julgador).toBeNull();
    expect(valores.tipo_orgao_julgador).toBeNull();
    expect(valores.parte_ativa).toBeNull();
    expect(valores.valor_acao).toBe(0);
    expect(partes).toEqual([]);
  });

  it("recusa arquivo sem a coluna CI", () => {
    expect(() => lerCsvProcessos('"A";"B"\r\n"1";"2"')).toThrow(/coluna CI/);
  });
});

describe("SIOE", () => {
  const sioe = registroDoSioe({
    ci: 50001,
    area: "Recuperação de Crédito",
    grupo_cliente: "Grupo X",
    fase_processual: "Execução",
    etiquetas: "Carteira X | Crédito Ativo",
    valor_acao: "12345.67",
    data_encerramento: null,
    nro_cnj: "1234567-89.2023.8.26.0100",
  });

  it("lê só as colunas que a linha traz", () => {
    expect(sioe?.valores).toMatchObject({ ci: "50001", fase: "Execução", etiquetas: ["Carteira X", "Crédito Ativo"], valor_acao: 12345.67, data_encerramento: null });
    expect(sioe?.valores).not.toHaveProperty("materia");
  });

  it("junta com o CSV: o CSV manda, o SIOE completa e dá as etiquetas", () => {
    const csv = lerCsvProcessos(CSV).registros[0];
    const junto = juntarFontes(csv, sioe ?? undefined);
    expect(junto?.valores.fase).toBe("Execução");
    expect(junto?.valores.etiquetas).toEqual(["Carteira X", "Crédito Ativo"]);
    expect(junto?.valores.parte_ativa).toBe("BANCO ALFA S.A.");
    expect(junto?.partes).toHaveLength(3);
  });
});
