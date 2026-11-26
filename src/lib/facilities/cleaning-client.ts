"use client";

import { supabase } from "@/utils/supabase/client";
import type { CleaningDayView, CleaningMonthView, CleaningScheduleView } from "./cleaning-server";
import type { CleaningKind, NotDoneReason } from "./cleaning";
import type { CleaningGuide } from "./cleaning-guide";
import { FACILITIES_BUCKET } from "./types";

async function call<T>(url: string, init?: { method: string; body?: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir. Tente de novo.");
  return data;
}

type DayResponse = { day: CleaningDayView };
type MonthResponse = { month: CleaningMonthView };
type ScheduleResponse = { schedule: CleaningScheduleView };

export const cleaningApi = {
  day: (day?: string) => call<DayResponse>(`/api/limpeza/dia${day ? `?dia=${day}` : ""}`).then((r) => r.day),
  mark: (input: { day: string; area_id: string; status: "limpo" | "nao_limpo"; reason?: NotDoneReason | null; note?: string }) =>
    call<DayResponse>("/api/limpeza/marcar", { method: "POST", body: input }).then((r) => r.day),
  unmark: (day: string, areaId: string) =>
    call<DayResponse>("/api/limpeza/marcar", { method: "DELETE", body: { day, area_id: areaId } }).then((r) => r.day),
  close: (day: string, note: string) => call<DayResponse>("/api/limpeza/encerrar", { method: "POST", body: { day, note } }).then((r) => r.day),
  undoClose: (day: string) => call<DayResponse>("/api/limpeza/encerrar", { method: "DELETE", body: { day } }).then((r) => r.day),
  photoUrl: (issueId: string) => call<{ url: string }>(`/api/limpeza/avisos/${issueId}/foto`).then((r) => r.url),

  month: (month: string) => call<MonthResponse>(`/api/facilities/limpeza/mes?mes=${month}`).then((r) => r.month),
  dayAction: (
    day: string,
    body: { action: "assinar"; result: "ok" | "ressalvas"; note: string } | { action: "reabrir" | "sem_limpeza"; reason: string } | { action: "com_limpeza" }
  ) => call<MonthResponse>(`/api/facilities/limpeza/dias/${day}`, { method: "POST", body }).then((r) => r.month),
  weekNote: (monday: string, note: string, month: string) =>
    call<MonthResponse>(`/api/facilities/limpeza/semanas/${monday}`, { method: "PUT", body: { note, month } }).then((r) => r.month),
  issueAction: (id: string, body: { action: "resolver"; note: string; month: string } | { action: "reabrir" | "manutencao"; month: string }) =>
    call<MonthResponse>(`/api/facilities/limpeza/avisos/${id}`, { method: "POST", body }).then((r) => r.month),

  schedule: () => call<ScheduleResponse>("/api/facilities/limpeza/cronograma").then((r) => r.schedule),
  scheduleAction: (
    body:
      | { action: "celula"; area_id: string; week: number; weekday: number; kind: CleaningKind }
      | { action: "novo_ambiente"; name: string }
      | { action: "renomear"; area_id: string; name: string }
      | { action: "ativo"; area_id: string; active: boolean }
      | { action: "mover"; area_id: string; direction: "subir" | "descer" }
  ) => call<ScheduleResponse>("/api/facilities/limpeza/cronograma", { method: "POST", body }).then((r) => r.schedule),

  guideSeen: (guide: CleaningGuide) => call<{ guide: CleaningGuide }>("/api/limpeza/guia", { method: "POST", body: { guide } }),
};

/** Foto do celular vira JPEG de até 1600 px antes de subir (leve e sem HEIC). */
async function toJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Não deu para ler a foto. Tente tirar de novo."));
      img.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não deu para preparar a foto."))), "image/jpeg", 0.82)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Registra o aviso; a foto (opcional) sobe antes, direto no bucket privado. */
export async function sendCleaningIssue(input: { day: string; areaId: string | null; description: string; photo: File | null }): Promise<CleaningDayView> {
  let photoPath: string | null = null;
  if (input.photo) {
    const blob = await toJpeg(input.photo);
    const upload = await call<{ path: string; token: string; content_type: string }>("/api/limpeza/avisos/upload", {
      method: "POST",
      body: { day: input.day, file_name: "aviso.jpg", size_bytes: blob.size },
    });
    const { error } = await supabase.storage.from(FACILITIES_BUCKET).uploadToSignedUrl(upload.path, upload.token, blob, { contentType: "image/jpeg" });
    if (error) throw new Error(`Não foi possível enviar a foto: ${error.message}`);
    photoPath = upload.path;
  }
  return call<DayResponse>("/api/limpeza/avisos", {
    method: "POST",
    body: { day: input.day, area_id: input.areaId, description: input.description, photo_path: photoPath },
  }).then((r) => r.day);
}

/** Abre a foto do aviso numa aba nova (URL assinada de 10 min). */
export async function openIssuePhoto(issueId: string): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const url = await cleaningApi.photoUrl(issueId);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (error) {
    tab?.close();
    throw error;
  }
}
