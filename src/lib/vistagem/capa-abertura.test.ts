import { describe, expect, it } from "vitest";
import {
  acaoDoVios,
  capaDoDjen,
  cidadeDoOrgao,
  lerCapaDoEsaj,
  faseDoVios,
  lerCnj,
  materiaDoVios,
  montarCapa,
  orgaoDoVios,
  parteDoCliente,
  resumoDaCapa,
  separarVara,
  sistemaDoTribunal,
  urlDoEsaj,
  valorEmReais,
  type CampoDaCapa,
  type ChaveDaCapa,
  type ComunicacaoDjen,
} from "./capa-abertura";

// Agravo 2266041-23.2026.8.26.0000: chegou sem pasta em 09/11/2026 e virou a CI 61365 pela Central (gabarito).
const DJEN_AGRAVO: ComunicacaoDjen[] = [
  {
    siglaTribunal: "TJSP",
    nomeOrgao: "Unidade de Processamento Judicial de Direito Privado",
    nomeClasse: "AGRAVO DE INSTRUMENTO",
    codigoClasse: "202",
    data_disponibilizacao: "2026-11-09",
    destinatarios: [
      { nome: "BON MART FRIGORIFICO LTDA", polo: "A" },
      { nome: "LIRA ALIMENTOS EIRELI", polo: "P" },
    ],
    destinatarioadvogados: [
      { advogado: { nome: "JULIO MATUCH DE CARVALHO", numero_oab: "98885", uf_oab: "RJ" } },
      { advogado: { nome: "GUSTAVO BISMARCHI MOTTA", numero_oab: "275477", uf_oab: "SP" } },
    ],
  },
  {
    siglaTribunal: "TJSP",
    nomeOrgao: "Unidade de Processamento Judicial de Direito Privado",
    nomeClasse: "AGRAVO DE INSTRUMENTO",
    codigoClasse: "202",
    data_disponibilizacao: "2026-11-06",
    destinatarios: [{ nome: "LIRA ALIMENTOS EIRELI", polo: "P" }],
    destinatarioadvogados: [{ advogado: { nome: "GUSTAVO BISMARCHI MOTTA", numero_oab: "275477", uf_oab: "SP" } }],
  },
];

// Trechos da página do e-SAJ (os campos têm ids fixos; 2º grau no cposg, 1º grau no cpopg).
const ESAJ_2G = `
  <span id="numeroProcesso">2266041-23.2026.8.26.0000</span>
  <div class="lh-1-1 line-clamp__2" id="classeProcesso"> <span title="Agravo de Instrumento">Agravo de Instrumento</span></div>
  <div class="lh-1-1 line-clamp__2" id="assuntoProcesso"> <span title="Recuperação judicial e Falência">Recuperação judicial e Falência</span></div>
  <div class="lh-1-1 line-clamp__2" id="orgaoJulgadorProcesso"> <span title="2ª Câmara Reservada de Direito Empresarial">2ª Câmara Reservada de Direito Empresarial</span></div>
  <div class="line-clamp__2" id="valorAcaoProcesso"><span title="729.764,00">729.764,00</span></div>`;
const ESAJ_1G = `
  <span id="numeroProcesso" class="unj-larger-1">1000015-20.2024.8.26.0354</span>
  <span id="classeProcesso" title="Falência de Empresários, Sociedades Empresáriais, Microempresas e Empresas de Pequeno Porte">Falência de Empresários, Sociedades Empresáriais, Microempresas e Empresas de Pequeno Porte</span>
  <span id="foroProcesso" title="Foro Especializado da 4ª e da 10ª RAJs">Foro Especializado da 4ª e da 10ª RAJs</span>
  <div class="lh-1-1 line-clamp__2"><span id="varaProcesso" title="1ª Vara Regional de Competência Empresarial">1ª Vara Regional de Competência Empresarial</span></div>
  <div id="dataHoraDistribuicaoProcesso">06/02/2024 às 02:33 - Livre</div>
  <div id="valorAcaoProcesso">R$         174.938.139,07</div>`;

const valorDe = (campos: CampoDaCapa[], chave: ChaveDaCapa) => campos.find((campo) => campo.chave === chave);

