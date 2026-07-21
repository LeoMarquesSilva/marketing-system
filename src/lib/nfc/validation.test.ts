import { describe, expect, it } from "vitest";
import { nfcExecutionInputSchema, nfcTagInputSchema } from "@/lib/nfc/validation";

const baseTag = {
  name: "Impressora da recepção",
  status: "active" as const,
  accessMode: "public" as const,
  actionType: "url" as const,
  actionConfig: {
    destinationUrl: "https://example.com/manual",
    openImmediately: true,
  },
  cooldownSeconds: 10,
};

describe("NFC tag validation", () => {
  it("aceita o cadastro mínimo de uma etiqueta URL", () => {
    expect(nfcTagInputSchema.safeParse(baseTag).success).toBe(true);
  });

  it("rejeita URL sem destino", () => {
    const parsed = nfcTagInputSchema.safeParse({
      ...baseTag,
      actionConfig: { openImmediately: true },
    });
    expect(parsed.success).toBe(false);
  });

  it("exige usuários quando o acesso é selecionado", () => {
    const parsed = nfcTagInputSchema.safeParse({
      ...baseTag,
      accessMode: "selected_users",
      allowedUserIds: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("exige workflow para webhook", () => {
    const parsed = nfcTagInputSchema.safeParse({
      ...baseTag,
      actionType: "webhook",
      actionConfig: { requireConfirmation: true },
    });
    expect(parsed.success).toBe(false);
  });

  it("uma execução pública só é válida com confirmação explícita", () => {
    expect(
      nfcExecutionInputSchema.safeParse({
        scanId: "7e3bd4e6-156a-4bdf-bc0f-61a0f08a9134",
        confirmed: false,
      }).success
    ).toBe(false);
  });
});
