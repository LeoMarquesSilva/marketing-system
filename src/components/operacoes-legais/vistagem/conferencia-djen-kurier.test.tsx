import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ComunicacaoDjenGuardada, ConferenciaDjenKurier, DetalheDoDia, PublicacaoKurier } from "@/lib/vistagem/djen-kurier";
import { ConferenciaDjenKurierView, DetalheDoDiaView } from "./conferencia-djen-kurier";

const DADOS: ConferenciaDjenKurier = {
  dias: [
    { data: "2026-11-12", buscado: true, comKurier: false, emAberto: true, djen: 115, kurier: 0, doBkp: 0, nosDois: 0, soDjen: 0, soKurier: 0, cobertura: null },
    { data: "2026-11-11", buscado: true, comKurier: true, emAberto: false, djen: 3, kurier: 2, doBkp: 1, nosDois: 1, soDjen: 1, soKurier: 1, cobertura: 0.5 },
    { data: "2026-11-09", buscado: true, comKurier: false, emAberto: false, djen: 120, kurier: 0, doBkp: 0, nosDois: 0, soDjen: 0, soKurier: 0, cobertura: null },
    { data: "2026-11-10", buscado: false, comKurier: true, emAberto: false, djen: 0, kurier: 4, doBkp: 0, nosDois: 0, soDjen: 0, soKurier: 0, cobertura: null },
    { data: "2026-11-13", buscado: true, comKurier: true, emAberto: true, djen: 5, kurier: 3, doBkp: 0, nosDois: 3, soDjen: 0, soKurier: 0, cobertura: 1 },
  ],
  totais: { djen: 3, kurier: 2, nosDois: 1, soDjen: 1, soKurier: 1, cobertura: 0.5 },
  ultimaBusca: { em: "2026-11-11T11:00:00.000Z", origem: "cron", erro: null },
  erroBkp: null,
};

const comunicacao = (id: number, processo: string, extra: Partial<ComunicacaoDjenGuardada> = {}): ComunicacaoDjenGuardada => ({
  id,
  data: "2026-11-11",
  processo,
  tribunal: "TJSP",
  tipo: "Intimação",
  orgao: "1ª Vara Cível",
  classe: null,
  advogados: ["275477/SP"],
  ativo: true,
  link: "https://comunica.pje.jus.br/x",
  ...extra,
});
const publicacao = (id: string, processo: string, extra: Partial<PublicacaoKurier> = {}): PublicacaoKurier => ({
  id,
  djenId: null,
  data: "2026-11-11",
  processo,
  tribunal: "TJSP",
  nomeLocalizado: "GUSTAVO BISMARCHI MOTTA",
  status: "juridico_vistar",
  fonte: "orquestra",
  arquivo: "2026-11-12",
  ...extra,
});

const DETALHE: DetalheDoDia = {
  resumo: DADOS.dias[1],
  pares: [
    { kurier: publicacao("k1", "1111111-11.2026.8.26.0100", { djenId: 101 }), djen: [comunicacao(101, "1111111-11.2026.8.26.0100")], como: "id" },
    {
      kurier: publicacao("bkp:5", "2222222-22.2026.8.26.0100", { fonte: "bkp", status: "CIÊNCIA NF", nomeLocalizado: null, arquivo: "2026-11-11" }),
      djen: [comunicacao(201, "2222222-22.2026.8.26.0100"), comunicacao(202, "2222222-22.2026.8.26.0100")],
      como: "bkp",
    },
  ],
  soKurier: [
    {
      kurier: publicacao("k9", "5555555-55.2026.5.02.0001", { djenId: 999, tribunal: "TRT2", nomeLocalizado: "RICARDO VISCARDI PIRES", status: "descartada" }),
      djenEmOutrosDias: ["2026-11-10"],
    },
  ],
  soDjen: [
    {
      djen: comunicacao(777, "0000379-29.2019.5.12.0029", { tribunal: "TRT12", tipo: "Lista de distribuição", advogados: ["275477/SP", "353389/SP"] }),
      kurierEmOutrosDias: [],
    },
  ],
  arquivos: [
    { arquivo: "2026-11-11", quantas: 1 },
    { arquivo: "2026-11-12", quantas: 2 },
    { arquivo: "BKP", quantas: 1 },
  ],
  erroBkp: null,
};

const semTags = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const tela = (props: Partial<Parameters<typeof ConferenciaDjenKurierView>[0]> = {}) =>
  semTags(
    renderToStaticMarkup(
      <ConferenciaDjenKurierView
        dados={DADOS}
        erro=""
        periodo="14"
        onPeriodo={vi.fn()}
        buscando={false}
        onBuscarAgora={vi.fn()}
        aberto={null}
        onAbrir={vi.fn()}
        {...props}
      />
    )
  );

