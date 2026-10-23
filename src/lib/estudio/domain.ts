import { imageKeys, normalizeValues, valuesToLines, type FieldValues } from "./fields";
import { slugifyFileName } from "./images";
import { POSTING_FIELD_KEYS, getTemplate, templatesFor } from "./templates";
import { ADJUST_LIMITS, PIECE_MAX_SLIDES, type PieceKind, type SlideAdjust, type StudioSlide, type StudioTemplateDef } from "./types";

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
    const miolo = options.find((t) => t.id.endsWith("-programacao") || t.id.endsWith("-conteudo"));
    return [newSlide(capa), ...(miolo ? [newSlide(miolo)] : [])];
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
    const ajustes = normalizeAdjust(template, obj.ajustes);
    slides.push({
      id: typeof obj.id === "string" && obj.id ? obj.id : newId(),
      modelo: template.id,
      valores: normalizeValues(template.campos, obj.valores),
      ...(ajustes ? { ajustes } : {}),
    });
  }
  return slides.slice(0, PIECE_MAX_SLIDES[kind]);
}

/** Só os ajustes que o modelo aceita, dentro dos limites; sem nenhum ajuste, undefined. */
export function normalizeAdjust(template: StudioTemplateDef, raw: unknown): SlideAdjust | undefined {
  if (!raw || typeof raw !== "object" || !template.ajustes?.length) return undefined;
  const source = raw as Record<string, unknown>;
  const out: SlideAdjust = {};
  for (const key of template.ajustes) {
    const v = source[key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const { min, max, neutral } = ADJUST_LIMITS[key];
    const clamped = Math.min(max, Math.max(min, v));
    if (Math.abs(clamped - neutral) > 1e-6) out[key] = Math.round(clamped * 1000) / 1000;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Troca o modelo de um slide aproveitando os campos com o mesmo nome. */
export function switchSlideTemplate(slide: StudioSlide, template: StudioTemplateDef): StudioSlide {
  const merged = { ...template.exemplo, ...Object.fromEntries(Object.entries(slide.valores).filter(([k]) => template.campos.some((c) => c.key === k))) };
  return { ...slide, modelo: template.id, valores: normalizeValues(template.campos, merged) };
}

/**
 * A IA não vê nem devolve imagens: depois de um ajuste, cada slide recupera as fotos
 * e logos do slide que estava no mesmo lugar com o mesmo modelo (ou do primeiro slide
 * desse modelo que tinha a imagem).
 */
export function carryOverImages(previous: StudioSlide[], next: StudioSlide[]): StudioSlide[] {
  return next.map((slide, index) => {
    const template = getTemplate(slide.modelo);
    const keys = template ? imageKeys(template.campos) : [];
    // ajustes finos ficam com o slide que estava no mesmo lugar com o mesmo modelo
    const same = previous[index]?.modelo === slide.modelo ? previous[index] : null;
    if (same?.ajustes && !slide.ajustes) slide = { ...slide, ajustes: same.ajustes };
    if (keys.length === 0) return slide;
    const valores = { ...slide.valores };
    for (const key of keys) {
      if (valores[key]) continue;
      const source = same?.valores[key] ? same : previous.find((p) => p.modelo === slide.modelo && p.valores[key]);
      if (source) valores[key] = source.valores[key];
    }
    return { ...slide, valores };
  });
}

export interface AuthorProfile {
  name: string;
  gender: string | null;
  position: string | null;
  department: string | null;
}

/**
 * "Por: Dra. Fulana" e o cargo da capa a partir do cadastro do RH. Dr./Dra. e o
 * feminino/masculino do cargo vêm do gênero cadastrado; sem ele, sai sem tratamento.
 */
export function authorCredit(person: AuthorProfile, area: string): { autor: string; cargo: string } {
  const position = (person.position ?? "").trim();
  const dept = (person.department ?? "").trim() || area.trim();
  const g = person.gender === "F" ? "F" : person.gender === "M" ? "M" : null;
  const where = dept ? ` da área de ${dept}` : "";
  const roles: { re: RegExp; f: string; m: string; titled: boolean }[] = [
    { re: /advogad/i, f: "Advogada", m: "Advogado", titled: true },
    { re: /s[óo]ci/i, f: "Sócia", m: "Sócio", titled: true },
    { re: /estagi/i, f: "Estagiária", m: "Estagiário", titled: false },
    { re: /supervis/i, f: "Supervisora", m: "Supervisor", titled: false },
    { re: /coordena/i, f: "Coordenadora", m: "Coordenador", titled: false },
  ];
  const role = roles.find((r) => r.re.test(position));
  const honorific = role?.titled && g ? (g === "F" ? "Dra. " : "Dr. ") : "";
  let cargo: string;
  if (role) cargo = g ? `${g === "F" ? role.f : role.m}${where}` : dept ? `Área de ${dept}` : "";
  else cargo = position ? `${position}${where}` : dept ? `Área de ${dept}` : "";
  return { autor: `${honorific}${person.name.trim()}`, cargo };
}

/** Foto da galeria cujo nome traz o primeiro e o último nome da pessoa. */
export function matchPhoto(paths: string[], name: string): string | null {
  const tokens = slugifyFileName(name).split("-").filter((t) => t.length > 1);
  if (tokens.length === 0) return null;
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const hit = paths.find((p) => {
    const slug = slugifyFileName(p.split("/").pop() ?? "");
    return slug.includes(first) && (tokens.length === 1 || slug.includes(last));
  });
  return hit ?? null;
}

const normalizeForMatch = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\*\*/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Frases do miolo de um post do Gerador (sem a capa, os títulos e as marcações de
 * roteiro), para conferir se a IA não deixou nada de fora.
 */
export function approvedSentences(post: string): string[] {
  const sections = post.split(/\n\s*-{3,}\s*\n/);
  const body = sections.filter((section, i) => !(i === 0 && /capa/i.test(section.split("\n").slice(0, 3).join(" "))));
  const lines = body
    .flatMap((section) => section.split("\n"))
    // títulos marcados podem mudar de caixa e de forma no slide
    .filter((line) => !/^\s*(\*\*)?\s*(T[íi]tulo|Subt[íi]tulo)\s*:?/i.test(line))
    .map((line) =>
      line
        .replace(/\*\*(T[íi]tulo|Subt[íi]tulo|Conte[úu]do):?\*\*:?/gi, "")
        .replace(/^(T[íi]tulo|Subt[íi]tulo|Conte[úu]do):/i, "")
        .replace(/^[\s·•\-–*]+/, "")
        .replace(/\*\*/g, "")
        .trim()
    )
    .filter((line) => line && !/^slide\b/i.test(line) && !/^post em carrossel/i.test(line))
    // título de slide: linha curta sem pontuação final
    .filter((line) => /[.?!:;)]$/.test(line) || line.length >= 80);
  return lines.flatMap((line) => line.split(/(?<=[.?!])\s+/)).map((s) => s.trim()).filter((s) => s.length >= 25);
}

/** Frases do post que não aparecem em nenhum texto dos slides. */
export function missingSentences(post: string, slides: StudioSlide[]): string[] {
  const all = normalizeForMatch(slides.map((s) => JSON.stringify(s.valores).replace(/\\n/g, " ")).join(" "));
  return approvedSentences(post).filter((s) => !all.includes(normalizeForMatch(s)));
}

/** "Título da matéria - conjur.com.br" → "Título da matéria" */
export function cleanSourceTitle(title: string): string {
  return title.replace(/\s+[-–|]\s+[a-z0-9.-]+\.(com|org|net|jus|gov)(\.br)?\s*$/i, "").trim();
}

/** Tira slides repetidos (mesmo modelo e mesmo conteúdo) — a IA às vezes duplica o último. */
export function dropDuplicateSlides(slides: StudioSlide[]): StudioSlide[] {
  const seen = new Set<string>();
  return slides.filter((slide) => {
    const key = `${slide.modelo}:${JSON.stringify(slide.valores)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
