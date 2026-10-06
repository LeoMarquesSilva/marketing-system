"use client";

import { uploadReelDeliveryFile } from "@/lib/storage-buckets";
import { REEL_AUDIO_MAX_BYTES } from "./domain";
import type { ReelDeliveryDetail } from "./types";

const SAMPLE_RATE = 16_000;

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Extrai a fala do vídeo no navegador: WAV mono 16 kHz, ~1,9 MB por minuto. */
export async function extractReelAudio(video: Blob): Promise<Blob> {
  const context = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(await video.arrayBuffer());
  } catch {
    throw new Error("Não deu para ler o áudio deste vídeo no navegador.");
  } finally {
    void context.close();
  }
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE)), SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const wav = encodeWav(rendered.getChannelData(0), SAMPLE_RATE);
  if (wav.size > REEL_AUDIO_MAX_BYTES) throw new Error("O vídeo é longo demais para transcrever automaticamente.");
  return wav;
}

async function postCopy(deliveryId: string, body: { audio_path?: string; overwrite: boolean }) {
  const response = await fetch(`/api/reel-deliveries/${deliveryId}/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "A IA não conseguiu gerar o texto agora.");
  return data as { delivery: ReelDeliveryDetail };
}

/**
 * Transcreve o vídeo e gera título, subtítulo e legenda. Com `video`, extrai e
 * sobe o áudio; sem ele, reaproveita a transcrição salva no servidor.
 */
export async function generateReelCopyFromVideo(
  deliveryId: string,
  video: Blob | null,
  overwrite: boolean
): Promise<{ delivery: ReelDeliveryDetail }> {
  if (!video) return postCopy(deliveryId, { overwrite });
  const audio = await extractReelAudio(video);
  const { path } = await uploadReelDeliveryFile(
    deliveryId,
    new File([audio], "audio.wav", { type: "audio/wav" }),
    "audio",
    "audio/wav"
  );
  return postCopy(deliveryId, { audio_path: path, overwrite });
}
