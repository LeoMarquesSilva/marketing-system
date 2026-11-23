import { describe, expect, it } from "vitest";
import { montarPublicacoes } from "./captura";
import { lerComunicacaoDjen } from "./djen";
import { lerPublicacoesColadas, tribunalDoCnj } from "./importacao-texto";
import { lerPublicacao } from "./leitura";
import { normalizarTribunal } from "./tribunal";

/** Corpo do e-mail "Recorte Digital OAB/SP" como sai ao copiar do Outlook (nomes e números fictícios). */
function blocoRecorte(intimado: string, id: number): string {
  return `Data de Disponibilização: 04/11/2026
Data de Publicação:05/11/2026
Jornal: Diário da Justiça do Estado de SÃO PAULO
Página: 00001
Caderno: TRT2DJEN
Local: DJEN - Diário de Justiça Eletrônico Nacional - TRT2  SAO PAULO
Vara: 11ª Vara do Trabalho de Sao Paulo

Publicação: Intimação

Notificação
PROCESSO: 1000200-04.2025.5.02.0011 - AcaO TRABALHISTA - RITO ORDINaRIO - || PODER JUDICIARIO JUSTICA DO TRABALHO 11ª VARA DO TRABALHO DE SAO PAULO ATOrd 1000200-04.2025.5.02.0011 RECLAMANTE: ANA EXEMPLO RECLAMADO: EMPRESA FICTICIA LTDA E OUTROS (1) INTIMACAO Fica V. Sa. intimado para tomar ciencia da Decisao ID 9b24d70 proferida nos autos. DECISAO Vistos, recebo o Recurso Ordinario interposto pela parte autora (Id c99140f), determinando seu processamento, com intimacao da parte contraria. SAO PAULO/SP, 03 de novembro de 2026. JUIZ FICTICIO Juiz do Trabalho Substituto Intimado (s) / Citado (s) - ${intimado} ||| POLO ATIVO: ANA EXEMPLO POLO PASSIVO: EMPRESA FICTICIA LTDA POLO PASSIVO: OUTRA EMPRESA S.A ADVOGADO: ADVOGADO DA AUTORA - OAB: 111111/SP ADVOGADO: ADVOGADA DA EMPRESA - OAB: 222222/SP Acesso ao documento: https://pje.trt2.jus.br/pjekz/validacao/26110313245201300000496799315?instancia=1 Identificador do documento: ${id}`;
}

const RECORTE = `Prezados, bom dia.

Segue publicações.

--
Att
Fulana

${blocoRecorte("ANA EXEMPLO", 775157494)}

Publicação: 3.

${blocoRecorte("EMPRESA FICTICIA LTDA - OUTRA EMPRESA S.A", 775157522)}
`;

/** Acórdão de turma no Recorte: sem "Vara:" e sem o rótulo "Publicação:" antes do texto (nomes e números fictícios). */
const ACORDAO = `Data de Disponibilização: 05/11/2026
Data de Publicação: 06/11/2026
Jornal: Diário Oficial DJ Rio de Janeiro
Caderno: TRT1DJEN
Local: DJEN - Diário de Justiça Eletrônico Nacional - TRT1   - 1ª Turma
Página: 00001
Intimação

Acórdão
PROCESSO: 0100000-16.2025.5.01.0062 - RECURSO ORDINaRIO TRABALHISTA - || PODER JUDICIARIO JUSTICA DO TRABALHO TRIBUNAL REGIONAL DO TRABALHO DA 1ª REGIAO ROT 0100000-16.2025.5.01.0062 DESTINATARIO: TRANSPORTADORA FICTICIA LTDA INTIMACAO Fica V. Sa. intimado para tomar ciencia do v. Acordao proferido nos autos. Recursos ordinarios conhecidos e nao providos. RIO DE JANEIRO/RJ, 04 de novembro de 2026. SERVIDORA FICTICIA Intimado (s) / Citado (s) - TRANSPORTADORA FICTICIA LTDA ||| POLO ATIVO: LOGISTICA EXEMPLO LTDA POLO PASSIVO: JOSE EXEMPLO POLO PASSIVO: TRANSPORTADORA FICTICIA LTDA ADVOGADO: ADVOGADO FICTICIO - OAB: 058532/RJ ADVOGADO: ADVOGADA FICTICIA - OAB: 439972/SP Acesso ao documento: https://pje.trt1.jus.br/pjekz/validacao/26110412344297200000000000000?instancia=2 Identificador do documento: 776000001`;

