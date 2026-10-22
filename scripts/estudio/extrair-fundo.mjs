#!/usr/bin/env node
// Gera o fundo limpo de uma prancheta do Illustrator (.ai salvo com compatibilidade PDF)
// para o Estúdio de peças: apaga o que for variável dentro das regiões informadas
// (textos, caminhos, forms e degradês) e mantém as imagens e o resto da arte.
//
// Uso:
//   node scripts/estudio/extrair-fundo.mjs <arquivo.ai> <página> <saída.jpg|png> \
//     [--apagar x,y,l,a ...] [--original <saída-original.png>] [--largura 1080] [--listar]
//
// --listar mostra a posição de cada texto e form, para escolher as regiões.
//
// As regiões usam a régua do Illustrator: origem no canto superior esquerdo, em pt
// (nas pranchetas de 1080 px, 1 pt = 1 px). Um item só some se estiver INTEIRO dentro
// de uma região (texto: pelo ponto de início), então fotos e fundos que cruzam a área ficam.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { PDFDocument, PDFName, PDFArray, PDFDict, PDFNumber } = require("pdf-lib");

function parseArgs(argv) {
  const [file, pageArg, out, ...rest] = argv;
  if (!file || !pageArg || !out) {
    console.error("Uso: extrair-fundo.mjs <arquivo.ai> <página> <saída.jpg|png> [--apagar x,y,l,a ...] [--original saída.png] [--largura 1080]");
    process.exit(1);
  }
  const zones = [];
  let original = null;
  let width = null;
  let listar = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--listar") listar = true;
    else if (rest[i] === "--apagar") {
      while (rest[i + 1] && !rest[i + 1].startsWith("--")) {
        const [x, y, w, h] = rest[++i].split(",").map(Number);
        zones.push({ x, y, w, h });
      }
    } else if (rest[i] === "--original") original = rest[++i];
    else if (rest[i] === "--largura") width = Number(rest[++i]);
  }
  return { file, page: Number(pageArg), out, zones, original, width, listar };
}

// ---------- tokenizador de content stream ----------

const DELIMS = new Set(["(", ")", "<", ">", "[", "]", "{", "}", "/", "%"]);
const isWhite = (c) => c === " " || c === "\n" || c === "\r" || c === "\t" || c === "\f" || c === "\0";

