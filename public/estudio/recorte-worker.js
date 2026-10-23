// Recorte de foto no navegador (Estúdio de peças) pelo Transformers.js. O modelo baixa
// uma vez e fica no cache do navegador.
// Mensagens: entra { id, file }; sai { id, type: "progresso" | "pronto" | "erro", ... }.
// Com ?cpu=1 no endereço do worker roda só no processador (a página recria o worker
// assim quando a GPU falha: depois de iniciada, a GPU fica presa ao ONNX Runtime).

import { RawImage, env, pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js";

env.allowLocalModels = false;

// GPU: BiRefNet lite (MIT), o melhor contorno. Processador: ormbg (Apache-2.0), feito
// para pessoas; o BiRefNet passa do limite de memória do WebAssembly.
const MODELS = {
  webgpu: { id: "onnx-community/BiRefNet_lite-ONNX", dtype: "fp16" },
  wasm: { id: "onnx-community/ormbg-ONNX", dtype: "q8" },
};
// foto maior que isso só pesa no envio; a arte usa no máximo uns 1000 px
const MAX_SIDE = 1800;

const CPU_ONLY = new URL(self.location.href).searchParams.has("cpu");

// { device, run } do recorte carregado
let current = null;

async function create(device, id) {
  const files = new Map();
  const model = MODELS[device];
  return pipeline("background-removal", model.id, {
    device,
    dtype: model.dtype,
    progress_callback: (p) => {
      if (p.status !== "progress" || !p.total) return;
      files.set(p.file, { loaded: p.loaded, total: p.total });
      let loaded = 0;
      let total = 0;
      for (const f of files.values()) {
        loaded += f.loaded;
        total += f.total;
      }
      self.postMessage({ id, type: "progresso", etapa: "baixando", loaded, total });
    },
  });
}

async function hasWebGpu() {
  return Boolean(self.navigator?.gpu && (await self.navigator.gpu.requestAdapter().catch(() => null)));
}

class GpuError extends Error {}

/**
 * Recorta na GPU quando há; se ela não der conta (algumas placas integradas passam do
 * limite de buffers do shader), avisa a página para recriar o worker no processador.
 */
async function segment(image, id) {
  if (!current) {
    const device = !CPU_ONLY && (await hasWebGpu()) ? "webgpu" : "wasm";
    try {
      current = { device, run: await create(device, id) };
    } catch (err) {
      if (device === "webgpu") throw new GpuError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
  self.postMessage({ id, type: "progresso", etapa: "recortando" });
  try {
    return await current.run(image);
  } catch (err) {
    if (current.device === "webgpu") throw new GpuError(err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function toRawImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, width, height);
  return new RawImage(data, width, height, 4);
}

/** PNG só com a área que sobrou (sem a borda transparente). */
async function trimmedPng(image) {
  const { data, width, height } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("Não sobrou nada da foto depois do recorte.");
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(data), width, height), -minX, -minY);
  return canvas.convertToBlob({ type: "image/png" });
}

self.onmessage = async (event) => {
  const { id, file } = event.data;
  try {
    const image = await toRawImage(file);
    const result = await segment(image, id);
    const blob = await trimmedPng(result);
    self.postMessage({ id, type: "pronto", blob });
  } catch (err) {
    self.postMessage({ id, type: "erro", gpu: err instanceof GpuError, message: err instanceof Error ? err.message : String(err) });
  }
};
