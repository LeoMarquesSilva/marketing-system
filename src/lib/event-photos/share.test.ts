import { describe, expect, it } from "vitest";
import {
  formatBytes,
  galleryUrl,
  isOwnStorageUrl,
  isShareToken,
  normalizeShareLabel,
  shareExpiresAt,
  shareImageUrl,
  shareStatus,
  splitIntoParts,
} from "@/lib/event-photos/share";

const NOW = Date.parse("2026-11-13T12:00:00Z");
const SUPABASE = "https://abc.supabase.co";

describe("isShareToken", () => {
  it("aceita base64url de 20 a 64 caracteres", () => {
    expect(isShareToken("AbC-_123xyzQWE45678rt")).toBe(true);
    expect(isShareToken("curto")).toBe(false);
    expect(isShareToken("tem espaço no meio do token")).toBe(false);
    expect(isShareToken(null)).toBe(false);
  });
});

describe("galleryUrl", () => {
  it("monta o endereço público", () => {
    expect(galleryUrl("tok_123456789012345678", "https://orqestrai.com.br/")).toBe(
      "https://orqestrai.com.br/galeria/tok_123456789012345678"
    );
  });
});

describe("shareStatus", () => {
  it("revogado vence a validade", () => {
    expect(shareStatus({ revokedAt: "2026-11-01T00:00:00Z", expiresAt: null }, NOW)).toBe("revoked");
  });
  it("vencido quando a data já passou", () => {
    expect(shareStatus({ revokedAt: null, expiresAt: "2026-11-13T11:59:59Z" }, NOW)).toBe("expired");
  });
  it("ativo sem prazo ou dentro do prazo", () => {
    expect(shareStatus({ revokedAt: null, expiresAt: null }, NOW)).toBe("active");
    expect(shareStatus({ revokedAt: null, expiresAt: "2026-12-01T00:00:00Z" }, NOW)).toBe("active");
  });
});

describe("shareExpiresAt", () => {
  it("usa a opção escolhida", () => {
    expect(shareExpiresAt(30, NOW)).toBe("2026-12-13T12:00:00.000Z");
  });
  it("null = sem prazo", () => {
    expect(shareExpiresAt(null, NOW)).toBeNull();
  });
  it("valor fora das opções cai no padrão de 90 dias", () => {
    expect(shareExpiresAt(7, NOW)).toBe("2027-02-11T12:00:00.000Z");
    expect(shareExpiresAt(undefined, NOW)).toBe("2027-02-11T12:00:00.000Z");
  });
});

describe("normalizeShareLabel", () => {
  it("tira espaços repetidos e recusa vazio ou longo demais", () => {
    expect(normalizeShareLabel("  Pague   Menos ")).toBe("Pague Menos");
    expect(normalizeShareLabel("   ")).toBeNull();
    expect(normalizeShareLabel("x".repeat(121))).toBeNull();
    expect(normalizeShareLabel(42)).toBeNull();
  });
});

describe("isOwnStorageUrl", () => {
  it("só aceita arquivo público do nosso Storage", () => {
    expect(isOwnStorageUrl(`${SUPABASE}/storage/v1/object/public/BUCKET/icp-logos/x.jpg?v=1`, SUPABASE)).toBe(true);
    expect(isOwnStorageUrl("https://outro.com/logo.png", SUPABASE)).toBe(false);
    expect(isOwnStorageUrl(`${SUPABASE}/storage/v1/object/public/../segredo`, SUPABASE)).toBe(false);
  });
});

describe("shareImageUrl", () => {
  it("troca para o endpoint de transformação com 1200x630", () => {
    expect(shareImageUrl(`${SUPABASE}/storage/v1/object/public/B/a.jpg`)).toBe(
      `${SUPABASE}/storage/v1/render/image/public/B/a.jpg?width=1200&height=630&resize=cover&quality=70`
    );
  });
  it("devolve a mesma URL quando não é do Storage", () => {
    expect(shareImageUrl("https://x.com/a.jpg")).toBe("https://x.com/a.jpg");
  });
});

describe("splitIntoParts", () => {
  it("fecha a parte antes de passar do limite", () => {
    const files = [{ size: 40 }, { size: 40 }, { size: 40 }, { size: 10 }];
    expect(splitIntoParts(files, 100).map((p) => p.length)).toEqual([2, 2]);
  });
  it("arquivo maior que o limite vai sozinho", () => {
    const files = [{ size: 10 }, { size: 500 }, { size: 10 }];
    expect(splitIntoParts(files, 100).map((p) => p.length)).toEqual([1, 1, 1]);
  });
  it("sem tamanho conta como o maior conhecido", () => {
    const files = [{ size: 60 }, { size: null }, { size: 30 }];
    expect(splitIntoParts(files, 100).map((p) => p.length)).toEqual([1, 2]);
  });
  it("lista vazia = nenhuma parte", () => {
    expect(splitIntoParts([], 100)).toEqual([]);
  });
});

describe("formatBytes", () => {
  it("escolhe a unidade", () => {
    expect(formatBytes(3.9 * 1024 ** 3)).toBe("3,9 GB");
    expect(formatBytes(45 * 1024 ** 2)).toBe("45 MB");
    expect(formatBytes(300)).toBe("1 KB");
  });
});
