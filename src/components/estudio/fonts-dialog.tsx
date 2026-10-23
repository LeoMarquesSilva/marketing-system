"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Trash2, TriangleAlert, Type, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FONT_FAMILY_RE, STUDIO_FONT_SLOTS, suggestSlot, type StudioFontRow } from "@/lib/estudio/fonts";

interface SlotStatus {
  key: string;
  family: string;
  weight: number;
  label: string;
  origem: "pasta" | "envio" | null;
  fontId: string | null;
}

interface Pending {
  file: File;
  postscript: string | null;
  /** chave do lugar do modelo, ou "nova" */
  destino: string;
  familia: string;
  peso: number;
  estilo: "normal" | "italic";
}

const NOVA = "nova";

/** Lê nome, peso e estilo do arquivo para sugerir onde a fonte entra. */
async function readFontInfo(file: File) {
  try {
    const fontkit = (await import("@pdf-lib/fontkit")).default;
    const font = fontkit.create(new Uint8Array(await file.arrayBuffer()));
    const os2 = font["OS/2"] as unknown as { usWeightClass?: number } | undefined;
    return {
      family: font.familyName ?? "",
      subfamily: font.subfamilyName ?? "",
      postscript: font.postscriptName ?? null,
      weight: Math.min(900, Math.max(100, Math.round((os2?.usWeightClass ?? 400) / 100) * 100)),
      italic: font.italicAngle !== 0 || /italic|oblique/i.test(font.subfamilyName ?? ""),
    };
  } catch {
    return null;
  }
}

