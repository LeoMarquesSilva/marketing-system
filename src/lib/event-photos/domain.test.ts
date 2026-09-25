import { describe, expect, it } from "vitest";
import {
  compareEventPhotoNames,
  eventPhotoDownloadName,
  parseAlbumDate,
  previewDimensions,
  slugifyAlbumTitle,
  uniqueAlbumSlug,
  validateEventPhotoFile,
} from "@/lib/event-photos/domain";

describe("slugifyAlbumTitle", () => {
  it("remove acentos, travessão e espaços", () => {
    expect(slugifyAlbumTitle("Café com Cultura — Setembro 2026")).toBe(
      "cafe-com-cultura-setembro-2026"
    );
  });

  it("devolve vazio quando não sobra caractere válido", () => {
    expect(slugifyAlbumTitle("—  !!")).toBe("");
  });
});

describe("uniqueAlbumSlug", () => {
  it("mantém o slug livre", () => {
    expect(uniqueAlbumSlug("festa", [])).toBe("festa");
  });

  it("numera quando já existe", () => {
    expect(uniqueAlbumSlug("festa", ["festa", "festa-2"])).toBe("festa-3");
  });
});

describe("parseAlbumDate", () => {
  it("aceita data ISO válida", () => {
    expect(parseAlbumDate("2026-09-18")).toBe("2026-09-18");
  });

  it("rejeita datas impossíveis e formatos livres", () => {
    expect(parseAlbumDate("2026-02-30")).toBeNull();
    expect(parseAlbumDate("18/09/2026")).toBeNull();
    expect(parseAlbumDate(null)).toBeNull();
  });
});

describe("previewDimensions", () => {
  it("reduz pelo lado maior mantendo proporção", () => {
    expect(previewDimensions(6000, 4000)).toEqual({ width: 1600, height: 1067 });
    expect(previewDimensions(4000, 6000)).toEqual({ width: 1067, height: 1600 });
  });

  it("não amplia imagens pequenas", () => {
    expect(previewDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("validateEventPhotoFile", () => {
  it("aceita JPG pelo nome quando o tipo vem vazio", () => {
    expect(validateEventPhotoFile({ name: "IMG_01.JPG", type: "", size: 1000 })).toBeNull();
  });

  it("rejeita HEIC e arquivos acima de 30 MB", () => {
    expect(validateEventPhotoFile({ name: "a.heic", type: "image/heic", size: 10 })).toMatch(/JPG/);
    expect(
      validateEventPhotoFile({ name: "a.jpg", type: "image/jpeg", size: 31 * 1024 * 1024 })
    ).toMatch(/30 MB/);
  });
});

describe("compareEventPhotoNames", () => {
  it("segue a numeração do fotógrafo e deixa sem nome no fim", () => {
    const names = ["BP - Cafe-10.jpg", null, "BP - Cafe-2.jpg", "BP - Cafe-100.jpg", "BP - Cafe-1.jpg"];
    expect([...names].sort(compareEventPhotoNames)).toEqual([
      "BP - Cafe-1.jpg",
      "BP - Cafe-2.jpg",
      "BP - Cafe-10.jpg",
      "BP - Cafe-100.jpg",
      null,
    ]);
  });
});

describe("eventPhotoDownloadName", () => {
  it("numera com três dígitos e normaliza extensão", () => {
    expect(eventPhotoDownloadName("cafe-set", 0, "DSC_1234.JPEG")).toBe("cafe-set-001.jpg");
    expect(eventPhotoDownloadName("cafe-set", 41, null)).toBe("cafe-set-042.jpg");
  });
});
