/**
 * Autoteste do motor de reconhecimento no aparelho de quem usa.
 *
 * Alguns aparelhos calculam a rede em precisão reduzida (ex.: WebGL só com float16) e devolvem
 * descritores sem sentido: todo mundo fica "parecido" com todo mundo. Antes de usar o motor,
 * passamos uma imagem sintética fixa e comparamos com a resposta calculada em precisão total.
 * Os valores esperados vêm do mesmo modelo rodando em WASM (tfjs 4.22).
 */

export const FACE_SELFTEST_SIZE = 112;
/** Distância máxima aceita entre o descritor do aparelho e o esperado. */
export const FACE_SELFTEST_MAX_DISTANCE = 0.05;
/** Erro médio máximo dos 68 pontos do rosto, em fração do lado da imagem. */
export const FACE_SELFTEST_MAX_LANDMARK_ERROR = 0.02;

/** Imagem RGB sintética, só com aritmética inteira (idêntica em qualquer navegador). */
export function faceSelfTestPixels(): Int32Array {
  const size = FACE_SELFTEST_SIZE;
  const out = new Int32Array(size * size * 3);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const cx = x - 56;
      const cy = y - 50;
      const ring = (cx * cx + cy * cy) >> 5;
      for (let c = 0; c < 3; c += 1) {
        out[(y * size + x) * 3 + c] = (ring * (c + 3) + x * (5 - c) + y * (c * 2 + 1)) & 255;
      }
    }
  }
  return out;
}

export const FACE_SELFTEST_DESCRIPTOR: readonly number[] = [
  -0.12242, 0.14211, 0.04408, -0.08792, -0.06984, -0.03958, -0.06815, -0.00134,
  0.12747, -0.0097, 0.23528, -0.01657, -0.25176, -0.06275, 0.02064, 0.10002,
  -0.18445, -0.08432, -0.16602, -0.06697, 0.05235, 0.03921, 0.00173, 0.05614,
  -0.11964, -0.28395, -0.05307, -0.07541, 0.02737, -0.16922, 0.03296, 0.06007,
  -0.10207, -0.04081, 0.0087, 0.05232, -0.01253, -0.08889, 0.16282, -0.07306,
  -0.20118, -0.0624, 0.08523, 0.29806, 0.16348, 0.05588, 0.01418, -0.03309,
  0.0582, -0.25876, 0.04428, 0.20741, 0.03471, 0.09996, 0.09652, -0.1531,
  0.03156, 0.08824, -0.19334, 0.03477, 0.03481, -0.12548, -0.04805, -0.1697,
  0.20372, 0.09386, -0.14263, -0.19918, 0.1148, -0.16357, -0.08467, 0.1636,
  -0.1176, -0.2019, -0.25798, 0.02102, 0.31526, 0.19107, -0.14286, 0.06252,
  -0.08168, -0.13085, -0.01718, 0.13743, -0.01321, 0.04656, -0.08517, 0.07617,
  0.17785, -0.05403, 0.02163, 0.25482, 0.03854, -0.04804, -0.04285, 0.04895,
  -0.09096, 0.03624, -0.06219, 0.02676, 0.10617, -0.06911, 0.0105, 0.06605,
  -0.12089, 0.15637, 0.02608, 0.02633, -0.00517, -0.03228, -0.03419, -0.08628,
  0.18936, -0.27887, 0.16129, 0.19594, 0.09272, 0.11173, 0.02205, 0.12702,
  0.03079, -0.05175, -0.15252, -0.04096, 0.01245, -0.0462, -0.00801, 0.05089,
];
/** Pontos (x, y) intercalados, em pixels da imagem de 112x112. */
export const FACE_SELFTEST_LANDMARKS: readonly number[] = [
  33.72, 57.31, 44.03, 62.78, 45.4, 67.4, 49.37, 73.67,
  55.88, 71.56, 60.38, 69.76, 67.98, 64.6, 64.98, 59.7,
  73.74, 63.12, 72.69, 61.12, 71.64, 57.27, 66.94, 64.56,
  70.11, 55.91, 70.1, 61.67, 68.46, 52.43, 75.29, 49.05,
  61.46, 40.08, 41.5, 70.32, 45.38, 66.01, 44.47, 68.31,
  49.96, 63.26, 54.72, 65.12, 64.6, 58.21, 60.27, 62.76,
  60.93, 64.38, 62.87, 58.59, 66.43, 45.53, 60.37, 65.04,
  60.79, 63.91, 58.09, 64.66, 57.34, 66.08, 55.17, 63.6,
  55.4, 63.05, 59, 63.08, 60.09, 62.36, 62.47, 60.07,
  51.41, 70.37, 51.91, 71.01, 53.48, 70.09, 54.32, 68.62,
  54.14, 71.45, 51.95, 71.16, 55.29, 60.93, 58.41, 65.22,
  62, 61.87, 58.38, 55.54, 58.39, 58.66, 58.24, 64.36,
  58.41, 61.59, 61.7, 63.67, 56.42, 61.58, 60.37, 60.01,
  61.96, 58.5, 63.07, 56.24, 65.51, 50.25, 62.43, 59.36,
  64.34, 59.81, 65.51, 59.67, 68.44, 63.97, 64.1, 63.71,
  59.24, 62.63, 65.21, 64.23, 64.73, 59.2, 65.96, 60.56,
  65.93, 52.5, 62.37, 55.35, 63.04, 58.64, 63.19, 62.3,
];

export function landmarkError(points: ArrayLike<number>, expected: ArrayLike<number> = FACE_SELFTEST_LANDMARKS): number {
  if (points.length !== expected.length || expected.length === 0) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < expected.length; i += 2) {
    sum += Math.hypot(points[i] - expected[i], points[i + 1] - expected[i + 1]);
  }
  return sum / (expected.length / 2) / FACE_SELFTEST_SIZE;
}
