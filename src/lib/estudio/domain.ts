import { normalizeValues, valuesToLines, type FieldValues } from "./fields";
import { POSTING_FIELD_KEYS, getTemplate, templatesFor } from "./templates";
import { PIECE_MAX_SLIDES, type PieceKind, type StudioSlide, type StudioTemplateDef } from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function newSlide(template: StudioTemplateDef, valores?: FieldValues): StudioSlide {
  return { id: newId(), modelo: template.id, valores: normalizeValues(template.campos, valores ?? template.exemplo) };
}

/** Slides iniciais de uma peça nova: o exemplo do primeiro modelo (e da programação, no carrossel). */
export function starterSlides(tag: string, kind: PieceKind): StudioSlide[] {
  const options = templatesFor(tag, kind);
  if (options.length === 0) return [];
  if (kind === "carrossel") {
    const capa = options.find((t) => t.id.endsWith("-capa")) ?? options[0];
    const prog = options.find((t) => t.id.endsWith("-programacao"));
    return [newSlide(capa), ...(prog ? [newSlide(prog)] : [])];
  }
  if (kind === "feed") {
    const capa = options.find((t) => t.id.endsWith("-capa"));
    if (capa) return [newSlide(capa, { ...capa.exemplo, arraste: false })];
  }
  return [newSlide(options[0])];
}

/** Limpa slides vindos do banco ou da IA: só modelos da coleção que servem para o tipo, valores dentro dos limites. */
export function normalizeSlides(raw: unknown, tag: string, kind: PieceKind): StudioSlide[] {
  const allowed = new Set(templatesFor(tag, kind).map((t) => t.id));
  const list = Array.isArray(raw) ? raw : [];
  const slides: StudioSlide[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const template = typeof obj.modelo === "string" && allowed.has(obj.modelo) ? getTemplate(obj.modelo) : null;
    if (!template) continue;
    slides.push({
      id: typeof obj.id === "string" && obj.id ? obj.id : newId(),
      modelo: template.id,
      valores: normalizeValues(template.campos, obj.valores),
    });
  }
  return slides.slice(0, PIECE_MAX_SLIDES[kind]);
}

/** Troca o modelo de um slide aproveitando os campos com o mesmo nome. */
export function switchSlideTemplate(slide: StudioSlide, template: StudioTemplateDef): StudioSlide {
  const merged = { ...template.exemplo, ...Object.fromEntries(Object.entries(slide.valores).filter(([k]) => template.campos.some((c) => c.key === k))) };
  return { ...slide, modelo: template.id, valores: normalizeValues(template.campos, merged) };
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ---------- planner ----------

const CODE_PREFIX: Record<PieceKind, string> = { feed: "F", carrossel: "C", stories: "S" };
const KIND_WORD: Record<PieceKind, string> = { feed: "Feed", carrossel: "Carrossel", stories: "Stories" };

/** Próximo código livre da tag para o tipo ("F05" já existe → "F06"). */
export function nextPieceCode(titles: string[], tag: string, kind: PieceKind): string {
  const prefix = CODE_PREFIX[kind];
  const pattern = new RegExp(`^\\s*\\[${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\s*${prefix}(\\d+)\\b`, "i");
  const used = titles.map((t) => Number(t.match(pattern)?.[1] ?? 0));
  const next = Math.max(0, ...used) + 1;
  return `${prefix}${String(next).padStart(2, "0")}`;
}

/** Título no padrão das peças da campanha: "[OAB] F06 Feed — Nome". */
export function plannerTitle(tag: string, code: string, kind: PieceKind, name: string): string {
  return `[${tag}] ${code} ${KIND_WORD[kind]} — ${name.trim() || "Peça do Estúdio"}`;
}

export function slideLabel(kind: PieceKind, index: number): string {
  if (kind === "stories") return `Tela ${index + 1}`;
  if (kind === "carrossel") return `Slide ${index + 1}`;
  return "Arte";
}

export function slideFileName(kind: PieceKind, index: number): string {
  const base = kind === "stories" ? "story" : kind === "carrossel" ? "slide" : "post";
  return `${base}-${String(index + 1).padStart(2, "0")}.png`;
}

/**
 * Itens do checklist da solicitação: o texto de cada slide e, nos stories, o sticker
 * e a enquete entre colchetes (é o que /entregas mostra em "Na hora de postar").
 */
export function plannerChecklist(kind: PieceKind, slides: StudioSlide[], legenda: string): { label: string; content: string }[] {
  const items = slides.map((slide, index) => {
    const template = getTemplate(slide.modelo);
    const artFields = template ? template.campos.filter((c) => !POSTING_FIELD_KEYS.has(c.key)) : [];
    const lines = template ? valuesToLines(artFields, slide.valores) : [];
    const sticker = typeof slide.valores.sticker === "string" ? slide.valores.sticker.trim() : "";
    const enquete = typeof slide.valores.enquete === "string" ? slide.valores.enquete.trim() : "";
    if (enquete) lines.push(`[Enquete: ${enquete}]`);
    if (sticker) lines.push(`[Sticker: ${sticker}]`);
    const label =
      kind === "stories" ? `Tela ${index + 1} · texto exato` : kind === "carrossel" ? `Slide ${index + 1} · texto na arte` : "Texto na arte";
    return { label, content: lines.join("\n") };
  });
  if (legenda.trim()) items.push({ label: "Legenda para publicação", content: legenda.trim() });
  return items;
}