/** Mensagem repassada no Teams com comunicações do DJEN (nomes e números fictícios). */
const TEAMS = `Pessoal, Bom dia! Tudo bem?

Seguem publicações para inclusão no sistema de vistagem cível, por gentileza.

Superior Tribunal de Justiça - DJN
Vara: SPF COORDENADORIA DE PROCESSAMENTO DE DECISOES ESTRANGEIRAS E RECURSOS PARA O STF - Comarca: NAO CONSTA
Divulgado em: 06/10/2026 - Publicado em: 07/10/2026
Processo: 1008871-72.2024.8.26.0224
Termo encontrado: ADVOGADA DO ESCRITORIO
Diário: STJDJN
Publicação
Processo: 1008871-72.2024.8.26.0224
Órgão: SPF COORDENADORIA DE PROCESSAMENTO DE DECISÕES ESTRANGEIRAS E RECURSOS PARA O STF
Data de disponibilização: 06/10/2026
Tipo de comunicação: Intimação
Meio: Diário de Justiça Eletrônico Nacional
Inteiro teor: https://justica.web.stj.jus.br/api/pcp/documentos/pdf/dinamico/NDAzNDQyNzkwMjAyNjAwMTU0OTAzMTc5MTIx…
Parte: 1. JOAO RECORRENTE (RECORRENTE) Polo: ATIVO
Parte: 2. MARIA RECORRIDA (RECORRIDO) Polo: PASSIVO
Advogado: ADVOGADA DO ESCRITORIO - OAB SP-407663
Advogado: ADVOGADO DA OUTRA PARTE - OAB SP-288112 Classe: AGRAVO EM RECURSO ESPECIAL
Conteúdo: RE nos EDcl no AgInt no AREsp 3151901/SP (2026/0015490-3) RELATOR : MINISTRO VICE-PRESIDENTE DO STJ RECORRENTE : JOAO RECORRENTE Vista à(s) parte(s) recorrida(s) para contrarrazões de Recurso Extraordinário (RE). |comunicacao_id: 747774511|


Publicação
Processo: 1008871-72.2024.8.26.0224
Órgão: COORDENADORIA DE CLASSIFICAÇÃO E DISTRIBUIÇÃO DE PROCESSOS
Data de disponibilização: 06/10/2026
Tipo de comunicação: Intimação
Meio: Diário de Justiça Eletrônico Nacional
Inteiro teor: https://justica.web.stj.jus.br/api/pcp/documentos/pdf/dinamico/NDAzNDQyNzk2MjAyNjAwMTU0OTAzMTc5MTIw…
Parte: 1. JOAO RECORRENTE (AGRAVANTE) Polo: ATIVO
Parte: 2. MARIA RECORRIDA (AGRAVADO) Polo: PASSIVO
Advogado: ADVOGADA DO ESCRITORIO - OAB SP-407663
Advogado: ADVOGADO DA OUTRA PARTE - OAB SP-288112 Classe: AGRAVO EM RECURSO ESPECIAL
Conteúdo: AREsp 3151901/SP (2026/0015490-3) RELATOR : MINISTRO VICE-PRESIDENTE DO STJ AGRAVANTE : JOAO RECORRENTE Processo distribuído pelo sistema automático em 05/10/2026. |comunicacao_id: 747720654|

Muito obrigada!

Atenciosamente,
`;

