import { describe, expect, it } from "vitest";
import { collaboratorPhotoPreviewUrl } from "@/lib/collaborator-photos/preview-url";

const PUBLIC =
  "https://qwihfvagemzlyypeohpc.supabase.co/storage/v1/object/public/MARKETING-SYSTEM-FOTOS/colaboradores/u1/foto.jpg";

describe("collaboratorPhotoPreviewUrl", () => {
  it("troca object/public por render/image com width e quality", () => {
    const url = collaboratorPhotoPreviewUrl(PUBLIC, { width: 720, quality: 75 });
    expect(url).toContain("/storage/v1/render/image/public/MARKETING-SYSTEM-FOTOS/");
    expect(url).toContain("width=720");
    expect(url).toContain("quality=75");
    expect(url).toContain("resize=contain");
  });

  it("preserva URLs que não são do Storage público", () => {
    expect(collaboratorPhotoPreviewUrl("https://cdn.example.com/a.jpg")).toBe(
      "https://cdn.example.com/a.jpg"
    );
  });

  it("aceita cover no resize", () => {
    const url = collaboratorPhotoPreviewUrl(PUBLIC, { resize: "cover", width: 400 });
    expect(url).toContain("resize=cover");
    expect(url).toContain("width=400");
  });
});
