/**
 * Motor de reconhecimento facial no navegador (@vladmandic/face-api).
 * Carregado sob demanda: ninguém baixa os ~12 MB de modelos sem usar o recurso.
 * Nada sai do navegador além dos descritores numéricos de quem consentiu.
 */

import {
  FACE_MIN_SIZE_PX,
  compactDescriptor,
  euclideanDistance,
  type FaceDescriptor,
} from "@/lib/event-photos/faces";
import {
  FACE_SELFTEST_DESCRIPTOR,
  FACE_SELFTEST_MAX_DISTANCE,
  FACE_SELFTEST_MAX_LANDMARK_ERROR,
  FACE_SELFTEST_SIZE,
  faceSelfTestPixels,
  landmarkError,
} from "@/lib/event-photos/face-selftest";

const MODELS_URL = "/models/face-api";
/** Binários do backend WASM (mesma versão do tfjs embutido no face-api: 4.22.0). */
const WASM_URL = "/models/face-api/wasm/";
/** Do mais rápido ao mais lento; só fica o primeiro que passa no autoteste. */
const BACKENDS = ["webgl", "wasm", "cpu"] as const;

type FaceApi = typeof import("@vladmandic/face-api");
type FaceInput = HTMLCanvasElement | HTMLImageElement;
// As tipagens do bundle omitem setBackend/ready/setWasmPaths, que existem em runtime.
type Tf = {
  setBackend(name: string): Promise<boolean>;
  ready(): Promise<void>;
  setWasmPaths?(prefix: string): void;
  tensor3d(values: Int32Array, shape: [number, number, number], dtype: "int32"): { dispose(): void };
};

export const FACE_ENGINE_UNRELIABLE_MESSAGE =
  "Este aparelho não conseguiu calcular o reconhecimento facial com precisão. Tente em um computador, de preferência no Chrome ou no Edge.";

let enginePromise: Promise<FaceApi> | null = null;

/** Confere se o aparelho calcula a rede igual ao esperado (ver face-selftest.ts). */
async function passesSelfTest(faceapi: FaceApi): Promise<boolean> {
  const tf = faceapi.tf as unknown as Tf;
  const input = tf.tensor3d(faceSelfTestPixels(), [FACE_SELFTEST_SIZE, FACE_SELFTEST_SIZE, 3], "int32");
  try {
    const net = input as unknown as Parameters<FaceApi["computeFaceDescriptor"]>[0];
    const descriptor = (await faceapi.computeFaceDescriptor(net)) as Float32Array;
    const landmarks = (await faceapi.detectFaceLandmarks(net)) as { positions: Array<{ x: number; y: number }> };
    const points = landmarks.positions.flatMap((p) => [p.x, p.y]);
    return (
      euclideanDistance(descriptor, FACE_SELFTEST_DESCRIPTOR) < FACE_SELFTEST_MAX_DISTANCE &&
      landmarkError(points) < FACE_SELFTEST_MAX_LANDMARK_ERROR
    );
  } catch {
    return false;
  } finally {
    input.dispose();
  }
}

export function loadFaceEngine(): Promise<FaceApi> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      const tf = faceapi.tf as unknown as Tf;
      tf.setWasmPaths?.(WASM_URL);
      let loaded = false;
      for (const backend of BACKENDS) {
        if (!(await tf.setBackend(backend).catch(() => false))) continue;
        await tf.ready();
        if (!loaded) {
          await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
          ]);
          loaded = true;
        }
        // Aquecimento: no WebGL a 1ª inferência compila shaders e pode não detectar
        // rosto nenhum (visto em teste com foto corporativa nítida).
        const warm = document.createElement("canvas");
        warm.width = 256;
        warm.height = 256;
        await Promise.all([
          faceapi.detectAllFaces(warm, new faceapi.SsdMobilenetv1Options()),
          faceapi.detectFaceLandmarks(warm),
          faceapi.computeFaceDescriptor(warm),
        ]).catch(() => undefined);
        if (await passesSelfTest(faceapi)) return faceapi;
        console.warn(`[event-photos] reconhecimento facial impreciso no backend ${backend}; tentando o próximo`);
      }
      throw new Error(FACE_ENGINE_UNRELIABLE_MESSAGE);
    })().catch((err) => {
      enginePromise = null;
      throw err;
    });
  }
  return enginePromise;
}

interface DetectedFace {
  descriptor: FaceDescriptor;
  area: number;
}

async function detectFaces(input: FaceInput, minConfidence: number): Promise<DetectedFace[]> {
  const faceapi = await loadFaceEngine();
  const results = await faceapi
    .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence, maxResults: 60 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  return results
    .filter((r) => Math.min(r.detection.box.width, r.detection.box.height) >= FACE_MIN_SIZE_PX)
    .map((r) => ({
      descriptor: compactDescriptor(r.descriptor),
      area: r.detection.box.width * r.detection.box.height,
    }));
}

/** Todos os rostos legíveis de uma foto de evento. */
export async function faceDescriptorsIn(input: FaceInput): Promise<FaceDescriptor[]> {
  return (await detectFaces(input, 0.5)).map((f) => f.descriptor);
}

/** Rosto principal (maior) de uma foto corporativa, para servir de referência. */
export async function mainFaceDescriptor(input: FaceInput): Promise<FaceDescriptor | null> {
  const faces = await detectFaces(input, 0.6);
  if (faces.length === 0) return null;
  return faces.reduce((a, b) => (b.area > a.area ? b : a)).descriptor;
}

/** Carrega imagem pública do Storage liberando leitura de pixels (CORS). */
export function loadImageForFaces(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
    img.src = url;
  });
}
