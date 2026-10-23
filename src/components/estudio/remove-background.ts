/**
 * Tira o fundo de uma foto no navegador (worker em public/estudio/recorte-worker.js).
 * Um worker só para a página: o modelo carrega uma vez e as próximas fotos são rápidas.
 * Tenta a GPU (WebGPU); se ela falhar, recria o worker no processador e lembra disso
 * neste navegador.
 */

export type RemoveProgress = { etapa: "baixando"; loaded: number; total: number } | { etapa: "recortando" };

type Job = { file: Blob; resolve: (blob: Blob) => void; reject: (err: Error) => void; onProgress?: (p: RemoveProgress) => void };

const CPU_KEY = "estudio:recorte-cpu";

let worker: Worker | null = null;
let nextId = 1;
const jobs = new Map<number, Job>();

function cpuOnly(): boolean {
  try {
    return window.localStorage.getItem(CPU_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberCpu() {
  try {
    window.localStorage.setItem(CPU_KEY, "1");
  } catch {
    // sem armazenamento: só tenta a GPU de novo na próxima visita
  }
}

function getWorker(): Worker {
  if (worker) return worker;
  const current = new Worker(`/estudio/recorte-worker.js${cpuOnly() ? "?cpu=1" : ""}`, { type: "module" });
  current.onmessage = (event: MessageEvent) => {
    const { id, type } = event.data as { id: number; type: string };
    const job = jobs.get(id);
    if (!job) return;
    if (type === "progresso") {
      const { etapa, loaded, total } = event.data;
      job.onProgress?.(etapa === "baixando" ? { etapa, loaded, total } : { etapa: "recortando" });
    } else if (type === "pronto") {
      jobs.delete(id);
      job.resolve(event.data.blob as Blob);
    } else if (event.data.gpu && !cpuOnly()) {
      // a GPU fica presa ao ONNX Runtime do worker: recomeça noutro, só no processador
      console.warn("[recorte] GPU falhou, usando o processador:", event.data.message);
      rememberCpu();
      current.terminate();
      worker = null;
      getWorker().postMessage({ id, file: job.file });
    } else {
      jobs.delete(id);
      job.reject(new Error(event.data.message || "O recorte falhou."));
    }
  };
  current.onerror = (event) => {
    // o import do CDN falhou (sem internet, bloqueio de rede): avisa todos e recomeça na próxima
    for (const job of jobs.values()) job.reject(new Error(event.message || "Não foi possível carregar o recorte."));
    jobs.clear();
    current.terminate();
    worker = null;
  };
  worker = current;
  return current;
}

export function removeBackground(file: Blob, onProgress?: (p: RemoveProgress) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    jobs.set(id, { file, resolve, reject, onProgress });
    getWorker().postMessage({ id, file });
  });
}

/** "Baixando o recorte (só na primeira vez)… 42%" / "Tirando o fundo… (…)" */
export function describeProgress(p: RemoveProgress | null): string {
  if (!p) return "Preparando…";
  if (p.etapa === "recortando") return "Tirando o fundo… (no processador pode levar até 1 minuto)";
  const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0;
  return `Baixando o recorte (só na primeira vez)… ${pct}%`;
}
