import { describe, expect, it } from "vitest";
import {
  SUPABASE_PRO_STORAGE_QUOTA_BYTES,
  aggregateStorageUsage,
  formatStorageBytes,
  storageBarTone,
  storageUsagePercent,
} from "@/lib/collaborator-photos/storage-usage";

describe("formatStorageBytes", () => {
  it("formata bytes, MB e GB", () => {
    expect(formatStorageBytes(512)).toBe("512 B");
    expect(formatStorageBytes(2.5 * 1024 * 1024)).toBe("2,5 MB");
    expect(formatStorageBytes(1.25 * 1024 * 1024 * 1024)).toBe("1,25 GB");
  });
});

describe("storageUsagePercent", () => {
  it("calcula o percentual inteiro limitado a 100", () => {
    expect(storageUsagePercent(25, 100)).toBe(25);
    expect(storageUsagePercent(0, 100)).toBe(0);
    expect(storageUsagePercent(150, 100)).toBe(100);
    expect(storageUsagePercent(10, 0)).toBe(0);
  });
});

describe("storageBarTone", () => {
  it("fica âmbar a partir de 70% e vermelho a partir de 90%", () => {
    expect(storageBarTone(10)).toBe("ok");
    expect(storageBarTone(70)).toBe("warn");
    expect(storageBarTone(89)).toBe("warn");
    expect(storageBarTone(90)).toBe("danger");
  });
});

describe("aggregateStorageUsage", () => {
  it("soma o projeto, destaca o bucket de fotos e calcula o restante da cota", () => {
    const summary = aggregateStorageUsage(
      [
        { bucketId: "MARKETING-SYSTEM-FOTOS", files: 142, bytes: 431_474_084 },
        { bucketId: "MARKETING-SYSTEM-EVENTOS", files: 4, bytes: 560_217_503 },
        { bucketId: "MARKETING-SYSTEM-PROJETOS", files: 3, bytes: 18_608_354 },
      ],
      SUPABASE_PRO_STORAGE_QUOTA_BYTES
    );

    expect(summary.usedBytes).toBe(1_010_299_941);
    expect(summary.photosBytes).toBe(431_474_084);
    expect(summary.photosFiles).toBe(142);
    expect(summary.quotaBytes).toBe(SUPABASE_PRO_STORAGE_QUOTA_BYTES);
    expect(summary.availableBytes).toBe(SUPABASE_PRO_STORAGE_QUOTA_BYTES - 1_010_299_941);
    expect(summary.percent).toBe(1);
  });
});
