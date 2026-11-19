import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuidedTour } from "./guided-tour";
import { novidadesTourSteps } from "@/lib/content-generator/novidades-tour";

describe("tour guiado", () => {
  it("aberto, mostra o 1º passo no meio da tela com Pular e Próximo", () => {
    const steps = novidadesTourSteps(true);
    const html = renderToStaticMarkup(
      <GuidedTour steps={steps} open label="Novidades do Gerador de conteúdo" finishLabel="Começar" onFinish={() => {}} />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Novidades do Gerador de conteúdo");
    expect(html).toContain(`Passo 1 de ${steps.length}`);
    expect(html).toContain("O Gerador de conteúdo mudou");
    expect(html).toContain("Pular");
    expect(html).toContain("Próximo");
    expect(html).not.toContain("Voltar");
  });

  it("fechado, não desenha nada", () => {
    expect(renderToStaticMarkup(<GuidedTour steps={novidadesTourSteps(false)} open={false} label="x" onFinish={() => {}} />)).toBe("");
  });
});
