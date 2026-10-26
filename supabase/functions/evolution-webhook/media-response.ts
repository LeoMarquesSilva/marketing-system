/**
 * Leitura da resposta de /chat/getBase64FromMediaMessage sem montar o JSON
 * inteiro: o campo "base64" é decodificado direto dos bytes conforme chegam.
 * Com res.json(), corpo + texto + string base64 + binário ficavam juntos na
 * memória, e um PPTX de 17 MB estourava os 256 MB da Edge Function. Sem imports
 * do Deno para poder ser testado no vitest (src/lib/evolution-media-response.test.ts).
 */

const MARKER = new TextEncoder().encode('"base64":"');
const QUOTE = 0x22;

/** Código ASCII → valor de 6 bits; 255 = ignorar (padding "=", quebra de linha). */
const BASE64_VALUES = (() => {
  const table = new Uint8Array(256).fill(255);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let i = 0; i < alphabet.length; i += 1) table[alphabet.charCodeAt(i)] = i;
  return table;
})();

export type EvolutionMediaResponse =
  | { status: "ok"; bytes: Uint8Array; meta: Record<string, unknown> }
  | { status: "too_large" }
  | { status: "no_media"; meta: Record<string, unknown> | null };

function concat(parts: Uint8Array[], length: number): Uint8Array {
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

export async function readEvolutionMediaResponse(
  body: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<EvolutionMediaResponse> {
  const reader = body.getReader();
  let phase: "head" | "data" | "tail" = "head";
  let matched = 0;
  const head: Uint8Array[] = [];
  let headLength = 0;
  const tail: Uint8Array[] = [];
  let tailLength = 0;
  const out: Uint8Array[] = [];
  let outLength = 0;
  let bits = 0;
  let bitCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    let i = 0;

    if (phase === "head") {
      for (; i < value.length; i += 1) {
        const byte = value[i];
        if (byte === MARKER[matched]) {
          matched += 1;
          if (matched === MARKER.length) {
            i += 1;
            phase = "data";
            break;
          }
        } else {
          matched = byte === MARKER[0] ? 1 : 0;
        }
      }
      head.push(value.subarray(0, i));
      headLength += i;
    }

    if (phase === "data" && i < value.length) {
      const decoded = new Uint8Array(Math.ceil(((value.length - i) * 3) / 4) + 1);
      let n = 0;
      for (; i < value.length; i += 1) {
        const byte = value[i];
        if (byte === QUOTE) {
          phase = "tail";
          break;
        }
        const v = BASE64_VALUES[byte];
        if (v === 255) continue;
        bits = (bits << 6) | v;
        bitCount += 6;
        if (bitCount >= 8) {
          bitCount -= 8;
          decoded[n] = (bits >> bitCount) & 0xff;
          n += 1;
          bits &= (1 << bitCount) - 1;
        }
      }
      out.push(decoded.subarray(0, n));
      outLength += n;
      if (outLength > maxBytes) {
        await reader.cancel();
        return { status: "too_large" };
      }
    }

    if (phase === "tail" && i < value.length) {
      tail.push(value.subarray(i));
      tailLength += value.length - i;
    }
  }

  const decoder = new TextDecoder();
  if (phase === "head") {
    try {
      return { status: "no_media", meta: JSON.parse(decoder.decode(concat(head, headLength))) };
    } catch {
      return { status: "no_media", meta: null };
    }
  }
  if (phase === "data") throw new Error("Resposta da Evolution terminou no meio da mídia.");

  // head termina em `"base64":"` e tail começa com `"`: juntos, o JSON sem o arquivo.
  const meta = JSON.parse(
    decoder.decode(concat(head, headLength)) + decoder.decode(concat(tail, tailLength))
  ) as Record<string, unknown>;
  return { status: "ok", bytes: concat(out, outLength), meta };
}