describe("lerPublicacoesColadas: Recorte Digital da OAB/SP", () => {
  const { publicacoes, ignorados } = lerPublicacoesColadas(RECORTE);

  it("lê cada bloco, sem a saudação e sem a numeração entre eles", () => {
    expect(ignorados).toEqual([]);
    expect(publicacoes).toHaveLength(2);
    const [primeira] = publicacoes;
    expect(primeira).toMatchObject({
      formato: "recorte",
      processo: "1000200-04.2025.5.02.0011",
      tribunal: "TRT2",
      orgao: "11ª Vara do Trabalho de Sao Paulo",
      tipoComunicacao: "Intimação",
      idComunicacao: 775157494,
      intimados: ["ANA EXEMPLO"],
    });
    expect(primeira.linha).toMatchObject({ linha: 1, dataDivulgacao: "2026-11-04", dataPublicacao: "2026-11-05", diario: "TRT2_DJEN", caderno: "TRT2DJEN" });
    expect(publicacoes[1].intimados).toEqual(["EMPRESA FICTICIA LTDA", "OUTRA EMPRESA S.A"]);
    expect(publicacoes[1].linha.linha).toBe(2);
  });

  it("monta o teor no formato do DJEN da Kurier (órgão, partes, advogados, intimados)", () => {
    const djen = lerComunicacaoDjen(publicacoes[0].linha.teor);
    expect(djen).toMatchObject({
      idComunicacao: 775157494,
      orgao: "11ª Vara do Trabalho de Sao Paulo",
      dataDisponibilizacao: "2026-11-04",
      tipoComunicacao: "Intimação",
      tribunal: "TRT2",
      intimados: ["ANA EXEMPLO"],
      partes: [
        { nome: "ANA EXEMPLO", polo: "A", idComunicacao: 775157494 },
        { nome: "EMPRESA FICTICIA LTDA", polo: "P", idComunicacao: 775157494 },
        { nome: "OUTRA EMPRESA S.A", polo: "P", idComunicacao: 775157494 },
      ],
      advogados: [
        { nome: "ADVOGADO DA AUTORA", oab: "111111", uf: "SP" },
        { nome: "ADVOGADA DA EMPRESA", oab: "222222", uf: "SP" },
      ],
    });
    expect(djen?.corpo).toMatch(/^PODER JUDICIARIO JUSTICA DO TRABALHO/);
    expect(djen?.corpo).toMatch(/Acesso ao documento: https:\/\/pje\.trt2\.jus\.br\/\S+$/);
    expect(lerPublicacao(publicacoes[0].linha.teor).classe).toMatch(/^Notificação Ac[aã]o Trabalhista/i);
    expect(normalizarTribunal(publicacoes[0].linha.diario)).toEqual({ sigla: "TRT2", justica: "trabalhista" });
  });

  it("a cópia para o outro intimado vira duplicidade da primeira, como na Kurier", () => {
    const capturadas = montarPublicacoes(publicacoes.map((p) => p.linha));
    expect(capturadas.map((p) => p.status)).toEqual(["captada", "duplicidade"]);
    expect(capturadas[1].duplicidadeDeLinha).toBe(1);
    expect(capturadas[0].tribunal).toEqual({ sigla: "TRT2", justica: "trabalhista" });
    expect(capturadas[0].processo.cnj).toBe("1000200-04.2025.5.02.0011");
  });

  it("aceita rótulos grudados (texto copiado sem quebras de linha)", () => {
    const grudado = blocoRecorte("ANA EXEMPLO", 1).replace(/\n+/g, "").replace("Data de Publicação:", "Data de Publicação:");
    const [publicacao] = lerPublicacoesColadas(grudado).publicacoes;
    expect(publicacao).toMatchObject({ tribunal: "TRT2", orgao: "11ª Vara do Trabalho de Sao Paulo" });
    expect(publicacao.linha).toMatchObject({ dataDivulgacao: "2026-11-04", dataPublicacao: "2026-11-05" });
  });

  it("lê o acórdão de turma, que vem sem o rótulo \"Publicação:\" e sem \"Vara:\"", () => {
    const { publicacoes: lidas, ignorados: fora } = lerPublicacoesColadas(`Publicação: 1.

${ACORDAO}`);
    expect(fora).toEqual([]);
    expect(lidas).toHaveLength(1);
    expect(lidas[0]).toMatchObject({
      formato: "recorte",
      processo: "0100000-16.2025.5.01.0062",
      tribunal: "TRT1",
      orgao: "1ª Turma",
      tipoComunicacao: "Intimação",
      idComunicacao: 776000001,
      intimados: ["TRANSPORTADORA FICTICIA LTDA"],
    });
    expect(lidas[0].linha).toMatchObject({ dataDivulgacao: "2026-11-05", dataPublicacao: "2026-11-06", diario: "TRT1_DJEN", caderno: "TRT1DJEN" });
    const djen = lerComunicacaoDjen(lidas[0].linha.teor);
    expect(djen?.corpo).toMatch(/^PODER JUDICIARIO JUSTICA DO TRABALHO TRIBUNAL REGIONAL DO TRABALHO DA 1ª REGIAO/);
    expect(djen?.partes.map((parte) => parte.polo)).toEqual(["A", "P", "P"]);
    expect(djen?.advogados).toEqual([
      { nome: "ADVOGADO FICTICIO", oab: "058532", uf: "RJ" },
      { nome: "ADVOGADA FICTICIA", oab: "439972", uf: "SP" },
    ]);
    expect(normalizarTribunal(lidas[0].linha.diario)).toEqual({ sigla: "TRT1", justica: "trabalhista" });
  });

  it("acórdão e publicação de vara no mesmo e-mail", () => {
    const { publicacoes: lidas, ignorados: fora } = lerPublicacoesColadas(`Publicação: 1.

${ACORDAO}

Publicação: 2.

${blocoRecorte("ANA EXEMPLO", 775157494)}`);
    expect(fora).toEqual([]);
    expect(lidas.map((p) => [p.processo, p.orgao])).toEqual([
      ["0100000-16.2025.5.01.0062", "1ª Turma"],
      ["1000200-04.2025.5.02.0011", "11ª Vara do Trabalho de Sao Paulo"],
    ]);
  });

  it("acórdão copiado sem quebras de linha", () => {
    const [publicacao] = lerPublicacoesColadas(ACORDAO.replace(/\n+/g, " ")).publicacoes;
    expect(publicacao).toMatchObject({ processo: "0100000-16.2025.5.01.0062", tribunal: "TRT1", orgao: "1ª Turma" });
    expect(publicacao.linha).toMatchObject({ dataDivulgacao: "2026-11-05", dataPublicacao: "2026-11-06" });
  });

  it("aponta o bloco sem data de publicação em vez de importar pela metade", () => {
    const { publicacoes: lidas, ignorados: fora } = lerPublicacoesColadas(blocoRecorte("ANA EXEMPLO", 1).replace("Data de Publicação:05/11/2026", ""));
    expect(lidas).toEqual([]);
    expect(fora).toEqual([expect.objectContaining({ motivo: "sem a data de publicação" })]);
  });
});

