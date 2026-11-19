"use client";

/** Foto do drink tirada no celular: corrige a rotação, reduz para no máximo 1600 px e regrava em JPEG (sem GPS). */

const MAX_SIDE = 1600;
const QUALITY = 0.82;

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    // Safari antigo: a <img> já respeita a rotação da câmera.
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      await image.decode();
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("Não deu para ler essa foto. Tire de novo ou escolha outra.");
    }
  }
}

export async function prepareDrinkPhoto(file: File): Promise<Blob> {
  if (file.type && !file.type.startsWith("image/")) throw new Error("Escolha uma foto.");
  const image = await decode(file);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("O navegador não conseguiu preparar a foto.");
    context.drawImage(image.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) throw new Error("O navegador não conseguiu preparar a foto.");
    return blob;
  } finally {
    image.close();
  }
}