describe("lerCnj", () => {
  it("lê justiça, tribunal, UF e grau pelo número", () => {
    expect(lerCnj("2266041-23.2026.8.26.0000")).toMatchObject({ justica: "Justiça Estadual", tribunal: "TJSP", uf: "SP", grau: "SEGUNDO GRAU", ano: 2026 });
    expect(lerCnj("1001666-18.2026.5.02.0231")).toMatchObject({ justica: "Justiça Trabalhista", tribunal: "TRT2", uf: "SP", grau: "PRIMEIRO GRAU" });
    expect(lerCnj("0011877-60.2026.5.15.0105")).toMatchObject({ tribunal: "TRT15", uf: "SP" });
    expect(lerCnj("2851405-63.2026.8.13.0000")).toMatchObject({ tribunal: "TJMG", uf: "MG", grau: "SEGUNDO GRAU" });
    expect(lerCnj("123")).toBeNull();
  });

  it("monta a consulta do e-SAJ só no TJSP (cposg no 2º grau, cpopg no 1º)", () => {
    expect(urlDoEsaj(lerCnj("2266041-23.2026.8.26.0000"))).toContain("/cposg/search.do?");
    expect(urlDoEsaj(lerCnj("1000015-20.2024.8.26.0354"))).toContain("dadosConsulta.valorConsultaNuUnificado=1000015-20.2024.8.26.0354");
    expect(urlDoEsaj(lerCnj("1001666-18.2026.5.02.0231"))).toBeNull();
  });
});

describe("capaDoDjen", () => {
  it("junta as comunicações: classe e órgão da mais recente, partes e advogados sem repetir", () => {
    const capa = capaDoDjen(DJEN_AGRAVO);
    expect(capa).toMatchObject({ comunicacoes: 2, tribunal: "TJSP", classe: "AGRAVO DE INSTRUMENTO", ativas: ["BON MART FRIGORIFICO LTDA"], passivas: ["LIRA ALIMENTOS EIRELI"] });
    expect(capa.advogados).toEqual([
      { nome: "JULIO MATUCH DE CARVALHO", oab: "98885", uf: "RJ", doEscritorio: false },
      { nome: "GUSTAVO BISMARCHI MOTTA", oab: "275477", uf: "SP", doEscritorio: true },
    ]);
  });
});

describe("e-SAJ", () => {
  it("lê a capa do 2º e do 1º grau, com o valor da ação", () => {
    expect(lerCapaDoEsaj(ESAJ_2G)).toMatchObject({ classe: "Agravo de Instrumento", orgaoJulgador: "2ª Câmara Reservada de Direito Empresarial", valor: 729764 });
    expect(lerCapaDoEsaj(ESAJ_1G)).toMatchObject({ vara: "1ª Vara Regional de Competência Empresarial", distribuicao: "06/02/2024", valor: 174938139.07 });
    expect(lerCapaDoEsaj("<html>Não existem informações disponíveis</html>")).toBeNull();
    expect(valorEmReais("R$ 1.000,00")).toBe(1000);
  });
});