describe("lerPublicacoesColadas: DJEN repassado no Teams", () => {
  const { publicacoes, ignorados } = lerPublicacoesColadas(TEAMS);

  it("lê as duas comunicações com as datas e o diário do cabeçalho", () => {
    expect(ignorados).toEqual([]);
    expect(publicacoes).toHaveLength(2);
    expect(publicacoes[0]).toMatchObject({
      formato: "djen",
      processo: "1008871-72.2024.8.26.0224",
      tribunal: "STJ",
      orgao: "SPF COORDENADORIA DE PROCESSAMENTO DE DECISÕES ESTRANGEIRAS E RECURSOS PARA O STF",
      tipoComunicacao: "Intimação",
      idComunicacao: 747774511,
    });
    expect(publicacoes[0].linha).toMatchObject({
      dataDivulgacao: "2026-10-06",
      dataPublicacao: "2026-10-07",
      diario: "STJ_DJEN",
      nomeLocalizado: "ADVOGADA DO ESCRITORIO",
      comarca: "",
    });
    expect(publicacoes[1]).toMatchObject({ orgao: "COORDENADORIA DE CLASSIFICAÇÃO E DISTRIBUIÇÃO DE PROCESSOS", idComunicacao: 747720654 });
  });

  it("separa partes, advogados e classe, e não guarda o link cortado pelo Teams", () => {
    const djen = lerComunicacaoDjen(publicacoes[0].linha.teor);
    expect(djen?.partes).toEqual([
      { nome: "JOAO RECORRENTE", polo: "A", idComunicacao: 747774511 },
      { nome: "MARIA RECORRIDA", polo: "P", idComunicacao: 747774511 },
    ]);
    expect(djen?.advogados).toEqual([
      { nome: "ADVOGADA DO ESCRITORIO", oab: "407663", uf: "SP" },
      { nome: "ADVOGADO DA OUTRA PARTE", oab: "288112", uf: "SP" },
    ]);
    expect(djen?.corpo).toBe(
      "RE nos EDcl no AgInt no AREsp 3151901/SP (2026/0015490-3) RELATOR : MINISTRO VICE-PRESIDENTE DO STJ RECORRENTE : JOAO RECORRENTE Vista à(s) parte(s) recorrida(s) para contrarrazões de Recurso Extraordinário (RE)."
    );
    expect(lerPublicacao(publicacoes[0].linha.teor).classe).toMatch(/^Agravo em Recurso Especial$/i);
  });

  it("comunicações diferentes do mesmo processo seguem as duas para a vistagem", () => {
    const capturadas = montarPublicacoes(publicacoes.map((p) => p.linha));
    expect(capturadas.map((p) => p.status)).toEqual(["captada", "captada"]);
    expect(capturadas[0].tribunal).toEqual({ sigla: "STJ", justica: "superior" });
  });

  it("guarda o link do inteiro teor quando vem inteiro", () => {
    const inteiro = TEAMS.replace("NDAzNDQyNzkwMjAyNjAwMTU0OTAzMTc5MTIx…", "ABC123");
    const djen = lerComunicacaoDjen(lerPublicacoesColadas(inteiro).publicacoes[0].linha.teor);
    expect(djen?.corpo).toMatch(/Inteiro teor: https:\/\/justica\.web\.stj\.jus\.br\/api\/pcp\/documentos\/pdf\/dinamico\/ABC123$/);
  });

  it("um cabeçalho novo vale para as comunicações que vêm depois dele", () => {
    const outro = `${TEAMS}
Tribunal de Justiça - DJN
Divulgado em: 03/11/2026 - Publicado em: 04/11/2026
Diário: TJSPDJN
Publicação
Processo: 0001234-56.2020.8.26.0100
Órgão: 1ª Vara Cível
Data de disponibilização: 03/11/2026
Tipo de comunicação: Intimação
Conteúdo: Manifeste-se a parte autora. |comunicacao_id: 700000001|
`;
    const lidas = lerPublicacoesColadas(outro).publicacoes;
    expect(lidas).toHaveLength(3);
    expect(lidas[2]).toMatchObject({ tribunal: "TJSP", processo: "0001234-56.2020.8.26.0100" });
    expect(lidas[2].linha).toMatchObject({ dataDivulgacao: "2026-11-03", dataPublicacao: "2026-11-04", diario: "TJSP_DJEN" });
  });
});

