/**
 * Motor de reconhecimento facial no navegador (@vladmandic/face-api).
 * Carregado sob demanda: ninguém baixa os ~12 MB de modelos sem usar o recurso.
 * Nada sai do navegador além dos descritores numéricos de quem consentiu.
 */

import { FACE_MIN_SIZE_PX, compactDescriptor, type FaceDescriptor } from "@/lib/event-photos/faces";

const MODELS_URL = "/models/face-api";

type FaceApi = typeof import("@vladmandic/face-api");
type FaceInput = HTMLCanvasElement | HTMLImageElement;

let enginePromise: Promise<FaceApi> | null = null;

export function loadFaceEngine(): Promise<FaceApi> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      // As tipagens do bundle omitem setBackend/ready, que existem em runtime.
      const tf = faceapi.tf as unknown as {
        setBackend(name: string): Promise<boolean>;
        ready(): Promise<void>;
      };
      const webgl = await tf.setBackend("webgl").catch(() => false);
      if (!webgl) await tf.setBackend("cpu");
      await tf.ready();
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
      ]);
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
      return faceapi;
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
