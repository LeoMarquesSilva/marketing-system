"use client";

import { useEffect, useMemo, useState } from "react";
import { Film, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uploadReelDeliveryFile } from "@/lib/storage-buckets";
import { REEL_DELIVERY_VIDEO_MAX_BYTES, contentTypeForFile } from "@/lib/reel-deliveries/domain";
import type { ReelPerson, ReelSlotOption } from "@/lib/reel-deliveries/types";
import { ReelPeoplePicker } from "./reel-people-picker";
import { formatBytes, formatReelDate } from "./reel-delivery-ui";

export function VideoFileField({
  file,
  onChange,
  disabled,
  id,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-24 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[#9fc9d3] bg-[#f8fbfb] p-4 text-sm transition hover:border-[#347796] hover:bg-[#f0fafa] has-[:disabled]:cursor-not-allowed has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-[#47cdd0]/30"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-white text-[#347796] ring-1 ring-[#dce9eb]">
        {file ? <Film className="size-5" /> : <UploadCloud className="size-5" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-slate-900">{file ? file.name : "Escolher vídeo"}</span>
        <span className="block text-xs text-slate-500">
          {file ? formatBytes(file.size) : "MP4, MOV ou WebM, até 1 GB"}
        </span>
      </span>
      <input
        id={id}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

export function validateVideo(file: File | null): { contentType: string } | { error: string } {
  if (!file) return { error: "Escolha o vídeo." };
  const contentType = contentTypeForFile(file.name, file.type, "video");
  if (!contentType) return { error: "Formato não aceito. Use MP4, MOV ou WebM." };
  if (file.size > REEL_DELIVERY_VIDEO_MAX_BYTES) return { error: "O vídeo passa de 1 GB. Exporte numa qualidade menor." };
  return { contentType };
}

export function UploadProgress({ percent }: { percent: number }) {
  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <div className="flex justify-between text-xs text-slate-600">
        <span>Enviando vídeo…</span>
        <span className="font-mono tabular-nums">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#e3eef1]">
        <div className="h-full rounded-full bg-[#347796] transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function monthLabel(date: string) {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function ReelUploadDialog({
  open,
  onOpenChange,
  slots,
  people,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slots: ReelSlotOption[];
  people: ReelPerson[];
  /** Recebe o arquivo para a IA transcrever em segundo plano. */
  onCreated: (id: string, video: File) => void;
}) {
  const [slotId, setSlotId] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSlotId(""); setParticipants([]); setFile(null); setNotes(""); setProgress(null); setError(null);
    }
  }, [open]);

  const groups = useMemo(() => {
    const map = new Map<string, ReelSlotOption[]>();
    for (const slot of slots) {
      const key = slot.dueDate.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return [...map.entries()];
  }, [slots]);

  const selectedSlot = slots.find((slot) => slot.id === slotId) ?? null;
  const busy = progress !== null;

  function chooseSlot(id: string) {
    setSlotId(id);
    const slot = slots.find((item) => item.id === id);
    if (slot?.collaborator && participants.length === 0) setParticipants([slot.collaborator.id]);
  }

  async function submit() {
    setError(null);
    if (!selectedSlot) return setError("Escolha a data do cronograma.");
    if (participants.length === 0) return setError("Inclua quem aparece no vídeo.");
    const check = validateVideo(file);
    if ("error" in check) return setError(check.error);

    const id = crypto.randomUUID();
    try {
      setProgress(0);
      const { path } = await uploadReelDeliveryFile(id, file!, "video", check.contentType, { onProgress: setProgress });
      const response = await fetch("/api/reel-deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          slot_id: selectedSlot.id,
          participant_ids: participants,
          notes: notes.trim() || null,
          video: { path, file_name: file!.name, size_bytes: file!.size, content_type: check.contentType },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar o reel.");
      onCreated(id, file!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o reel.");
      setProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Enviar reel para aprovação</DialogTitle>
          <DialogDescription>
            Quem aparece no vídeo recebe para aprovar. Enquanto isso, a IA transcreve o vídeo e sugere título, subtítulo e legenda.
          </DialogDescription>
        </DialogHeader>

        {error && <p role="alert" className="rounded-md bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}

        <div className="grid gap-4 py-1">
          <div className="space-y-2">
            <Label>Data do cronograma</Label>
            <Select value={slotId} onValueChange={chooseSlot} disabled={busy}>
              <SelectTrigger className="w-full"><SelectValue placeholder={slots.length ? "Escolha o reel" : "Nenhuma data de reel livre"} /></SelectTrigger>
              <SelectContent className="max-h-80">
                {groups.map(([month, items]) => (
                  <SelectGroup key={month}>
                    <SelectLabel>{monthLabel(items[0].dueDate)}</SelectLabel>
                    {items.map((slot) => (
                      <SelectItem key={slot.id} value={slot.id}>
                        {formatReelDate(slot.dueDate)} · {slot.area} · {slot.collaborator?.name ?? slot.sourceName ?? "Sem responsável"}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quem aparece no vídeo</Label>
            <p className="text-xs text-slate-500">Todas as pessoas precisam aprovar.</p>
            <ReelPeoplePicker people={people} value={participants} onChange={setParticipants} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reel-video">Vídeo</Label>
            <VideoFileField id="reel-video" file={file} onChange={setFile} disabled={busy} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reel-notes">Recado para quem vai aprovar (opcional)</Label>
            <Textarea
              id="reel-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ex.: cortei o trecho do começo e ajustei as legendas."
              maxLength={2000}
              rows={2}
              disabled={busy}
            />
          </div>

          {progress !== null && <UploadProgress percent={progress} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={() => void submit()} disabled={busy} className="bg-[#347796] text-white hover:bg-[#285f7a]">
            {busy ? <Loader2 className="animate-spin" /> : <UploadCloud />}
            {busy ? "Enviando…" : "Enviar para aprovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
