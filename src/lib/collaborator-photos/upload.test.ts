import { describe, expect, it } from "vitest";
import {
  COLLABORATOR_PHOTO_MAX_BYTES,
  buildCollaboratorPhotoFileName,
  downloadFileNameForPhoto,
  nextPhotoSequence,
  validateCollaboratorPhotoFile,
} from "@/lib/collaborator-photos/upload";

function fileLike(name: string, type: string, size: number) {
  return { name, type, size };
}

describe("validateCollaboratorPhotoFile", () => {
  it("aceita jpeg/png/webp/gif dentro do limite", () => {
    expect(validateCollaboratorPhotoFile(fileLike("a.jpg", "image/jpeg", 1024))).toBeNull();
    expect(validateCollaboratorPhotoFile(fileLike("a.png", "image/png", 1024))).toBeNull();
    expect(validateCollaboratorPhotoFile(fileLike("a.webp", "image/webp", 1024))).toBeNull();
    expect(validateCollaboratorPhotoFile(fileLike("a.gif", "image/gif", 1024))).toBeNull();
  });

  it("rejeita arquivo que não é imagem", () => {
    expect(validateCollaboratorPhotoFile(fileLike("a.pdf", "application/pdf", 1024))).toMatch(
      /imagem/i
    );
  });

  it("rejeita arquivo acima de 15 MB", () => {
    expect(
      validateCollaboratorPhotoFile(
        fileLike("a.jpg", "image/jpeg", COLLABORATOR_PHOTO_MAX_BYTES + 1)
      )
    ).toMatch(/15/);
  });
});

describe("nome das fotos do colaborador", () => {
  it("gera slug-número.extensão", () => {
    expect(buildCollaboratorPhotoFileName("Ana Nunes Galvão", 1, "jpg")).toBe(
      "ana-nunes-galvao-1.jpg"
    );
    expect(buildCollaboratorPhotoFileName("João  Silva", 12, "png")).toBe("joao-silva-12.png");
  });

  it("próximo número é o maior existente + 1", () => {
    expect(nextPhotoSequence(["ana-silva-1.jpg", "ana-silva-3.jpg"], "Ana Silva")).toBe(4);
    expect(nextPhotoSequence([], "Ana Silva")).toBe(1);
  });

  it("usa o nome já padronizado no download", () => {
    expect(
      downloadFileNameForPhoto("Ana Silva", { originalFilename: "ana-silva-2.jpg" }, 9)
    ).toBe("ana-silva-2.jpg");
  });

  it("monta o nome pelo índice se o arquivo antigo não segue o padrão", () => {
    expect(
      downloadFileNameForPhoto("Ana Silva", { originalFilename: "IMG_4401.JPG" }, 2)
    ).toBe("ana-silva-2.jpg");
  });
});