/** Publicação do DJEN repassada por e-mail, tudo numa linha, como chega colada (nomes e números fictícios). */
function blocoFonte(processo: string, id: number): string {
  return `Processo: ${processo} Data da Disponibilização: 19/11/2026 Data da Publicação: 23/11/2026 Fonte: Tribunal Regional do Trabalho - 2ª Região - SP - DJEN - 11ª Vara do Trabalho de Guarulhos Notificação - Intimação PROCESSO: ${processo} - AcaO TRABALHISTA - RITO ORDINaRIO PODER JUDICIARIO JUSTICA DO TRABALHO TRIBUNAL REGIONAL DO TRABALHO DA 2ª REGIAO 11ª VARA DO TRABALHO DE GUARULHOS ATOrd ${processo} RECLAMANTE: ANA EXEMPLO RECLAMADO: TRANSPORTADORA FICTICIA LTDA INTIMACAO Fica V. Sa. intimado para tomar ciencia da Decisao ID 904701a proferida nos autos. DESPACHO Vistos. Transfira-se o deposito para os autos da Carta de Sentenca. GUARULHOS/SP, 18 de novembro de 2026. JUIZA FICTICIA Juiza do Trabalho Titular Intimado (s) / Citado (s) - ANA EXEMPLO POLO ATIVO: ADVOGADO DA AUTORA POLO ATIVO: ANA EXEMPLO POLO PASSIVO: TRANSPORTADORA FICTICIA LTDA ADVOGADO: ADVOGADO DA AUTORA - OAB: 111111/SP ADVOGADO: ADVOGADA DA EMPRESA - OAB: 222222/SP Acesso ao documento: https://pje.trt2.jus.br/pjekz/validacao/26111819102720800000500000000?instancia=1 Identificador do documento: ${id}`;
}

