/**
 * Exporta a prancheta para SVG editável no Illustrator: cada linha de texto vira um
 * objeto de texto (com a fonte original do modelo, não a substituta da tela), caixas e
 * ícones viram vetores e o fundo e as fotos vão embutidos. O Illustrator abre o .svg
 * direto e salva como .ai.
 */

import { toDataUrl } from "./export-png";

/** Fonte da tela → nome PostScript que o Illustrator acha instalado na máquina da designer. */
function illustratorFont(family: string, weight: number): string {
  const first = family.split(",")[0].replace(/["']/g, "").trim().toLowerCase();
  if (first.includes("gobold")) return "Gobold";
  if (first.includes("neulis")) return "NeulisNeue-Bold";
  if (first.includes("century gothic")) return weight >= 600 ? "CenturyGothic-Bold" : "CenturyGothic";
  if (first.includes("kanit")) return weight >= 600 ? "Kanit-SemiBold" : weight >= 500 ? "Kanit-Medium" : "Kanit-Regular";
  if (first.includes("gotham") || first.includes("montserrat")) {
    return weight >= 600 ? "Gotham-Bold" : weight >= 500 ? "Gotham-Medium" : "Gotham-Book";
  }
  return family.split(",")[0].replace(/["']/g, "").trim();
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n: number) => (Math.round(n * 100) / 100).toString();

function isVisibleColor(color: string): boolean {
  if (!color || color === "transparent") return false;
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return true;
  const parts = m[1].split(",").map((p) => parseFloat(p));
  return parts.length < 4 || parts[3] > 0.001;
}

/** "rgba(1, 2, 3, 0.5)" → { fill: "rgb(1,2,3)", opacity: 0.5 } (o Illustrator lê melhor assim). */
function paint(color: string): { color: string; opacity: number } {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return { color, opacity: 1 };
  const [r, g, b, a] = m[1].split(",").map((p) => parseFloat(p));
  return { color: `rgb(${r},${g},${b})`, opacity: a === undefined || Number.isNaN(a) ? 1 : a };
}

interface Ctx {
  originX: number;
  originY: number;
  scale: number;
  defs: string[];
  out: string[];
  gradientId: number;
}

function box(ctx: Ctx, el: Element) {
  const r = el.getBoundingClientRect();
  return {
    x: (r.left - ctx.originX) / ctx.scale,
    y: (r.top - ctx.originY) / ctx.scale,
    w: r.width / ctx.scale,
    h: r.height / ctx.scale,
  };
}

/** linear-gradient(90deg, cor pos, ...) → id de <linearGradient>, ou null se não der para ler. */
function gradient(ctx: Ctx, css: string): string | null {
  const m = css.match(/linear-gradient\((.*)\)$/);
  if (!m) return null;
  const body = m[1];
  const angleMatch = body.match(/^\s*(-?[\d.]+)deg\s*,/);
  const angle = angleMatch ? parseFloat(angleMatch[1]) : 180;
  const stops = Array.from(body.matchAll(/(rgba?\([^)]*\)|#[0-9a-f]{3,8})\s*([\d.]+%)?/gi));
  if (stops.length < 2) return null;
  const rad = ((angle - 90) * Math.PI) / 180;
  const dx = Math.cos(rad) / 2;
  const dy = Math.sin(rad) / 2;
  const id = `g${++ctx.gradientId}`;
  const stopTags = stops.map((s, i) => {
    const p = paint(s[1]);
    const offset = s[2] ?? `${Math.round((i / (stops.length - 1)) * 100)}%`;
    return `<stop offset="${offset}" stop-color="${p.color}" stop-opacity="${num(p.opacity)}"/>`;
  });
  ctx.defs.push(`<linearGradient id="${id}" x1="${num(0.5 - dx)}" y1="${num(0.5 - dy)}" x2="${num(0.5 + dx)}" y2="${num(0.5 + dy)}">${stopTags.join("")}</linearGradient>`);
  return id;
}

function radius(style: CSSStyleDeclaration, w: number, h: number): number {
  const raw = style.borderTopLeftRadius;
  const value = raw.endsWith("%") ? (parseFloat(raw) / 100) * w : parseFloat(raw) || 0;
  return Math.min(value, w / 2, h / 2);
}

/** Fundo, borda e degradê de uma caixa. */
function drawBox(ctx: Ctx, el: HTMLElement, style: CSSStyleDeclaration) {
  const b = box(ctx, el);
  if (b.w < 0.5 || b.h < 0.5) return;
  const bg = style.backgroundColor;
  const bgImage = style.backgroundImage;
  const borderWidth = parseFloat(style.borderTopWidth) || 0;
  const hasBorder = borderWidth > 0 && style.borderTopStyle !== "none" && isVisibleColor(style.borderTopColor);
  const masked = (style.getPropertyValue("mask-image") || style.getPropertyValue("-webkit-mask-image") || "none") !== "none";
  const gradId = bgImage && bgImage !== "none" && !bgImage.includes("url(") ? gradient(ctx, bgImage) : null;
  if (!isVisibleColor(bg) && !hasBorder && !gradId) return;

  // rotação (marcador em losango): desenha o quadrado girado no centro da caixa
  const matrix = style.transform && style.transform !== "none" ? style.transform.match(/matrix\(([^)]+)\)/) : null;
  let transform = "";
  let w = b.w;
  let h = b.h;
  let x = b.x;
  let y = b.y;
  if (matrix) {
    const [a, bb] = matrix[1].split(",").map(parseFloat);
    const angle = (Math.atan2(bb, a) * 180) / Math.PI;
    if (Math.abs(angle) > 0.5) {
      w = el.offsetWidth;
      h = el.offsetHeight;
      x = b.x + b.w / 2 - w / 2;
      y = b.y + b.h / 2 - h / 2;
      transform = ` transform="rotate(${num(angle)} ${num(b.x + b.w / 2)} ${num(b.y + b.h / 2)})"`;
    }
  }
  const rx = radius(style, w, h);

  if (masked && gradId) {
    // borda em degradê feita com máscara (pílulas da OAB): vira contorno com o degradê
    const sw = parseFloat(style.paddingTop) || 2;
    ctx.out.push(`<rect x="${num(x + sw / 2)}" y="${num(y + sw / 2)}" width="${num(w - sw)}" height="${num(h - sw)}" rx="${num(Math.max(0, rx - sw / 2))}" fill="none" stroke="url(#${gradId})" stroke-width="${num(sw)}"${transform}/>`);
    return;
  }

  const fillAttr = gradId ? `fill="url(#${gradId})"` : isVisibleColor(bg) ? (() => { const p = paint(bg); return `fill="${p.color}"${p.opacity < 1 ? ` fill-opacity="${num(p.opacity)}"` : ""}`; })() : `fill="none"`;
  let strokeAttr = "";
  let inset = 0;
  if (hasBorder) {
    const p = paint(style.borderTopColor);
    strokeAttr = ` stroke="${p.color}" stroke-width="${num(borderWidth)}"${p.opacity < 1 ? ` stroke-opacity="${num(p.opacity)}"` : ""}`;
    inset = borderWidth / 2;
  }
  ctx.out.push(
    `<rect x="${num(x + inset)}" y="${num(y + inset)}" width="${num(w - inset * 2)}" height="${num(h - inset * 2)}" rx="${num(Math.max(0, rx - inset))}" ${fillAttr}${strokeAttr}${transform}/>`
  );
}

/** Retângulo onde a imagem é desenhada de fato (object-fit: contain/cover + object-position). */
function imageRect(img: HTMLImageElement, b: { x: number; y: number; w: number; h: number }, style: CSSStyleDeclaration) {
  const nw = img.naturalWidth || b.w;
  const nh = img.naturalHeight || b.h;
  const fit = style.objectFit;
  if (fit !== "contain" && fit !== "cover") return b;
  const s = fit === "contain" ? Math.min(b.w / nw, b.h / nh) : Math.max(b.w / nw, b.h / nh);
  const w = nw * s;
  const h = nh * s;
  const [px, py] = style.objectPosition.split(" ").map((v) => (v.endsWith("%") ? parseFloat(v) / 100 : NaN));
  const fx = Number.isNaN(px) ? 0.5 : px;
  const fy = Number.isNaN(py) ? 0.5 : py;
  return { x: b.x + (b.w - w) * fx, y: b.y + (b.h - h) * fy, w, h, clip: fit === "cover" };
}

async function drawImage(ctx: Ctx, img: HTMLImageElement, style: CSSStyleDeclaration) {
  const src = img.currentSrc || img.src;
  if (!src) return;
  const b = box(ctx, img);
  const r = imageRect(img, b, style) as { x: number; y: number; w: number; h: number; clip?: boolean };
  const href = await toDataUrl(src);
  let clip = "";
  if (r.clip) {
    const id = `c${++ctx.gradientId}`;
    ctx.defs.push(`<clipPath id="${id}"><rect x="${num(b.x)}" y="${num(b.y)}" width="${num(b.w)}" height="${num(b.h)}"/></clipPath>`);
    clip = ` clip-path="url(#${id})"`;
  }
  ctx.out.push(`<image x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" preserveAspectRatio="none" xlink:href="${href}"${clip}/>`);
}

/** Ícone SVG da tela (lucide ou próprio): entra como grupo vetorial, com a cor resolvida. */
function drawSvg(ctx: Ctx, svg: SVGSVGElement, style: CSSStyleDeclaration) {
  const b = box(ctx, svg);
  const vb = svg.viewBox?.baseVal;
  const vw = vb && vb.width ? vb.width : b.w;
  const vh = vb && vb.height ? vb.height : b.h;
  const color = paint(style.color).color;
  const attrs = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin"]
    .map((name) => {
      const v = svg.getAttribute(name);
      return v ? `${name}="${v === "currentColor" ? color : v}"` : "";
    })
    .filter(Boolean)
    .join(" ");
  const inner = svg.innerHTML.replace(/currentColor/g, color);
  ctx.out.push(`<g transform="translate(${num(b.x)} ${num(b.y)}) scale(${num(b.w / vw)} ${num(b.h / vh)})" ${attrs}>${inner}</g>`);
}

const measureCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;

/** Linhas de um nó de texto como aparecem na tela: cada linha vira um <text> no lugar exato. */
function drawText(ctx: Ctx, node: Text, style: CSSStyleDeclaration) {
  const raw = node.data;
  if (!raw.trim()) return;
  const upper = style.textTransform === "uppercase";
  const range = document.createRange();
  type Glyph = { ch: string; left: number; top: number; bottom: number };
  const glyphs: Glyph[] = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\n") continue;
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const rects = range.getClientRects();
    if (rects.length === 0) continue;
    const r = rects[0];
    glyphs.push({ ch, left: r.left, top: r.top, bottom: r.bottom });
  }
  if (glyphs.length === 0) return;

  // agrupa por linha (mesmo topo)
  const lines: Glyph[][] = [];
  for (const g of glyphs) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line[0].top - g.top) < 2) line.push(g);
    else lines.push([g]);
  }

  const fontSize = parseFloat(style.fontSize);
  const weight = parseInt(style.fontWeight, 10) || 400;
  const family = illustratorFont(style.fontFamily, weight);
  const fill = paint(style.color);
  const spacing = parseFloat(style.letterSpacing) || 0;
  const ctx2d = measureCanvas?.getContext("2d");
  let ascent = fontSize * 0.8;
  if (ctx2d) {
    ctx2d.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const m = ctx2d.measureText("Hg");
    if (m.fontBoundingBoxAscent) ascent = m.fontBoundingBoxAscent;
  }
  const justify = style.textAlign === "justify";
  const parentLines = lines.length;

  lines.forEach((line, li) => {
    const text = line.map((g) => g.ch).join("");
    const trimmedStart = text.length - text.trimStart().length;
    const visible = line.slice(trimmedStart);
    const content = text.trim();
    if (!content) return;
    // posições vêm da tela (escalada pela prévia); tamanhos do CSS já estão no tamanho real
    const x = (visible[0].left - ctx.originX) / ctx.scale;
    const baseline = (visible[0].top - ctx.originY) / ctx.scale + ascent;
    const attrs = `font-family="${esc(family)}" font-size="${num(fontSize)}" fill="${fill.color}"${fill.opacity < 1 ? ` fill-opacity="${num(fill.opacity)}"` : ""}${spacing ? ` letter-spacing="${num(spacing)}"` : ""}`;
    const shown = (s: string) => esc(upper ? s.toLocaleUpperCase("pt-BR") : s);
    const lastLine = li === parentLines - 1;
    if (justify && !lastLine && content.includes(" ")) {
      // texto justificado: cada palavra no x da tela, para manter o alinhamento
      const spans: string[] = [];
      let word = "";
      let wordX = 0;
      visible.forEach((g, i) => {
        if (g.ch === " ") {
          if (word) spans.push(`<tspan x="${num(wordX)}">${shown(word)}</tspan>`);
          word = "";
          return;
        }
        if (!word) wordX = (g.left - ctx.originX) / ctx.scale;
        word += g.ch;
        if (i === visible.length - 1) spans.push(`<tspan x="${num(wordX)}">${shown(word)}</tspan>`);
      });
      ctx.out.push(`<text y="${num(baseline)}" ${attrs}>${spans.join("")}</text>`);
    } else {
      ctx.out.push(`<text x="${num(x)}" y="${num(baseline)}" ${attrs}>${shown(content)}</text>`);
    }
  });
}

async function walk(ctx: Ctx, el: Element) {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return;
  if (el instanceof HTMLImageElement) {
    await drawImage(ctx, el, style);
    return;
  }
  if (el instanceof SVGSVGElement) {
    drawSvg(ctx, el, style);
    return;
  }
  if (el instanceof HTMLElement) drawBox(ctx, el, style);
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) drawText(ctx, child as Text, style);
    else if (child.nodeType === Node.ELEMENT_NODE) await walk(ctx, child as Element);
  }
}

export async function renderArtboardSvg(node: HTMLElement, width: number, height: number): Promise<string> {
  if (document.fonts) await document.fonts.ready;
  if (!node.isConnected) throw new Error("A prévia mudou durante a exportação. Tente de novo.");
  const rect = node.getBoundingClientRect();
  const ctx: Ctx = { originX: rect.left, originY: rect.top, scale: rect.width / width, defs: [], out: [], gradientId: 0 };
  await walk(ctx, node);
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs><clipPath id="prancheta"><rect width="${width}" height="${height}"/></clipPath>${ctx.defs.join("")}</defs>`,
    `<g clip-path="url(#prancheta)">`,
    ...ctx.out,
    `</g>`,
    `</svg>`,
  ].join("\n");
}
