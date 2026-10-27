import { describe, expect, it } from "vitest";
import { readEvolutionMediaResponse } from "../../supabase/functions/evolution-webhook/media-response";

function streamOf(text: string, chunkSize: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

const file = Uint8Array.from({ length: 1000 }, (_, i) => (i * 37 + 11) % 256);
const body = JSON.stringify({
  mediaType: "documentMessage",
  fileName: "Proposta \"final\".pdf",
  caption: 'texto com "base64":"falso" no meio',
  size: { fileLength: { low: file.length, high: 0 } },
  mimetype: "application/pdf",
  base64: Buffer.from(file).toString("base64"),
  buffer: null,
});

describe("readEvolutionMediaResponse", () => {
  // 1 byte por vez quebra o marcador e cada grupo de 4 caracteres em todos os pontos.
  it.each([1, 3, 7, 64, 100_000])("decodifica a mídia em pedaços de %i bytes", async (size) => {
    const result = await readEvolutionMediaResponse(streamOf(body, size), 10_000);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(Buffer.from(result.bytes).equals(Buffer.from(file))).toBe(true);
    expect(result.meta).toMatchObject({
      mimetype: "application/pdf",
      fileName: "Proposta \"final\".pdf",
      caption: 'texto com "base64":"falso" no meio',
      base64: "",
      buffer: null,
    });
  });

  it("desiste acima do limite", async () => {
    const result = await readEvolutionMediaResponse(streamOf(body, 64), 500);
    expect(result).toEqual({ status: "too_large" });
  });

  it("devolve o JSON quando não há mídia", async () => {
    const result = await readEvolutionMediaResponse(
      streamOf(JSON.stringify({ mediaType: "imageMessage", base64: null }), 5),
      10_000
    );
    expect(result).toEqual({
      status: "no_media",
      meta: { mediaType: "imageMessage", base64: null },
    });
  });

  it("acusa resposta cortada no meio do arquivo", async () => {
    await expect(
      readEvolutionMediaResponse(streamOf('{"base64":"AAAABBBB', 4), 10_000)
    ).rejects.toThrow(/meio da mídia/);
  });
});
