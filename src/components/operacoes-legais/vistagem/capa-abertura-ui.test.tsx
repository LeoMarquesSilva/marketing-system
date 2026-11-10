import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CapaParaAbertura } from "@/lib/vistagem/capa-abertura";
import { CapaDaAberturaView, ResumoDaCapaView, type EstadoDataJud } from "./capa-abertura-ui";

// O que a rota devolveu para o agravo 2266041-23 (Grupo Lira) no teste local de 10/11/2026.
const CAPA: CapaParaAbertura = {
  dados: {
    numero: "2266041-23.2026.8.26.0000",
    djen: {
      comunicacoes: 4,
      tribunal: "TJSP",
      orgao: "Unidade de Processamento Judicial de Direito Privado",
      classe: "AGRAVO DE INSTRUMENTO",
      codigoClasse: "202",
      ativas: ["BON MART FRIGORIFICO LTDA"],
      passivas: ["LIRA ALIMENTOS EIRELI"],
      advogados: [{ nome: "JULIO MATUCH DE CARVALHO", oab: "98885", uf: "RJ", doEscritorio: false }],
      distribuicao: "2026-11-06",
      primeiraComunicacao: "2026-11-06",
    },
    esaj: {
      classe: "Agravo de Instrumento",
      assunto: "DIREITO CIVIL - Empresas - Recuperação judicial e Falência",
      foro: null,
      vara: null,
      orgaoJulgador: "2ª Câmara Reservada de Direito Empresarial",
      distribuicao: null,
      valor: 729764,
    },
    datajud: null,
    area: "Insolvência",
    grupo: "Grupo Lira",
    cliente: "Lira Alimentos Industria e Comercio Ltda",
    par: { responsavel: "Manuela Lutke", auxiliar: "Pedro Vittale Rossi", pastas: 40 },
  },
  fontes: { djen: { ok: true, ms: 144, erro: null }, esaj: { ok: true, ms: 586, erro: null } },
  ajustes: {
    valor: { valor: "730.000,00", por: "u1", porNome: "Maria Heloiza Gois Ponce", em: "2026-11-10T18:30:00.000Z" },
  },
  podeEditar: true,
  listas: { usuarios: ["Manuela Lutke", "Pedro Vittale Rossi"], materias: ["RECUPERACAO JUDICIAL E FALENCIA"], sistemas: ["E-saj", "E-PROC", "pje"] },
  geradaEm: "2026-11-10T15:00:00.000Z",
};

const CONSULTANDO: EstadoDataJud = { carregando: true };

const capa = (props: Partial<Parameters<typeof CapaDaAberturaView>[0]> = {}) =>
  renderToStaticMarkup(<CapaDaAberturaView capa={CAPA} datajud={CONSULTANDO} onEditar={vi.fn()} onBuscarDeNovo={vi.fn()} {...props} />);
const resumo = (props: Partial<Parameters<typeof ResumoDaCapaView>[0]> = {}) =>
  renderToStaticMarkup(<ResumoDaCapaView capa={CAPA} erro="" datajud={CONSULTANDO} onAbrir={vi.fn()} onBuscarDeNovo={vi.fn()} {...props} />);

describe("CapaDaAberturaView", () => {
  it("mostra os campos por grupo, com a fonte, o lápis e o asterisco dos obrigatórios", () => {
    const html = capa();
    expect(html).toContain("Capa para a abertura no VIOS");
    expect(html).toContain("nada é gravado no VIOS");
    for (const grupo of ["Processo", "Partes e cliente", "Escritório"]) expect(html).toContain(`aria-label="${grupo}"`);
    expect(html).toContain("Tribunal de Justiça do Estado de São Paulo");
    expect(html).toContain("Manuela Lutke");
    expect(html).toContain("RECUPERACAO JUDICIAL E FALENCIA");
    expect(html).toContain("Editar Valor da ação (R$)");
    expect(html).toContain('aria-label="obrigatório"');
    expect(html).toContain("Pastas do grupo");
    expect(html).toContain("consultando (leva até 1 min)");
    // A lista de usuários do VIOS vira sugestão ao editar.
    expect(html).toContain('id="capa-lista-usuarios"');
  });

  it("o campo editado mostra quem editou, o valor de antes e o Desfazer", () => {
    const html = capa();
    expect(html).toContain("R$ 730.000,00");
    expect(html).toContain("Editado por Maria Heloiza Gois Ponce");
    expect(html).toContain("antes: 729.764,00");
    expect(html).toContain("Desfazer");
    expect(html).toContain("1 editado(s)");
  });

  it("obrigatório vazio fica destacado e conta no topo", () => {
    const html = capa({ capa: { ...CAPA, dados: { ...CAPA.dados, par: null } } });
    expect(html).toContain("2 obrigatório(s) vazio(s)");
    expect(html).toContain("Obrigatório: preencher");
  });

  it("sem a coluna das edições no banco, avisa e trava o lápis", () => {
    const html = capa({ capa: { ...CAPA, podeEditar: false } });
    expect(html).toContain("Por enquanto, só leitura");
    expect(html).toMatch(/aria-label="Editar N\.º CNJ"[^>]*disabled/);
  });

  it("quando o DataJud responde sem o processo, diz o motivo", () => {
    const html = capa({
      datajud: {
        carregando: false,
        erro: null,
        resultado: { achou: false, erro: "processo ainda não está no DataJud", sistema: null, ajuizamento: null, assuntos: [], classe: null, ms: 38707 },
      },
    });
    expect(html).toContain("processo ainda não está no DataJud");
    expect(html).not.toContain("consultando (leva até 1 min)");
  });
});

describe("ResumoDaCapaView", () => {
  it("resume os obrigatórios, o que conferir e os campos principais, com o botão da capa", () => {
    const html = resumo();
    expect(html).toContain("Abertura de pasta no VIOS");
    expect(html).toContain("Obrigatórios do VIOS preenchidos");
    expect(html).toMatch(/\d+ para conferir/);
    expect(html).toContain("R$ 730.000,00");
    expect(html).toContain("Conferir e editar a capa");
  });

  it("lista os obrigatórios que faltam", () => {
    const html = resumo({ capa: { ...CAPA, dados: { ...CAPA.dados, par: null } } });
    expect(html).toContain("Faltam 2 obrigatórios do VIOS");
    expect(html).toContain("Advogado responsável · Auxiliar");
  });

  it("enquanto busca, avisa; com erro, mostra o erro", () => {
    expect(resumo({ capa: null })).toContain("Montando a capa");
    expect(resumo({ capa: null, erro: "Publicação não encontrada." })).toContain("Publicação não encontrada.");
  });
});
