import { supabase } from "@/utils/supabase/client";
import {
  BIRTHDAY_ARTS_BUCKET,
  BIRTHDAY_ART_MAX_BYTES,
  BIRTHDAY_ART_TYPES,
  type BirthdayArtKind,
  type BirthdayArtType,
  type BirthdayArtsMonth,
} from "./birthday-arts";

type ArtTarget = { employeeId: string; kind: BirthdayArtKind; year: number };

async function call<T>(url: string, init?: { method: string; body: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    cache: "no-store",
    ...(init ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(init.body) } : {}),
  });
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.error ?? "Não foi possível concluir. Tente de novo.");
  return body;
}

export function fetchMonthArts(month: string): Promise<BirthdayArtsMonth> {
  return call<BirthdayArtsMonth>(`/api/inicio/artes-aniversario?mes=${month}`);
}

/** Sobe a arte como veio (sem recomprimir, para não perder qualidade) e devolve o link assinado. */
export async function uploadBirthdayArt(target: ArtTarget, file: File): Promise<string> {
  if (!(BIRTHDAY_ART_TYPES as readonly string[]).includes(file.type)) throw new Error("Envie a arte em PNG, JPG ou WebP.");
  if (file.size > BIRTHDAY_ART_MAX_BYTES) throw new Error("A arte passa de 10 MB.");
  const description = { ...target, content_type: file.type as BirthdayArtType, size_bytes: file.size };
  const upload = await call<{ path: string; token: string }>("/api/inicio/artes-aniversario/upload", {
    method: "POST",
    body: description,
  });
  const { error } = await supabase.storage
    .from(BIRTHDAY_ARTS_BUCKET)
    .uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type });
  if (error) throw new Error(`Não foi possível enviar a arte: ${error.message}`);
  const { artUrl } = await call<{ artUrl: string }>("/api/inicio/artes-aniversario", {
    method: "PUT",
    body: { ...description, storage_path: upload.path },
  });
  return artUrl;
}

export async function removeBirthdayArt(target: ArtTarget): Promise<void> {
  await call<{ ok: boolean }>("/api/inicio/artes-aniversario", { method: "DELETE", body: target });
}
