/**
 * Apaga textos de uma página de PDF (.ai salvo com compatibilidade PDF) sem mexer no
 * resto da arte: o que pinta texto dentro das regiões vira nada, e cores, fontes e
 * transformações continuam valendo para o que vem depois. Porte para o navegador de
 * scripts/estudio/extrair-fundo.mjs (só a parte de texto, que é o que vira campo).
 *
 * Coordenadas no espaço do PDF (origem embaixo, em pt). Um trecho de texto some se o
 * ponto em que começa estiver dentro de uma região.
 */

export interface Zone {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Op {
  op: string;
  args: string[];
  start: number;
  end: number;
}

const DELIMS = new Set(["(", ")", "<", ">", "[", "]", "{", "}", "/", "%"]);
const isWhite = (c: string) => c === " " || c === "\n" || c === "\r" || c === "\t" || c === "\f" || c === "\0";

/** Quebra o stream em operações: { op, args, start, end } (end exclusivo). */
export function tokenizeOps(src: string): Op[] {
  const ops: Op[] = [];
  let args: string[] = [];
  let opStart = -1;
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (isWhite(c)) {
      i++;
      continue;
    }
    if (c === "%") {
      while (i < n && src[i] !== "\n" && src[i] !== "\r") i++;
      continue;
    }
    if (opStart < 0) opStart = i;
    const tokStart = i;
    if (c === "(") {
      let depth = 0;
      for (; i < n; i++) {
        const ch = src[i];
        if (ch === "\\") {
          i++;
          continue;
        }
        if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
      }
      args.push(src.slice(tokStart, i));
      continue;
    }
    if (c === "<" && src[i + 1] === "<") {
      let depth = 0;
      for (; i < n; i++) {
        if (src[i] === "<" && src[i + 1] === "<") {
          depth++;
          i++;
          continue;
        }
        if (src[i] === ">" && src[i + 1] === ">") {
          depth--;
          i++;
          if (depth === 0) {
            i++;
            break;
          }
        }
      }
      args.push(src.slice(tokStart, i));
      continue;
    }
    if (c === "<") {
      while (i < n && src[i] !== ">") i++;
      i++;
      args.push(src.slice(tokStart, i));
      continue;
    }
    if (c === "[") {
      let depth = 0;
      for (; i < n; i++) {
        const ch = src[i];
        if (ch === "(") {
          // string dentro do array
          let d = 0;
          for (; i < n; i++) {
            if (src[i] === "\\") {
              i++;
              continue;
            }
            if (src[i] === "(") d++;
            else if (src[i] === ")") {
              d--;
              if (d === 0) break;
            }
          }
          continue;
        }
        if (ch === "[") depth++;
        else if (ch === "]") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
      }
      args.push(src.slice(tokStart, i));
      continue;
    }
    if (c === "/") {
      i++;
      while (i < n && !isWhite(src[i]) && !DELIMS.has(src[i])) i++;
      args.push(src.slice(tokStart, i));
      continue;
    }
    // número ou operador
    while (i < n && !isWhite(src[i]) && !DELIMS.has(src[i])) i++;
    if (i === tokStart) {
      // delimitador solto (")", ">", "{"…): pula para não travar
      i++;
      continue;
    }
    const tok = src.slice(tokStart, i);
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(tok) || tok === "true" || tok === "false" || tok === "null") {
      args.push(tok);
      continue;
    }
    if (tok === "BI") {
      // imagem embutida: vai até "EI"
      const ei = src.indexOf("EI", i);
      i = ei < 0 ? n : ei + 2;
      ops.push({ op: "BI", args: [], start: opStart, end: i });
    } else {
      ops.push({ op: tok, args, start: opStart, end: i });
    }
    args = [];
    opStart = -1;
  }
  return ops;
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function mul(m: number[], n: number[]): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

const SHOW_TEXT_OPS = new Set(["Tj", "TJ", "'", '"']);

/** Edições [início, fim] que tiram a pintura dos textos que começam dentro das regiões. */
export function textRemovals(ops: Op[], zones: Zone[]): [number, number][] {
  const inside = ([x, y]: [number, number]) => zones.some((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1);
  const removals: [number, number][] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = IDENTITY;

  for (let k = 0; k < ops.length; k++) {
    const { op, args } = ops[k];
    const nums = args.map(Number);
    if (op === "q") {
      stack.push(ctm);
      continue;
    }
    if (op === "Q") {
      ctm = stack.pop() ?? IDENTITY;
      continue;
    }
    if (op === "cm" && nums.length === 6) {
      ctm = mul(nums, ctm);
      continue;
    }
    if (op !== "BT") continue;

    let tm: number[] = IDENTITY;
    let line: number[] = IDENTITY;
    let leading = 0;
    let end = k + 1;
    for (; end < ops.length && ops[end].op !== "ET"; end++) {
      const o = ops[end];
      const v = o.args.map(Number);
      if (o.op === "Tm" && v.length === 6) {
        tm = v;
        line = v;
      } else if (o.op === "Td" || o.op === "TD") {
        if (o.op === "TD") leading = -v[1];
        line = mul([1, 0, 0, 1, v[0], v[1]], line);
        tm = line;
      } else if (o.op === "TL") {
        leading = v[0];
      } else if (o.op === "T*" || o.op === "'" || o.op === '"') {
        line = mul([1, 0, 0, 1, 0, -leading], line);
        tm = line;
      } else if (o.op === "cm" && v.length === 6) {
        ctm = mul(v, ctm);
      }
      if (SHOW_TEXT_OPS.has(o.op)) {
        const m = mul(tm, ctm);
        if (inside([m[4], m[5]])) removals.push([o.start, o.end]);
      }
    }
    k = end;
  }
  return removals;
}

/** Stream sem os textos que começam nas regiões. */
export function removeTextInZones(source: string, zones: Zone[]): { cleaned: string; removed: number } {
  if (zones.length === 0) return { cleaned: source, removed: 0 };
  const removals = textRemovals(tokenizeOps(source), zones).sort((a, b) => a[0] - b[0]);
  let cleaned = "";
  let cursor = 0;
  for (const [a, b] of removals) {
    if (a < cursor) continue;
    cleaned += source.slice(cursor, a);
    cursor = b;
  }
  cleaned += source.slice(cursor);
  return { cleaned, removed: removals.length };
}

/** Bytes ↔ texto 1 para 1 (o TextDecoder "latin1" do navegador é windows-1252 e troca bytes). */
export function bytesToBinary(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
}

export function binaryToBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}
