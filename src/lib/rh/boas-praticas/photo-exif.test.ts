import { describe, expect, it } from "vitest";
import { readExifTakenAt } from "./photo-exif";

/** JPEG mínimo com APP1/Exif: IFD0 → ExifIFD com DateTimeOriginal. */
function jpegWithExif(date: string, little: boolean): ArrayBuffer {
  const ascii = [...date].map((c) => c.charCodeAt(0)).concat(0); // 20 bytes
  const tiff: number[] = [];
  const u16 = (v: number) => (little ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) =>
    little ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24] : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  // Cabeçalho TIFF (8) + IFD0 com 1 entrada (2+12+4=18) → ExifIFD em 26, com 1 entrada (18) → texto em 44.
  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0));
  tiff.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(ascii.length), ...u32(44), ...u32(0));
  tiff.push(...ascii);
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const bytes = [0xff, 0xd8, 0xff, 0xe1, ...[(app1.length + 2) >> 8, (app1.length + 2) & 0xff], ...app1, 0xff, 0xda, 0, 2];
  return new Uint8Array(bytes).buffer;
}

describe("readExifTakenAt", () => {
  it("lê DateTimeOriginal nas duas ordens de bytes", () => {
    expect(readExifTakenAt(jpegWithExif("2026:10:20 18:42:05", true))).toBe("2026-10-20T18:42:05-03:00");
    expect(readExifTakenAt(jpegWithExif("2026:10:20 18:42:05", false))).toBe("2026-10-20T18:42:05-03:00");
  });

  it("ignora arquivo que não é JPEG ou sem data", () => {
    expect(readExifTakenAt(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull();
    expect(readExifTakenAt(jpegWithExif("0000:00:00 00:00:00", true))).toBeNull();
    expect(readExifTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer)).toBeNull();
  });
});