function applyCss(css: string) {
  const style = document.createElement("style");
  style.dataset.estudioFonte = "1";
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Fontes do Estúdio: mostra quais fontes dos modelos estão faltando (a arte cai na
 * Montserrat) e deixa subir o arquivo uma vez, sem mexer no código.
 */
export function FontsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [slots, setSlots] = useState<SlotStatus[]>([]);
  const [fonts, setFonts] = useState<StudioFontRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // lugar escolhido antes de abrir o seletor de arquivo ("Enviar" na linha do modelo)
  const target = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/estudio/fontes", { credentials: "include", cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Não foi possível carregar as fontes.");
      setSlots(body.slots);
      setFonts(body.fonts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as fontes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function pick(file: File) {
    setError(null);
    setDone(null);
    const info = await readFontInfo(file);
    const name = `${info?.family ?? ""} ${info?.subfamily ?? ""} ${info?.postscript ?? ""} ${file.name}`;
    const slot = target.current ? STUDIO_FONT_SLOTS.find((s) => s.key === target.current) : suggestSlot(name, info?.weight ?? 400);
    target.current = null;
    setPending({
      file,
      postscript: info?.postscript ?? null,
      destino: slot?.key ?? NOVA,
      familia: (info?.family || file.name.replace(/\.[a-z0-9]+$/i, "")).replace(/[^A-Za-zÀ-ÿ0-9 ._-]/g, "").slice(0, 60),
      peso: info?.weight ?? 400,
      estilo: info?.italic ? "italic" : "normal",
    });
  }

  async function send() {
    if (!pending) return;
    const slot = STUDIO_FONT_SLOTS.find((s) => s.key === pending.destino);
    const familia = slot ? slot.family : pending.familia.trim();
    const peso = slot ? slot.weight : pending.peso;
    const estilo = slot ? "normal" : pending.estilo;
    if (!FONT_FAMILY_RE.test(familia)) {
      setError("Dê um nome à família (letras, números, espaço, ponto ou hífen).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("arquivo", pending.file);
      form.append("familia", familia);
      form.append("peso", String(peso));
      form.append("estilo", estilo);
      if (pending.postscript) form.append("postscript", pending.postscript);
      const res = await fetch("/api/estudio/fontes", { method: "POST", body: form, credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Não foi possível enviar a fonte.");
      applyCss(body.css);
      setDone(`${slot ? slot.label.split(" · ")[0] : `${familia} ${peso}`} pronta: as artes já usam a fonte.`);
      setPending(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a fonte.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir esta fonte? As artes voltam para a fonte reserva depois de recarregar a página.")) return;
    setDone(null);
    const res = await fetch(`/api/estudio/fontes/db/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) await load();
    else setError("Não foi possível excluir a fonte.");
  }

  function chooseFile(slotKey: string | null) {
    target.current = slotKey;
    fileRef.current?.click();
  }

  const slotIds = new Set(slots.map((s) => s.fontId).filter(Boolean));
  const others = fonts.filter((f) => !slotIds.has(f.id));

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fontes do Estúdio</DialogTitle>
          <DialogDescription>
            Fontes licenciadas dos modelos. Enquanto uma estiver faltando, a arte usa a Montserrat no lugar. Envie o arquivo .otf ou .ttf uma vez e ele passa a valer para todo mundo.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
            <section className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground">Usadas pelos modelos</h4>
              <ul className="divide-y divide-black/[0.06] border border-black/[0.08]">
                {slots.map((slot) => (
                  <li key={slot.key} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm" style={{ fontFamily: `"${slot.family}", sans-serif`, fontWeight: slot.weight }}>
                        {slot.label.split(" · ")[0]}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">{slot.label.split(" · ")[1]}</span>
                    </span>
                    {slot.origem ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                        <Check className="h-3.5 w-3.5" /> {slot.origem === "pasta" ? "Instalada" : "Enviada"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                        <TriangleAlert className="h-3.5 w-3.5" /> Faltando
                      </span>
                    )}
                    <button type="button" onClick={() => chooseFile(slot.key)} className="text-xs font-medium text-[#347796] hover:text-[#04202f]">
                      {slot.origem ? "Trocar" : "Enviar"}
                    </button>
                    {slot.fontId && (
                      <button type="button" onClick={() => void remove(slot.fontId!)} className="p-1 text-muted-foreground hover:text-destructive" aria-label={`Excluir ${slot.label}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground">Outras fontes (para modelos novos)</h4>
                <button type="button" onClick={() => chooseFile(null)} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#347796] hover:text-[#04202f]">
                  <Upload className="h-3.5 w-3.5" /> Enviar fonte
                </button>
              </div>
              {others.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma ainda.</p>
              ) : (
                <ul className="divide-y divide-black/[0.06] border border-black/[0.08]">
                  {others.map((font) => (
                    <li key={font.id} className="flex items-center gap-3 px-3 py-2">
                      <Type className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm" style={{ fontFamily: `"${font.familia}", sans-serif`, fontWeight: font.peso, fontStyle: font.estilo }}>
                          {font.familia} {font.peso}
                          {font.estilo === "italic" ? " itálico" : ""}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">{font.nome_original}</span>
                      </span>
                      <button type="button" onClick={() => void remove(font.id)} className="p-1 text-muted-foreground hover:text-destructive" aria-label={`Excluir ${font.familia}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {pending && (
              <section className="space-y-3 border border-[#47cdd0]/50 bg-[#47cdd0]/[0.06] p-3">
                <p className="text-sm font-medium">{pending.file.name}</p>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">Usar como</span>
                  <select
                    value={pending.destino}
                    onChange={(e) => setPending({ ...pending, destino: e.target.value })}
                    className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm"
                  >
                    {STUDIO_FONT_SLOTS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                    <option value={NOVA}>Fonte nova (para modelos novos)</option>
                  </select>
                </label>
                {pending.destino === NOVA && (
                  <div className="grid grid-cols-[1fr_110px_110px] gap-2">
                    <label className="space-y-1">
                      <span className="text-xs font-medium">Família</span>
                      <Input value={pending.familia} onChange={(e) => setPending({ ...pending, familia: e.target.value })} className="h-9 bg-white" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium">Peso</span>
                      <select value={pending.peso} onChange={(e) => setPending({ ...pending, peso: Number(e.target.value) })} className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm">
                        {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium">Estilo</span>
                      <select value={pending.estilo} onChange={(e) => setPending({ ...pending, estilo: e.target.value === "italic" ? "italic" : "normal" })} className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm">
                        <option value="normal">Normal</option>
                        <option value="italic">Itálico</option>
                      </select>
                    </label>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setPending(null)} disabled={busy} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                    Cancelar
                  </button>
                  <button type="button" onClick={() => void send()} disabled={busy} className="inline-flex items-center gap-1.5 bg-[#04202f] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Enviar
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        {done && <p className="text-sm text-emerald-700">{done}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <input
          ref={fileRef}
          type="file"
          accept=".otf,.ttf,.woff,.woff2,font/otf,font/ttf,font/woff,font/woff2"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void pick(file);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
