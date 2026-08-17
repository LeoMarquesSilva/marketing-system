import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  assertBatchDownloadIds,
  batchDownloadZipName,
  buildPhotosZip,
  MAX_BATCH_DOWNLOAD_PHOTOS,
  uniqueZipEntryName,
} from "@/lib/collaborator-photos/batch-download";

describe("assertBatchDownloadIds", () => {
  it("exige ao menos uma foto", () => {
    expect(() => assertBatchDownloadIds([])).toThrow(/ao menos uma foto/i);
  });

  it("limita a quantidade máxima", () => {
    const ids = Array.from({ length: MAX_BATCH_DOWNLOAD_PHOTOS + 1 }, (_, i) => `id-${i}`);
    expect(() => assertBatchDownloadIds(ids)).toThrow(/no máximo/i);
  });

  it("remove duplicatas e valida strings", () => {
    expect(assertBatchDownloadIds(["a", "b", "a"])).toEqual(["a", "b"]);
    expect(() => assertBatchDownloadIds(["ok", 1])).toThrow(/inválida/i);
  });
});

describe("uniqueZipEntryName", () => {
  it("sufixa nomes repetidos", () => {
    const used = new Set<string>();
    expect(uniqueZipEntryName("ana-1.jpg", used)).toBe("ana-1.jpg");
    expect(uniqueZipEntryName("ana-1.jpg", used)).toBe("ana-1-2.jpg");
    expect(uniqueZipEntryName("ana-1.jpg", used)).toBe("ana-1-3.jpg");
  });
});

describe("buildPhotosZip", () => {
  it("gera um zip com os arquivos", async () => {
    const bytes = await buildPhotosZip([
      { filename: "a.jpg", bytes: new Uint8Array([1, 2, 3]) },
      { filename: "a.jpg", bytes: new Uint8Array([4, 5]) },
    ]);
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files).sort()).toEqual(["a-2.jpg", "a.jpg"]);
  });
});

describe("batchDownloadZipName", () => {
  it("monta nome seguro com data", () => {
    expect(batchDownloadZipName("Ana Silva")).toMatch(/^ana-silva-\d{4}-\d{2}-\d{2}\.zip$/);
  });
});