/** Quebra o stream em operações: { op, args: string[], start, end } (end exclusivo). */
function tokenizeOps(src) {
  const ops = [];
  let args = [];
  let opStart = -1;
  let i = 0;
  const n = src.length;
  const mark = () => {
    if (opStart < 0) opStart = i;
  };
  while (i < n) {
    const c = src[i];
    if (isWhite(c)) { i++; continue; }
    if (c === "%") { while (i < n && src[i] !== "\n" && src[i] !== "\r") i++; continue; }
    mark();
    const tokStart = i;
    if (c === "(") {
      let depth = 0;
      for (; i < n; i++) {
        const ch = src[i];
        if (ch === "\\") { i++; continue; }
        if (ch === "(") depth++;
        else if (ch === ")") { depth--; if (depth === 0) { i++; break; } }
      }
      args.push(src.slice(tokStart, i));
      continue;
    }
    if (c === "<" && src[i + 1] === "<") {
      let depth = 0;
      for (; i < n; i++) {
        if (src[i] === "<" && src[i + 1] === "<") { depth++; i++; continue; }
        if (src[i] === ">" && src[i + 1] === ">") { depth--; i++; if (depth === 0) { i++; break; } }
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
        if (ch === "(") { // string dentro do array
          let d = 0;
          for (; i < n; i++) {
            if (src[i] === "\\") { i++; continue; }
            if (src[i] === "(") d++;
            else if (src[i] === ")") { d--; if (d === 0) break; }
          }
          continue;
        }
        if (ch === "[") depth++;
        else if (ch === "]") { depth--; if (depth === 0) { i++; break; } }
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
    const tok = src.slice(tokStart, i);
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(tok) || tok === "true" || tok === "false" || tok === "null") {
      args.push(tok);
      continue;
    }
    if (tok === "BI") {
      // imagem embutida: vai até "EI" isolado
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

// ---------- geometria ----------

const IDENTITY = [1, 0, 0, 1, 0, 0];
function mul(m, n) {
  // m × n (matrizes PDF [a b c d e f])
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function emptyBox() {
  return { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
}
function addPoint(box, [x, y]) {
  box.x0 = Math.min(box.x0, x); box.y0 = Math.min(box.y0, y);
  box.x1 = Math.max(box.x1, x); box.y1 = Math.max(box.y1, y);
}

const PATH_OPS = new Set(["m", "l", "c", "v", "y", "re", "h"]);
const PAINT_OPS = new Set(["S", "s", "f", "F", "f*", "B", "B*", "b", "b*", "n"]);

const SHOW_TEXT_OPS = new Set(["Tj", "TJ", "'", '"']);

/**
 * Percorre as operações e devolve as edições { start, end, text } que desligam a
 * pintura do que está nas regiões. Nada é removido de verdade: cores, fontes e
 * transformações continuam valendo para o que vem depois.
 * `zones` em coordenadas do PDF (origem embaixo); `toTop` converte y para a régua do Illustrator.
 */
function findRemovals(ops, zones, xobjects, { list = false, toTop = (y) => y } = {}) {
  const inside = (box) =>
    zones.some((z) => box.x0 >= z.x0 - 0.5 && box.x1 <= z.x1 + 0.5 && box.y0 >= z.y0 - 0.5 && box.y1 <= z.y1 + 0.5);
  const pointInside = ([x, y]) => zones.some((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1);

  const removals = [];
  const stack = [];
  let state = { ctm: IDENTITY, clip: null };
  let pathStart = -1;
  let pathBox = emptyBox();
  let hasClip = false;
  const removed = { texto: 0, caminho: 0, form: 0, degrade: 0 };

  for (let k = 0; k < ops.length; k++) {
    const { op, args } = ops[k];
    const nums = args.map(Number);
    if (op === "q") { stack.push(state); state = { ...state }; continue; }
    if (op === "Q") { state = stack.pop() ?? { ctm: IDENTITY, clip: null }; continue; }
    if (op === "cm") { state.ctm = mul(nums, state.ctm); continue; }

    if (op === "BT") {
      // cada trecho de texto é avaliado pela posição em que começa
      let tm = IDENTITY;
      let line = IDENTITY;
      let end = k + 1;
      for (; end < ops.length && ops[end].op !== "ET"; end++) {
        const o = ops[end];
        const v = o.args.map(Number);
        if (o.op === "Tm") { tm = v; line = v; }
        else if (o.op === "Td" || o.op === "TD") { line = mul([1, 0, 0, 1, v[0], v[1]], line); tm = line; }
        else if (o.op === "cm") state.ctm = mul(v, state.ctm);
        else if (SHOW_TEXT_OPS.has(o.op)) {
          const anchor = apply(mul(tm, state.ctm), 0, 0);
          const hit = pointInside(anchor);
          if (list) {
            const sample = o.args.join(" ").replace(/\s+/g, " ").slice(0, 50);
            console.log(`  texto (${Math.round(anchor[0])},${Math.round(toTop(anchor[1]))})${hit ? " [apaga]" : ""} ${sample}`);
          }
          if (hit) { removals.push([o.start, o.end, ""]); removed.texto++; }
        }
      }
      k = end;
      continue;
    }

    if (PATH_OPS.has(op)) {
      if (pathStart < 0) { pathStart = k; pathBox = emptyBox(); hasClip = false; }
      if (op === "re") {
        const [x, y, w, h] = nums;
        for (const p of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) addPoint(pathBox, apply(state.ctm, ...p));
      } else {
        for (let a = 0; a + 1 < nums.length; a += 2) addPoint(pathBox, apply(state.ctm, nums[a], nums[a + 1]));
      }
      continue;
    }
    if (op === "W" || op === "W*") { hasClip = true; continue; }
    if (PAINT_OPS.has(op)) {
      if (pathStart >= 0) {
        if (hasClip) state.clip = { ...pathBox };
        // pinta e está inteiro na região: o caminho fica, mas sem pintura ("n")
        if (op !== "n" && inside(pathBox)) {
          removals.push([ops[k].end - op.length, ops[k].end, "n"]);
          removed.caminho++;
        }
      }
      pathStart = -1;
      continue;
    }

    if (op === "sh") {
      if (state.clip && inside(state.clip)) { removals.push([ops[k].start, ops[k].end, ""]); removed.degrade++; }
      continue;
    }

    if (op === "Do") {
      const name = args[0]?.slice(1);
      const x = xobjects.get(name);
      if (!x) continue;
      // imagem ocupa o quadrado unitário; fotos de fundo passam da região e ficam
      const isImage = x.subtype === "Image";
      const m = isImage ? state.ctm : mul(x.matrix, state.ctm);
      const [bx0, by0, bx1, by1] = isImage ? [0, 0, 1, 1] : x.bbox;
      const box = emptyBox();
      for (const p of [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]]) addPoint(box, apply(m, ...p));
      if (list) {
        console.log(`  ${isImage ? "imagem" : "form"} ${name} (${Math.round(box.x0)},${Math.round(toTop(box.y1))})–(${Math.round(box.x1)},${Math.round(toTop(box.y0))})`);
      }
      if (inside(box) || (state.clip && inside(state.clip))) {
        removals.push([ops[k].start, ops[k].end, ""]);
        removed[isImage ? "imagem" : "form"] = (removed[isImage ? "imagem" : "form"] ?? 0) + 1;
      }
    }
  }
  return { removals, removed };
}

function decodeStream(stream) {
  const filter = stream.dict.get(PDFName.of("Filter"));
  const bytes = Buffer.from(stream.contents);
  return filter && String(filter).includes("FlateDecode") ? zlib.inflateSync(bytes) : bytes;
}

async function main() {
  const { file, page: pageNumber, out, zones, original, width, listar } = parseArgs(process.argv.slice(2));
  const src = await PDFDocument.load(fs.readFileSync(file), { updateMetadata: false });
  const doc = await PDFDocument.create();
  const [page] = await doc.copyPages(src, [pageNumber - 1]);
  doc.addPage(page);

  const node = page.node;
  const [mx0, my0, mx1, my1] = node.MediaBox().asArray().map((v) => v.asNumber());
  const pageHeight = my1 - my0;

  // XObjects da página (forms: bbox e matriz)
  const xobjects = new Map();
  const xdict = node.Resources()?.get(PDFName.of("XObject"));
  if (xdict instanceof PDFDict) {
    for (const [key, ref] of xdict.entries()) {
      const obj = doc.context.lookup(ref);
      const subtype = String(obj?.dict?.get(PDFName.of("Subtype")) ?? "").replace("/", "");
      const bboxArr = obj?.dict?.get(PDFName.of("BBox"));
      const matArr = obj?.dict?.get(PDFName.of("Matrix"));
      const nums = (a) => (a instanceof PDFArray ? a.asArray().map((v) => (v instanceof PDFNumber ? v.asNumber() : Number(v))) : null);
      xobjects.set(key.asString().slice(1), {
        subtype,
        bbox: nums(bboxArr) ?? [0, 0, 0, 0],
        matrix: nums(matArr) ?? IDENTITY,
      });
    }
  }

  const contents = node.get(PDFName.of("Contents"));
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  const source = refs.map((r) => decodeStream(doc.context.lookup(r)).toString("latin1")).join("\n");

  const pdfZones = zones.map((z) => ({ x0: mx0 + z.x, x1: mx0 + z.x + z.w, y0: my0 + pageHeight - z.y - z.h, y1: my0 + pageHeight - z.y }));
  const ops = tokenizeOps(source);
  const { removals, removed } = findRemovals(ops, pdfZones, xobjects, {
    list: listar,
    toTop: (y) => my0 + pageHeight - y,
  });

  let cleaned = "";
  let cursor = 0;
  for (const [a, b, text] of removals.sort((x, y) => x[0] - y[0])) {
    if (a < cursor) continue;
    cleaned += source.slice(cursor, a) + text;
    cursor = b;
  }
  cleaned += source.slice(cursor);

  const stream = doc.context.flateStream(Buffer.from(cleaned, "latin1"));
  node.set(PDFName.of("Contents"), doc.context.register(stream));
  const cleanedPdf = await doc.save();
  console.log(`página ${pageNumber}: ${ops.length} operações; removidos ${JSON.stringify(removed)}`);

  // desenho com pdf.js + @napi-rs/canvas
  const pdfjs = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);
  const { createCanvas } = require("@napi-rs/canvas");
  async function render(bytes, target) {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
    const p = await pdf.getPage(1);
    const base = p.getViewport({ scale: 1 });
    const scale = width ? width / base.width : 1;
    const vp = p.getViewport({ scale });
    const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
    await p.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    const isJpg = /\.jpe?g$/i.test(target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, isJpg ? canvas.toBuffer("image/jpeg", 90) : canvas.toBuffer("image/png"));
    console.log(`→ ${target} (${Math.round(vp.width)}×${Math.round(vp.height)})`);
  }
  await render(cleanedPdf, out);
  if (original) {
    const origDoc = await PDFDocument.create();
    const [origPage] = await origDoc.copyPages(src, [pageNumber - 1]);
    origDoc.addPage(origPage);
    await render(await origDoc.save(), original);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