describe("regras", () => {
  it("classe → ação do VIOS: os pares conferidos e o resto para conferir", () => {
    expect(acaoDoVios("AçãO TRABALHISTA - RITO ORDINáRIO")).toEqual({ acao: "Reclamação Trabalhista", conferida: true });
    expect(acaoDoVios("CUMPRIMENTO PROVISóRIO DE SENTENçA")).toEqual({ acao: "Cumprimento de sentença", conferida: true });
    expect(acaoDoVios("HABILITAçãO DE CRéDITO")).toEqual({ acao: "Habilitação de crédito", conferida: false });
    expect(acaoDoVios(null)).toBeNull();
  });

  it("vara, tipo e cidade pelo nome do órgão", () => {
    expect(separarVara("2ª Câmara Reservada de Direito Empresarial")).toEqual({ vara: "2ª", tipo: "Câmara Reservada de Direito Empresarial" });
    expect(separarVara("EXE3 - Jundiaí")).toEqual({ vara: null, tipo: "EXE3 - Jundiaí" });
    expect(cidadeDoOrgao("1ª Vara do Trabalho de Carapicuíba")).toBe("Carapicuíba");
    expect(cidadeDoOrgao("UPJ da 5ª a 8ª Varas Cíveis da Comarca de Campinas")).toBe("Campinas");
    expect(cidadeDoOrgao("EXE3 - Jundiaí")).toBe("Jundiaí");
  });

  it("sistema: o do DataJud; sem ele, o provável (TJSP com número 4… é eproc)", () => {
    expect(sistemaDoTribunal(lerCnj("4048327-46.2026.8.26.0114"), "eSAJ")).toEqual({ sistema: "E-saj", provavel: false });
    expect(sistemaDoTribunal(lerCnj("4048327-46.2026.8.26.0114"), null)).toEqual({ sistema: "E-PROC", provavel: true });
    expect(sistemaDoTribunal(lerCnj("2266041-23.2026.8.26.0000"), null)).toEqual({ sistema: "E-saj", provavel: true });
    expect(sistemaDoTribunal(lerCnj("1001666-18.2026.5.02.0231"), null)).toEqual({ sistema: "pje", provavel: true });
    expect(sistemaDoTribunal(lerCnj("2851405-63.2026.8.13.0000"), null)).toEqual({ sistema: "E-PROC", provavel: true });
    expect(sistemaDoTribunal(lerCnj("5001234-11.2024.8.13.0024"), null)).toEqual({ sistema: "pje", provavel: true });
  });

  it("órgão, justiça e fase com a grafia do VIOS (CIs 61365 e 61361)", () => {
    expect(orgaoDoVios(lerCnj("2266041-23.2026.8.26.0000"))).toBe("Tribunal de Justiça do Estado de São Paulo");
    expect(orgaoDoVios(lerCnj("1001666-18.2026.5.02.0231"))).toBe("TRT2 - Tribunal Regional do Trabalho da 2ª Região");
    expect(orgaoDoVios(lerCnj("2851405-63.2026.8.13.0000"))).toBe("Tribunal de Justiça do Estado de Minas Gerais");
    expect(lerCnj("1001666-18.2026.5.02.0231")?.justica).toBe("Justiça Trabalhista");
    expect(faseDoVios(lerCnj("2266041-23.2026.8.26.0000"), "AGRAVO DE INSTRUMENTO", "Agravo de instrumento")).toEqual({ fase: "Recursal", certa: true });
    expect(faseDoVios(lerCnj("1001666-18.2026.5.02.0231"), "CUMPRIMENTO DE SENTENÇA", "Cumprimento de sentença")).toEqual({ fase: "Execução", certa: true });
    expect(faseDoVios(lerCnj("1001666-18.2026.5.02.0231"), "AÇÃO TRABALHISTA - RITO ORDINÁRIO", "Reclamação Trabalhista")).toEqual({ fase: "Conhecimento", certa: false });
  });

  it("matéria da lista do VIOS pela folha do assunto (e-SAJ manda o caminho, DataJud a folha)", () => {
    const materias = ["FALENCIA", "RECUPERACAO JUDICIAL E FALENCIA", "HABILITACAO DE CREDITO"];
    expect(materiaDoVios(["DIREITO CIVIL - Empresas - Recuperação judicial e Falência"], materias)).toBe("RECUPERACAO JUDICIAL E FALENCIA");
    expect(materiaDoVios(["Habilitação de Crédito"], materias)).toBe("HABILITACAO DE CREDITO");
    expect(materiaDoVios(["Indenização por Dano Moral"], materias)).toBeNull();
  });

  it("acha o cliente entre as partes mesmo com o nome diferente do VIOS", () => {
    const capa = capaDoDjen(DJEN_AGRAVO);
    expect(parteDoCliente("Lira Alimentos Industria e Comercio Ltda", capa)).toEqual({ nome: "LIRA ALIMENTOS EIRELI", polo: "P" });
    expect(parteDoCliente("Biracril Intermediacao e Participacao Societaria Ltda", capa)).toBeNull();
  });
});

