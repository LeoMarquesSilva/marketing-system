import { fieldKey } from "@/lib/estudio/dynamic";
import { FONT_FAMILY_RE, suggestSlot, type StudioFontRow } from "@/lib/estudio/fonts";
import { blockBox, weightFromName, type TextBlock } from "@/lib/estudio/pdf-text";
import type { DynamicBox, DynamicFont } from "@/lib/estudio/types";

/** Como cada bloco de texto da prancheta vira (ou não) campo do modelo. */
export interface TextDraft {
  blockId: string;
  usar: boolean;
  label: string;
  key: string;
  dica: string;
  max: number;
  linhas: number;
  caixaAlta: boolean;
  alinhamento: NonNullable<DynamicBox["alinhamento"]>;
  tamanho: number;
  minimo: number;
  entrelinha: number;
  cor: string;
  /** cor trocada à mão: a medição não sobrescreve */
  corManual: boolean;
  fonte: DynamicFont;
  fonteStatus: FontStatus;
  fontePdf: string;
  x: number;
  y: number;
  w: number;
  h: number;
  exemplo: string;
}

export interface ImageDraft {
  key: string;
  label: string;
  pasta: "fotos" | "logos";
  ajuste: "cover" | "contain";
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FontStatus = "ok" | "faltando" | "desconhecida";

export interface SlotInfo {
  key: string;
  family: string;
  weight: number;
  label: string;
  origem: "pasta" | "envio" | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Fonte do Estúdio para o nome que veio do .ai ("Gotham-Book"): primeiro uma fonte
 * enviada com o mesmo nome PostScript, depois os lugares dos modelos (Gotham, Gobold…),
 * por fim a família pelo nome. Sem arquivo, a arte cai na Montserrat até alguém subir.
 */
export function resolveFont(pdfName: string, fonts: StudioFontRow[], slots: SlotInfo[]): { fonte: DynamicFont; status: FontStatus } {
  const italic = /italic|oblique/i.test(pdfName);
  const sent = fonts.find((f) => f.postscript && norm(f.postscript) === norm(pdfName));
  if (sent) return { fonte: { familia: sent.familia, peso: sent.peso, estilo: sent.estilo }, status: "ok" };
  const weight = weightFromName(pdfName);
  const slot = suggestSlot(pdfName, weight);
  if (slot) {
    const status = slots.find((s) => s.key === slot.key)?.origem ? "ok" : "faltando";
    return { fonte: { familia: slot.family, peso: slot.weight, estilo: "normal" }, status };
  }
  const familia = (pdfName.split(/[-,]/)[0] || "Montserrat").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[^A-Za-zÀ-ÿ0-9 ._-]/g, "").slice(0, 60);
  const safe = FONT_FAMILY_RE.test(familia) ? familia : "Montserrat";
  const known = fonts.some((f) => norm(f.familia) === norm(safe) && f.peso === weight);
  return { fonte: { familia: safe, peso: weight, estilo: italic ? "italic" : "normal" }, status: known ? "ok" : "desconhecida" };
}

export function draftsFromBlocks(blocks: TextBlock[], fonts: StudioFontRow[], slots: SlotInfo[]): TextDraft[] {
  const biggest = Math.max(...blocks.map((b) => b.size));
  const taken = new Set<string>();
  let n = 0;
  return blocks.map((block) => {
    const usar = block.size >= 24 && block.text.replace(/\s/g, "").length >= 3;
    const label = block.size === biggest ? "Título" : usar ? `Texto ${++n}` : `Fixo: ${block.text.slice(0, 20)}`;
    const key = fieldKey(label, taken);
    taken.add(key);
    const box = blockBox(block);
    const { fonte, status } = resolveFont(block.font, fonts, slots);
    return {
      blockId: block.id,
      usar,
      label,
      key,
      dica: "",
      max: Math.max(20, Math.ceil((block.text.length * 1.25) / 10) * 10),
      linhas: box.linhas,
      caixaAlta: block.upper,
      alinhamento: block.align,
      tamanho: Math.round(block.size * 10) / 10,
      minimo: Math.round(block.size * 0.7 * 10) / 10,
      entrelinha: block.lineHeight,
      cor: "#111111",
      corManual: false,
      fonte,
      fonteStatus: status,
      fontePdf: block.font,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      exemplo: block.text,
    };
  });
}

/** Caixas do modelo, na ordem em que aparecem na arte (de cima para baixo). */
export function draftsToBoxes(texts: TextDraft[], images: ImageDraft[]): DynamicBox[] {
  const textBoxes: DynamicBox[] = texts
    .filter((d) => d.usar)
    .map((d) => ({
      key: d.key,
      tipo: "texto",
      label: d.label.trim() || d.key,
      ...(d.dica.trim() ? { dica: d.dica.trim() } : {}),
      x: d.x,
      y: d.y,
      w: d.w,
      h: d.h,
      exemplo: d.exemplo,
      max: d.max,
      linhas: d.linhas,
      fonte: d.fonte,
      tamanho: d.tamanho,
      minimo: Math.min(d.minimo, d.tamanho),
      entrelinha: d.entrelinha,
      cor: d.cor,
      alinhamento: d.alinhamento,
      caixaAlta: d.caixaAlta,
    }));
  const imageBoxes: DynamicBox[] = images.map((d) => ({
    key: d.key,
    tipo: "imagem",
    label: d.label.trim() || d.key,
    x: d.x,
    y: d.y,
    w: d.w,
    h: d.h,
    exemplo: "",
    pasta: d.pasta,
    ajuste: d.ajuste,
  }));
  return [...textBoxes, ...imageBoxes].sort((a, b) => a.y - b.y || a.x - b.x);
}
