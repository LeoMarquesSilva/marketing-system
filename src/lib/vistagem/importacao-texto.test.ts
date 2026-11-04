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