describe("montarCapa", () => {
  const base = {
    numero: "2266041-23.2026.8.26.0000",
    djen: capaDoDjen(DJEN_AGRAVO),
    esaj: lerCapaDoEsaj(ESAJ_2G),
    datajud: null,
    area: "Insolvência",
    grupo: "Lira",
    cliente: "Lira Alimentos Industria e Comercio Ltda",
    par: { responsavel: "Manuela Lutke", auxiliar: "Pedro Vittale Rossi", pastas: 4 },
  };
  const listas = { materias: ["FALENCIA", "RECUPERACAO JUDICIAL E FALENCIA"], sistemas: ["E-saj", "E-PROC", "pje"], usuarios: [] };

  it("bate com a capa que a Central abriu no VIOS (CI 61365)", () => {
    const campos = montarCapa(base, { listas });
    const v = (chave: ChaveDaCapa) => valorDe(campos, chave)?.valor;
    expect(v("jurisdicao")).toBe("SEGUNDO GRAU");
    expect(v("justica")).toBe("Justiça Estadual");
    expect(v("orgao")).toBe("Tribunal de Justiça do Estado de São Paulo");
    expect(v("cidade")).toBe("São Paulo");
    expect(v("vara")).toBe("2ª");
    expect(v("tipoVara")).toBe("Câmara Reservada de Direito Empresarial");
    expect(v("acao")).toBe("Agravo de instrumento");
    expect(v("fase")).toBe("Recursal");
    expect(v("sistema")).toBe("E-saj");
    expect(v("valor")).toBe("729.764,00");
    expect(valorDe(campos, "valor")?.fonte).toBe("esaj");
    expect(v("polo")).toBe("Passivo");
    expect(v("tipoParteAtiva")).toBe("Agravante");
    expect(v("tipoPartePassiva")).toBe("Agravado");
    expect(v("escritorio")).toBe("BISMARCHI PIRES SOCIEDADE DE ADVOGADOS");
    expect(v("departamento")).toBe("Insolvência");
    expect(v("responsavel")).toBe("Manuela Lutke");
    expect(v("auxiliar")).toBe("Pedro Vittale Rossi");
    expect(v("etiqueta")).toBe("Carteira Lira");
    expect(v("advogadoContrario")).toBe("JULIO MATUCH DE CARVALHO");
    expect(v("oabContrario")).toBe("98885/RJ");
    expect(v("situacao")).toBe("Ativo");
    expect(v("materias")).toBe("RECUPERACAO JUDICIAL E FALENCIA");
  });

  it("os 21 obrigatórios do VIOS estão na capa; o que falta aparece no resumo", () => {
    expect(montarCapa(base, { listas }).filter((campo) => campo.obrigatorio)).toHaveLength(21);
    expect(resumoDaCapa(montarCapa(base, { listas })).faltando).toEqual([]);
    // Sem pasta viva do grupo na área, faltam o responsável e o auxiliar.
    const { faltando } = resumoDaCapa(montarCapa({ ...base, par: null }, { listas }));
    expect(faltando.map((campo) => campo.chave)).toEqual(["responsavel", "auxiliar"]);
  });

  it("a edição da controladoria vale por cima da fonte e guarda o valor de antes", () => {
    const ajuste = { valor: "1.000,00", por: "u1", porNome: "Maria Ponce", em: "2026-11-10T18:00:00.000Z" };
    const valor = valorDe(montarCapa(base, { ajustes: { valor: ajuste } }), "valor");
    expect(valor).toMatchObject({ valor: "1.000,00", fonte: "editado", conferir: false, original: { valor: "729.764,00", fonte: "esaj" }, editado: { por: "Maria Ponce" } });
    const apagado = valorDe(montarCapa(base, { ajustes: { cliente: { ...ajuste, valor: null } } }), "cliente");
    expect(apagado).toMatchObject({ valor: null, fonte: "editado", conferir: true });
  });

  it("demanda de risco leva a etiqueta; sem e-SAJ nem DataJud, a data vem da lista de distribuição do DJEN", () => {
    const djen = capaDoDjen([
      { ...DJEN_AGRAVO[0], data_disponibilizacao: "2026-11-09", tipoComunicacao: "Intimação" },
      { ...DJEN_AGRAVO[1], data_disponibilizacao: "2026-11-06", tipoComunicacao: "Lista de distribuição" },
    ]);
    const campos = montarCapa({ ...base, esaj: null, djen, demandaRisco: true });
    expect(valorDe(campos, "etiqueta")?.valor).toBe("Carteira Lira; Demanda de risco");
    expect(valorDe(campos, "dataAcao")).toMatchObject({ valor: "06/11/2026", fonte: "djen", conferir: true });
  });

  it("sem valor em nenhuma fonte, vai R$ 0,01 para corrigir depois", () => {
    const valor = valorDe(montarCapa({ ...base, esaj: null }), "valor");
    expect(valor).toMatchObject({ valor: "0,01", fonte: "regra", conferir: true });
  });

  it("campo sem fonte fica marcado como falta e para conferir", () => {
    const responsavel = valorDe(montarCapa({ ...base, par: null }), "responsavel");
    expect(responsavel).toMatchObject({ valor: null, fonte: "falta", conferir: true });
  });

  it("Cível | Insolvência fica no departamento Insolvência; o DataJud completa a data da ação", () => {
    const campos = montarCapa({
      ...base,
      numero: "4048327-46.2026.8.26.0114",
      esaj: null,
      area: "Cível | Insolvência",
      datajud: { achou: true, erro: null, sistema: "Eproc", ajuizamento: "20261020120000", assuntos: ["Habilitação de Crédito"], classe: null },
    });
    expect(valorDe(campos, "departamento")?.valor).toBe("Insolvência");
    expect(valorDe(campos, "dataAcao")).toMatchObject({ valor: "20/10/2026", fonte: "datajud" });
    expect(valorDe(campos, "sistema")).toMatchObject({ valor: "E-PROC", fonte: "datajud", conferir: false });
    expect(valorDe(campos, "jurisdicao")?.valor).toBe("PRIMEIRO GRAU");
  });
});
