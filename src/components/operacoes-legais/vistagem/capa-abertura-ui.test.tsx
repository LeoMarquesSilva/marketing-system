import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CapaParaAbertura } from "@/lib/vistagem/capa-abertura";
import { CapaDaAberturaView } from "./capa-abertura-ui";

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
  geradaEm: "2026-11-10T15:00:00.000Z",
};

const render = (props: Partial<Parameters<typeof CapaDaAberturaView>[0]>) =>
  renderToStaticMarkup(<CapaDaAberturaView id="capa" capa={CAPA} erro="" datajud={{ carregando: true }} onBuscarDeNovo={vi.fn()} {...props} />);

describe("CapaDaAberturaView", () => {
  it("mostra os campos com a fonte de cada um e as fontes consultadas", () => {
    const html = render({});
    expect(html).toContain("Capa para a abertura (prévia)");
    expect(html).toContain("nada é gravado ainda");
    expect(html).toContain("729.764,00");
    expect(html).toContain("Manuela Lutke");
    expect(html).toContain("Pedro Vittale Rossi");
    expect(html).toContain("Carteira Lira");
    expect(html).toContain("Passivo");
    expect(html).toContain("e-SAJ");
    expect(html).toContain("Pastas do grupo");
    expect(html).toContain("4 comunicação(ões)");
    expect(html).toContain("consultando (leva até 1 min)");
    expect(html).toMatch(/\d+ campo\(s\) para conferir antes de abrir/);
  });

  it("enquanto busca, avisa; com erro, mostra o erro", () => {
    expect(render({ capa: null })).toContain("Buscando no DJEN e no e-SAJ");
    expect(render({ capa: null, erro: "Publicação não encontrada." })).toContain("Publicação não encontrada.");
  });

  it("quando o DataJud responde sem o processo, diz o motivo", () => {
    const html = render({
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
