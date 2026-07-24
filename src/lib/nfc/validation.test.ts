import { describe, expect, it } from "vitest";
import {
  nfcAssetAdminReturnSchema,
  nfcAssetCreateSchema,
  nfcAssetUpdateSchema,
  nfcExecutionInputSchema,
  nfcTagInputSchema,
} from "@/lib/nfc/validation";

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

  it("exige autenticação quando o formulário seleciona colaboradores", () => {
    const parsed = nfcTagInputSchema.safeParse({
      ...baseTag,
      actionType: "form",
      actionConfig: {
        title: "Café com Cultura",
        fields: [
          {
            id: "colaborador",
            label: "Colaborador",
            type: "user_select",
            required: true,
          },
        ],
      },
    });
    expect(parsed.success).toBe(false);
  });

  it("aceita o fluxo autenticado de retirada e devolução", () => {
    const parsed = nfcTagInputSchema.safeParse({
      ...baseTag,
      accessMode: "authenticated",
      actionType: "asset_loan",
      actionConfig: {
        title: "Guarda-chuvas",
        assetLabel: "Guarda-chuva",
        assetNumberLabel: "Número do guarda-chuva",
        sensitive: true,
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("uma execução pública só é válida com confirmação explícita", () => {
    expect(
      nfcExecutionInputSchema.safeParse({
        scanId: "7e3bd4e6-156a-4bdf-bc0f-61a0f08a9134",
        confirmed: false,
      }).success
    ).toBe(false);
  });

  it("valida os dados de uma retirada de item", () => {
    expect(
      nfcExecutionInputSchema.safeParse({
        scanId: "7e3bd4e6-156a-4bdf-bc0f-61a0f08a9134",
        confirmed: true,
        loanOperation: "checkout",
        assetNumber: "12",
        borrowerUserId: "a65da340-4c73-4291-bf20-3d2a60a1695d",
      }).success
    ).toBe(true);
  });

  it("normaliza e remove números duplicados no cadastro de itens", () => {
    const parsed = nfcAssetCreateSchema.parse({
      tagId: "571bc86c-cc9f-4829-9bb8-88dde3be7041",
      label: "Guarda-chuva",
      assetNumbers: [" gc-01 ", "GC-01", "gc-02"],
    });

    expect(parsed.assetNumbers).toEqual(["GC-01", "GC-02"]);
  });

  it("aceita manutenção como status administrativo", () => {
    expect(
      nfcAssetUpdateSchema.safeParse({
        label: "Guarda-chuva",
        status: "maintenance",
        notes: "Cabo danificado",
      }).success
    ).toBe(true);
  });

  it("aceita devolução administrativa sem observação", () => {
    expect(nfcAssetAdminReturnSchema.safeParse({}).success).toBe(true);
  });
});
