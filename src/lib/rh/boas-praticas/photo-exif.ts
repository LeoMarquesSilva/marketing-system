/**
 * Data em que a foto foi tirada, lida do EXIF de um JPEG (DateTimeOriginal,
 * senão DateTime). A foto é regravada antes do envio e perde os metadados,
 * então a data é lida do arquivo original. EXIF não guarda fuso: vale o
 * horário do escritório (America/Sao_Paulo, -03:00).
 */

const DATE_TIME = 0x0132;
const EXIF_IFD = 0x8769;
const DATE_TIME_ORIGINAL = 0x9003;

function exifDateToIso(raw: string): string | null {
  const match = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  if (y === "0000") return null;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}-03:00`;
}

/** Lê o valor ASCII de uma tag numa IFD do bloco TIFF. */
function readAsciiTag(view: DataView, tiff: number, ifd: number, tag: number, little: boolean): string | null {
  if (ifd + 2 > view.byteLength) return null;
  const count = view.getUint16(ifd, little);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) return null;
    if (view.getUint16(entry, little) !== tag) continue;
    const length = view.getUint32(entry + 4, little);
    const start = length > 4 ? tiff + view.getUint32(entry + 8, little) : entry + 8;
    if (start + length > view.byteLength) return null;
    let text = "";
    for (let j = 0; j < length; j++) {
      const code = view.getUint8(start + j);
      if (code === 0) break;
      text += String.fromCharCode(code);
    }
    return text;
  }
  return null;
}

function readOffsetTag(view: DataView, ifd: number, tag: number, little: boolean): number | null {
  if (ifd + 2 > view.byteLength) return null;
  const count = view.getUint16(ifd, little);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) return null;
    if (view.getUint16(entry, little) === tag) return view.getUint32(entry + 8, little);
  }
  return null;
}

export function readExifTakenAt(buffer: ArrayBuffer): string | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    const size = view.getUint16(offset + 2);
    if (marker === 0xffe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
      const tiff = offset + 10;
      if (tiff + 8 > view.byteLength) return null;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd0 = tiff + view.getUint32(tiff + 4, little);
      const exifPointer = readOffsetTag(view, ifd0, EXIF_IFD, little);
      const original = exifPointer !== null ? readAsciiTag(view, tiff, tiff + exifPointer, DATE_TIME_ORIGINAL, little) : null;
      const fallback = original ?? readAsciiTag(view, tiff, ifd0, DATE_TIME, little);
      return fallback ? exifDateToIso(fallback) : null;
    }
    // Fim dos metadados (início da imagem) ou marcador inválido.
    if (marker === 0xffda || (marker & 0xff00) !== 0xff00 || size < 2) return null;
    offset += 2 + size;
  }
  return null;
}