describe("ConferenciaDjenKurierView", () => {
  it("mostra a cobertura, os totais, o quadro por dia e a última busca", () => {
    const texto = tela();
    expect(texto).toContain("Conferência DJEN × Kurier");
    expect(texto).toContain("Não muda nada no fluxo das publicações");
    expect(texto).toContain("Gustavo Bismarchi Motta (OAB 275477/SP)");
    expect(texto).toContain("Ricardo Viscardi Pires (OAB 353389/SP)");
    expect(texto).toContain("50%");
    expect(texto).toContain("1 de 2 publicações da Kurier também no DJEN");
    expect(texto).toContain("11/nov qua");
    expect(texto).toContain("sem busca no DJEN");
    expect(texto).toContain("sem Kurier");
    expect(texto).toContain("aguardando a Kurier");
    expect(texto).toContain("em aberto");
    expect(texto).toContain("BKP 1");
    expect(texto).toContain("O estudo começa em 01/10/2026");
    expect(texto).toContain("as publicações do arquivo de hoje aparecem na linha de ontem");
    expect(texto).toContain("A Kurier lida é a da tabela do Orquestra");
    expect(texto).toContain("Desde 01/10");
    expect(texto).toContain("automática");
    expect(texto).not.toContain("Não deu para ler o BKP do SIOE");
  });

  it("avisa quando não deu para ler o BKP do SIOE", () => {
    expect(tela({ dados: { ...DADOS, erroBkp: "timeout" } })).toContain("Não deu para ler o BKP do SIOE (timeout)");
  });

  it("o dia aberto: carregando, com erro e com o detalhe", () => {
    expect(tela({ aberto: "2026-11-11" })).toContain("Separando o que é o quê");
    expect(tela({ aberto: "2026-11-11", erroDetalhe: "Falha ao carregar o dia." })).toContain("Falha ao carregar o dia.");
    expect(tela({ aberto: "2026-11-11", detalhe: DETALHE })).toContain("O que é o quê em 11/nov qua");
  });

  it("enquanto carrega e com erro", () => {
    expect(tela({ dados: null })).toContain("Comparando o DJEN com a Kurier");
    expect(tela({ dados: null, erro: "Falha ao carregar a conferência." })).toContain("Falha ao carregar a conferência.");
  });
});

describe("DetalheDoDiaView", () => {
  const detalhe = (valor: DetalheDoDia = DETALHE) => semTags(renderToStaticMarkup(<DetalheDoDiaView detalhe={valor} />));

  it("diz de onde veio cada lado e abre no que só a Kurier trouxe, com o motivo", () => {
    const texto = detalhe();
    expect(texto).toContain("Nos dois (2)");
    expect(texto).toContain("Só na Kurier (1)");
    expect(texto).toContain("Só no DJEN (1)");
    expect(texto).toContain("3 comunicações disponibilizadas em 11/11");
    expect(texto).toContain("2 publicações divulgadas em 11/11 (1 no arquivo de 11/11, 2 no arquivo de 12/11, 1 do BKP do SIOE)");
    expect(texto).toContain("5555555-55.2026.5.02.0001");
    expect(texto).toContain("Kurier: TRT2 · RICARDO VISCARDI PIRES · ID 999 · Descartada · arquivo de 12/11");
    expect(texto).toContain("Por quê: O DJEN, buscado pela OAB do Gustavo e do Ricardo, não trouxe a comunicação 999. O DJEN trouxe este processo em 10/11.");
  });

  it("nos dois: o par e como casou", () => {
    const texto = detalhe({ ...DETALHE, soKurier: [], soDjen: [] });
    expect(texto).toContain("Kurier: TJSP · GUSTAVO BISMARCHI MOTTA · ID 101");
    expect(texto).toContain("DJEN: TJSP · Intimação · 1ª Vara Cível · GBM · ID 101");
    expect(texto).toContain("Mesmo ID de comunicação nos dois (101).");
    expect(texto).toContain("Kurier: TJSP · BKP do SIOE · CIÊNCIA NF · recebida em 11/11");
    expect(texto).toContain("Do BKP, que não tem o ID: casou pelo processo, no mesmo dia (2 comunicações do DJEN).");
  });

  it("só no DJEN, inclusive no dia que ainda aguarda a Kurier", () => {
    const texto = detalhe({ ...DETALHE, pares: [], soKurier: [] });
    expect(texto).toContain("DJEN: TRT12 · Lista de distribuição · 1ª Vara Cível · GBM + RVP · ID 777");
    expect(texto).toContain("A Kurier não trouxe esta comunicação (nem o ID, nem o processo) neste dia.");

    const aguardando = detalhe({ ...DETALHE, resumo: DADOS.dias[0], pares: [], soKurier: [], arquivos: [] });
    expect(aguardando).toContain("ainda não chegou: o que foi divulgado neste dia vem no próximo arquivo da Kurier");
    expect(aguardando).toContain("A Kurier ainda não trouxe nada deste dia. O dia ainda está em aberto");
  });
});
