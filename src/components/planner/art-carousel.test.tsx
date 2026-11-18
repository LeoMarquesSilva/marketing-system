import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArtCarousel, artSlideKind } from "./art-carousel";
import { deliveryTitle } from "@/lib/request-files/deliveries-server";

describe("carrossel da arte", () => {
  it("reconhece imagem, vídeo e o resto pelo tipo do arquivo", () => {
    expect(artSlideKind("image/png")).toBe("image");
    expect(artSlideKind("video/mp4")).toBe("video");
    expect(artSlideKind("application/pdf")).toBe("other");
    expect(artSlideKind(null)).toBe("other");
  });

  it("mostra todos os slides em 4:5, contador e pontinhos", () => {
    const html = renderToStaticMarkup(
      <ArtCarousel
        slides={[
          { id: "1", url: "https://x/1.png", name: "slide-1.png", kind: "image" },
          { id: "2", url: "https://x/2.png", name: "slide-2.png", kind: "image" },
          { id: "3", url: "https://x/3.mp4", name: "video.mp4", kind: "video" },
        ]}
      />,
    );
    expect(html.match(/aspect-\[4\/5\]/g)).toHaveLength(3);
    expect(html).toContain("1/3");
    expect(html.match(/Ir para o slide/g)).toHaveLength(3);
    expect(html).toContain("<video");
    expect(html).toContain("Próximo slide");
  });

  it("um slide só: sem contador nem pontinhos; nenhum slide: nada", () => {
    const one = renderToStaticMarkup(<ArtCarousel slides={[{ id: "1", url: "https://x/1.png", name: "capa.png", kind: "image" }]} />);
    expect(one).not.toContain("1/1");
    expect(one).not.toContain("Ir para o slide");
    expect(renderToStaticMarkup(<ArtCarousel slides={[]} />)).toBe("");
  });
});

describe("título da entrega", () => {
  it("tira a tag do planner do começo", () => {
    expect(deliveryTitle("[OAB] Post 03 — Abertura do congresso")).toBe("Post 03 — Abertura do congresso");
    expect(deliveryTitle("Comunicado de férias coletivas")).toBe("Comunicado de férias coletivas");
  });
});
