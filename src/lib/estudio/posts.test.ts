import { describe, expect, it } from "vitest";
import { approvedSentences, authorCredit, carryOverImages, cleanSourceTitle, matchPhoto, missingSentences, normalizeSlides, starterSlides } from "./domain";
import { defaultValues, normalizeValues, stripMarkup, valuesToLines } from "./fields";
import { imageDisplayName, slugifyFileName, studioImageUrl } from "./images";
import { BP_ICONS, getTemplate, templatesFor } from "./templates";

describe("coleção BP (posts do escritório)", () => {
  it("só tem carrossel, começando por capa e conteúdo", () => {
    expect(templatesFor("BP", "carrossel").map((t) => t.id)).toEqual(["bp-capa", "bp-conteudo"]);
    expect(templatesFor("BP", "feed")).toEqual([]);
    expect(starterSlides("BP", "carrossel").map((s) => s.modelo)).toEqual(["bp-capa", "bp-conteudo"]);
  });

  it("imagem aceita só caminho do bucket da coleção", () => {
    const capa = getTemplate("bp-capa")!;
    expect(defaultValues(capa.campos).foto).toBe("");
    expect(normalizeValues(capa.campos, { foto: "BP/fotos/1730000000000-thayna.png" }).foto).toBe("BP/fotos/1730000000000-thayna.png");
    expect(normalizeValues(capa.campos, { foto: "../segredo.png" }).foto).toBe("");
    expect(normalizeValues(capa.campos, { foto: "https://exemplo.com/a.png" }).foto).toBe("");
  });

  it("texto da caixa guarda as quebras de linha (lista com marcador) e o checklist tira o negrito", () => {
    const conteudo = getTemplate("bp-conteudo")!;
    const values = normalizeValues(conteudo.campos, {
      titulo: "POR QUE ISSO IMPORTA?",
      caixas: [{ estilo: "suave", marcador: "quadrado", texto: "Um **item**\nOutro item" }],
    });
    const caixas = values.caixas as Record<string, string>[];
    expect(caixas[0].texto).toBe("Um **item**\nOutro item");
    expect(valuesToLines(conteudo.campos, values)).toEqual(["Título: POR QUE ISSO IMPORTA?", "Caixa: Um item\nOutro item"]);
    expect(stripMarkup("R$ **4,1 bilhões**")).toBe("R$ 4,1 bilhões");
  });

  it("todo ícone da lista tem nome curto e único", () => {
    const values = BP_ICONS.map((i) => i.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("autor da capa", () => {
  it("usa Dr./Dra. e o cargo no gênero do cadastro do RH", () => {
    expect(authorCredit({ name: "Thayná Rodrigues Cabalin", gender: "F", position: "Advogado Pleno", department: "Reestruturação" }, "Insolvência")).toEqual({
      autor: "Dra. Thayná Rodrigues Cabalin",
      cargo: "Advogada da área de Reestruturação",
    });
    expect(authorCredit({ name: "Wagner Armani", gender: "M", position: "Sócio de Área", department: "Contratos" }, "x")).toEqual({
      autor: "Dr. Wagner Armani",
      cargo: "Sócio da área de Contratos",
    });
  });

  it("sem gênero cadastrado, não põe tratamento nem flexiona o cargo", () => {
    expect(authorCredit({ name: "Pessoa Teste", gender: null, position: "Advogado Júnior", department: "Cível" }, "Cível")).toEqual({
      autor: "Pessoa Teste",
      cargo: "Área de Cível",
    });
  });

  it("quem não é advogado sai sem Dr./Dra., com o cargo do cadastro", () => {
    expect(authorCredit({ name: "Laura Gomes", gender: "F", position: "Estagiário", department: "Reestruturação" }, "x")).toEqual({
      autor: "Laura Gomes",
      cargo: "Estagiária da área de Reestruturação",
    });
    expect(authorCredit({ name: "Caio Silva", gender: "M", position: "Assistente Jurídico", department: "" }, "Contratos").cargo).toBe(
      "Assistente Jurídico da área de Contratos"
    );
  });
});

describe("ajustes finos", () => {
  it("guarda só os ajustes que o modelo aceita, dentro dos limites, e descarta os neutros", () => {
    const [capa, conteudo] = normalizeSlides(
      [
        { modelo: "bp-capa", valores: {}, ajustes: { fotoZoom: 9, fotoX: -20, texto: 1, y: "x", inventado: 3 } },
        { modelo: "bp-conteudo", valores: {}, ajustes: { fotoZoom: 1.2, titulo: 1.1 } },
      ],
      "BP",
      "carrossel"
    );
    expect(capa.ajustes).toEqual({ fotoZoom: 1.8, fotoX: -20 });
    expect(conteudo.ajustes).toEqual({ titulo: 1.1 });
    expect(normalizeSlides([{ modelo: "bp-conteudo", valores: {}, ajustes: { texto: 1 } }], "BP", "carrossel")[0]).not.toHaveProperty("ajustes");
  });

  it("depois da IA, o slide no mesmo lugar e com o mesmo modelo mantém os ajustes", () => {
    const before = normalizeSlides([{ modelo: "bp-capa", valores: {}, ajustes: { fotoZoom: 1.2 } }], "BP", "carrossel");
    const after = normalizeSlides([{ modelo: "bp-capa", valores: { titulo: "NOVO" } }], "BP", "carrossel");
    expect(carryOverImages(before, after)[0].ajustes).toEqual({ fotoZoom: 1.2 });
  });
});

describe("conferência do texto aprovado", () => {
  const POST = `Post em carrossel

SLIDE 01 — Capa
Bloqueio não é pagamento: valor tratado antes da recuperação judicial não vai direto ao banco credor
Thayná Rodrigues Cabalin — Insolvência
TJGO decide: enquanto o dinheiro não chega ao credor, quem define seu destino é o juízo da recuperação.

---

SLIDE 02 — Slide de Desenvolvimento 1
O que decidiu o TJGO?
Em recuperação judicial de produtores rurais, o Santander havia bloqueado valores via Sisbajud.

---

SLIDE 05
Atenção: nem todo bloqueio volta para a empresa
· Se o credor já levantou o valor antes do pedido, a expropriação está consumada.
· Mesmo assim, bens essenciais podem ser protegidos durante o stay period.`;

  const MARKDOWN = `**Slide de Capa**
**Título:** Patrimônio de Afetação: Proteção ou Ilusão?
**Subtítulo:** Entenda os limites e riscos na blindagem patrimonial

---

**Slide de Desenvolvimento 1**
**Título:** O que é Patrimônio de Afetação?
**Conteúdo:**
É um instituto jurídico que separa os bens ligados a um empreendimento imobiliário.`;

  it("pega só as frases do miolo, sem capa, títulos e marcações", () => {
    expect(approvedSentences(POST)).toEqual([
      "Em recuperação judicial de produtores rurais, o Santander havia bloqueado valores via Sisbajud.",
      "Se o credor já levantou o valor antes do pedido, a expropriação está consumada.",
      "Mesmo assim, bens essenciais podem ser protegidos durante o stay period.",
    ]);
    expect(approvedSentences(MARKDOWN)).toEqual(["É um instituto jurídico que separa os bens ligados a um empreendimento imobiliário."]);
  });

  it("aponta a frase que a IA deixou de fora (ignorando caixa, acento e negrito)", () => {
    const slides = normalizeSlides(
      [
        {
          modelo: "bp-conteudo",
          valores: {
            titulo: "O QUE DECIDIU O TJGO?",
            caixas: [
              { texto: "Em recuperação judicial de produtores rurais, o **Santander** havia bloqueado valores via Sisbajud." },
              { marcador: "ponto", texto: "Se o credor já levantou o valor antes do pedido, a expropriação está consumada." },
            ],
          },
        },
      ],
      "BP",
      "carrossel"
    );
    expect(missingSentences(POST, slides)).toEqual(["Mesmo assim, bens essenciais podem ser protegidos durante o stay period."]);
  });
});

describe("imagens e post", () => {
  it("acha a foto da pessoa na galeria pelo primeiro e último nome", () => {
    const paths = ["BP/fotos/1-manuela-lutke.png", "BP/fotos/2-thayna-cabalin.png"];
    expect(matchPhoto(paths, "Thayná Rodrigues Cabalin")).toBe("BP/fotos/2-thayna-cabalin.png");
    expect(matchPhoto(paths, "Raíssa Alni Minari")).toBeNull();
  });

  it("monta nomes e endereços de imagem", () => {
    expect(slugifyFileName("Thayná Rodrigues Cabalin.PNG")).toBe("thayna-rodrigues-cabalin");
    expect(imageDisplayName("BP/fotos/1730000000000-thayna-rodrigues-cabalin.png")).toBe("thayna rodrigues cabalin");
    expect(imageDisplayName("BP/fotos/1730000000000-thayna-rodrigues-cabalin-316ff209.png")).toBe("thayna rodrigues cabalin");
    expect(studioImageUrl("BP/fotos/a b.png")).toBe("/api/estudio/imagens/BP/fotos/a%20b.png");
  });

  it("tira o veículo do fim do título da matéria", () => {
    expect(cleanSourceTitle("Bloqueio antes da recuperação judicial não dá controle do valor ao banco credor - conjur.com.br")).toBe(
      "Bloqueio antes da recuperação judicial não dá controle do valor ao banco credor"
    );
    expect(cleanSourceTitle("Novas regras criam labirinto para os fundos")).toBe("Novas regras criam labirinto para os fundos");
  });

  it("depois da IA, a capa recupera a foto e o logo que já estavam", () => {
    const before = normalizeSlides(
      [{ id: "a", modelo: "bp-capa", valores: { titulo: "X", foto: "BP/fotos/1-x.png", logo: "BP/logos/1-y.png" } }],
      "BP",
      "carrossel"
    );
    const after = normalizeSlides(
      [
        { modelo: "bp-capa", valores: { titulo: "NOVO" } },
        { modelo: "bp-conteudo", valores: { titulo: "Y", caixas: [{ texto: "z" }] } },
      ],
      "BP",
      "carrossel"
    );
    const merged = carryOverImages(before, after);
    expect(merged[0].valores).toEqual(expect.objectContaining({ titulo: "NOVO", foto: "BP/fotos/1-x.png", logo: "BP/logos/1-y.png" }));
    expect(merged[1]).toBe(after[1]);
  });
});
