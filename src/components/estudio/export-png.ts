/**
 * Exporta a prancheta (nó em tamanho real, 1080 px) como PNG no navegador.
 *
 * Exportador próprio, no lugar do html-to-image: no Chrome atual o
 * `getComputedStyle().cssText` vem vazio e a biblioteca perdia os estilos (só o
 * fundo saía na imagem). Aqui cada elemento recebe os estilos calculados, as
 * imagens e as fontes entram como data URL e o SVG resultante é desenhado num canvas.
 */

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const dataUrlCache = new Map<string, Promise<string>>();

function toDataUrl(url: string): Promise<string> {
  const absolute = new URL(url, window.location.href).href;
  if (absolute.startsWith("data:")) return Promise.resolve(absolute);
  let pending = dataUrlCache.get(absolute);
  if (!pending) {
    pending = fetch(absolute, { credentials: "same-origin" }).then((res) => {
      if (!res.ok) throw new Error(`Não foi possível carregar ${absolute} (${res.status}).`);
      return res.blob().then(blobToDataUrl);
    });
    dataUrlCache.set(absolute, pending);
    pending.catch(() => dataUrlCache.delete(absolute));
  }
  return pending;
}

/** Copia os estilos calculados de cada elemento para o clone (árvores paralelas). */
function inlineStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);
  const style = (target as HTMLElement | SVGElement).style;
  if (style) {
    for (let i = 0; i < computed.length; i++) {
      const name = computed[i];
      style.setProperty(name, computed.getPropertyValue(name), computed.getPropertyPriority(name));
    }
  }
  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let i = 0; i < sourceChildren.length; i++) inlineStyles(sourceChildren[i], targetChildren[i]);
}

/** @font-face das famílias usadas na prancheta, com o arquivo da fonte embutido. */
async function embeddedFontCss(families: Set<string>): Promise<string> {
  const rules: CSSFontFaceRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue; // folha de outro domínio
    }
    for (const rule of Array.from(cssRules)) {
      if (rule instanceof CSSFontFaceRule) {
        const family = rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim();
        if (families.has(family)) rules.push(rule);
      }
    }
  }
  const css = await Promise.all(
    rules.map(async (rule) => {
      let text = rule.cssText;
      const urls = Array.from(text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)).map((m) => m[1]);
      for (const url of urls) {
        if (url.startsWith("data:")) continue;
        try {
          text = text.replace(url, await toDataUrl(url));
        } catch {
          // fonte indisponível: o navegador usa a próxima da lista
        }
      }
      return text;
    })
  );
  return css.join("\n");
}

function usedFamilies(root: Element): Set<string> {
  const families = new Set<string>();
  const visit = (el: Element) => {
    for (const f of window.getComputedStyle(el).fontFamily.split(",")) families.add(f.replace(/["']/g, "").trim());
    for (const child of Array.from(el.children)) visit(child);
  };
  visit(root);
  return families;
}

export async function renderArtboardPng(node: HTMLElement, width: number, height: number): Promise<Blob> {
  if (document.fonts) await document.fonts.ready;
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(images.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))));
  // fora da página não há estilo calculado: a imagem sairia só com o fundo
  if (!node.isConnected) throw new Error("A prévia mudou durante a exportação. Tente de novo.");

  const clone = node.cloneNode(true) as HTMLElement;
  inlineStyles(node, clone);
  clone.style.transform = "none";
  clone.style.margin = "0";
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

  const clonedImages = Array.from(clone.querySelectorAll("img"));
  await Promise.all(
    clonedImages.map(async (img, i) => {
      const src = images[i]?.currentSrc || images[i]?.src;
      if (!src) return;
      img.setAttribute("src", await toDataUrl(src));
      img.removeAttribute("srcset");
    })
  );

  const fontCss = await embeddedFontCss(usedFamilies(node));
  const markup = new XMLSerializer().serializeToString(clone);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">` +
    `<style xmlns="http://www.w3.org/1999/xhtml">${fontCss.replace(/</g, "\\3c ")}</style>${markup}` +
    `</foreignObject></svg>`;

  const image = new Image();
  image.decoding = "sync";
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  // dá tempo para as fontes embutidas no SVG entrarem antes de desenhar
  await new Promise((resolve) => setTimeout(resolve, 80));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não deixou desenhar a imagem.");
  ctx.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Não foi possível gerar a imagem.");
  return blob;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function zipBlobs(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.blob);
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