describe("lerPublicacoesColadas: e-mail do DJEN com \"Fonte:\" (pedido de 19/11/2026)", () => {
  const { publicacoes, ignorados } = lerPublicacoesColadas(blocoFonte("1001000-70.2025.5.02.0321", 792900001));

  it("lê o processo, as datas, o tribunal e o órgão da fonte, e o tipo que abre o texto", () => {
    expect(ignorados).toEqual([]);
    expect(publicacoes).toHaveLength(1);
    expect(publicacoes[0]).toMatchObject({
      formato: "fonte",
      processo: "1001000-70.2025.5.02.0321",
      tribunal: "TRT2",
      orgao: "11ª Vara do Trabalho de Guarulhos",
      tipoComunicacao: "Intimação",
      idComunicacao: 792900001,
      intimados: ["ANA EXEMPLO"],
    });
    expect(publicacoes[0].linha).toMatchObject({ dataDivulgacao: "2026-11-19", dataPublicacao: "2026-11-23", diario: "TRT2_DJEN" });
  });

  it("monta o teor no formato do DJEN da Kurier (texto, partes, advogados, link)", () => {
    const djen = lerComunicacaoDjen(publicacoes[0].linha.teor);
    expect(djen).toMatchObject({ idComunicacao: 792900001, orgao: "11ª Vara do Trabalho de Guarulhos", dataDisponibilizacao: "2026-11-19", intimados: ["ANA EXEMPLO"] });
    expect(djen?.partes.map((parte) => [parte.nome, parte.polo])).toEqual([
      ["ADVOGADO DA AUTORA", "A"],
      ["ANA EXEMPLO", "A"],
      ["TRANSPORTADORA FICTICIA LTDA", "P"],
    ]);
    expect(djen?.advogados).toEqual([
      { nome: "ADVOGADO DA AUTORA", oab: "111111", uf: "SP" },
      { nome: "ADVOGADA DA EMPRESA", oab: "222222", uf: "SP" },
    ]);
    expect(djen?.corpo).toMatch(/^PODER JUDICIARIO JUSTICA DO TRABALHO/);
    expect(djen?.corpo).toMatch(/Juiza do Trabalho Titular Acesso ao documento: https:\/\/pje\.trt2\.jus\.br\/\S+$/);
    expect(lerPublicacao(publicacoes[0].linha.teor).classe).toMatch(/^Notificação Ac[aã]o Trabalhista/i);
    expect(montarPublicacoes(publicacoes.map((p) => p.linha)).map((p) => p.status)).toEqual(["captada"]);
  });

  it("o mesmo e-mail com quebras de linha", () => {
    const comQuebras = blocoFonte("1001000-70.2025.5.02.0321", 792900001)
      .replace(" Data da Disponibilização", "\nData da Disponibilização")
      .replace(" Data da Publicação", "\nData da Publicação")
      .replace(" Fonte:", "\nFonte:")
      .replace(" Notificação - Intimação ", "\nNotificação - Intimação\n");
    const [publicacao] = lerPublicacoesColadas(comQuebras).publicacoes;
    expect(publicacao).toMatchObject({ formato: "fonte", tribunal: "TRT2", orgao: "11ª Vara do Trabalho de Guarulhos", tipoComunicacao: "Intimação" });
    expect(publicacao.linha).toMatchObject({ dataDivulgacao: "2026-11-19", dataPublicacao: "2026-11-23" });
  });

  it("várias publicações no mesmo e-mail, com saudação e assinatura", () => {
    const email = `Bom dia, seguem publicações.

${blocoFonte("1001000-70.2025.5.02.0321", 792900001)}

${blocoFonte("1002000-11.2025.5.02.0322", 792900002)}

Att,
Fulana`;
    const lidas = lerPublicacoesColadas(email);
    expect(lidas.ignorados).toEqual([]);
    expect(lidas.publicacoes.map((p) => [p.processo, p.idComunicacao])).toEqual([
      ["1001000-70.2025.5.02.0321", 792900001],
      ["1002000-11.2025.5.02.0322", 792900002],
    ]);
  });

  it("tribunal pelo nome da fonte, não pelo número (o STJ publica com o número do processo de origem)", () => {
    const stj = blocoFonte("1008871-72.2024.8.26.0224", 1).replace(
      "Tribunal Regional do Trabalho - 2ª Região - SP - DJEN - 11ª Vara do Trabalho de Guarulhos",
      "Superior Tribunal de Justiça - DJEN - COORDENADORIA DE PROCESSAMENTO"
    );
    expect(lerPublicacoesColadas(stj).publicacoes[0]).toMatchObject({ tribunal: "STJ", orgao: "COORDENADORIA DE PROCESSAMENTO" });
  });

  it("aponta a publicação sem data de publicação em vez de importar pela metade", () => {
    const { publicacoes: lidas, ignorados: fora } = lerPublicacoesColadas(blocoFonte("1001000-70.2025.5.02.0321", 1).replace("Data da Publicação: 23/11/2026 ", ""));
    expect(lidas).toEqual([]);
    expect(fora).toEqual([expect.objectContaining({ motivo: "sem a data de publicação" })]);
  });
});

describe("lerPublicacoesColadas: texto sem publicação", () => {
  it("explica o que aceita", () => {
    const { publicacoes, ignorados } = lerPublicacoesColadas("Bom dia, segue em anexo.");
    expect(publicacoes).toEqual([]);
    expect(ignorados[0].motivo).toMatch(/nenhuma publicação reconhecida/);
  });

  it("texto vazio não aponta nada", () => {
    expect(lerPublicacoesColadas("   \n ")).toEqual({ publicacoes: [], ignorados: [] });
  });
});

describe("tribunalDoCnj", () => {
  it("lê J.TR do número", () => {
    expect(tribunalDoCnj("10002000420255020011")).toBe("TRT2");
    expect(tribunalDoCnj("10088717220248260224")).toBe("TJSP");
    expect(tribunalDoCnj("00012345620205000000")).toBe("TST");
    expect(tribunalDoCnj("00012345620204030000")).toBe("TRF3");
    expect(tribunalDoCnj("00012345620209990000")).toBeNull();
  });
});
