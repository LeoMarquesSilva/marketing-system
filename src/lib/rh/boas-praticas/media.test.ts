import { describe, expect, it } from "vitest";
import { formatDuration, formatMegabytes, isVideoFile, videoProblem, videoTypeOf } from "./media";

const MB = 1024 * 1024;

describe("videoTypeOf", () => {
  it("usa o tipo do navegador e, sem ele, a extensão", () => {
    expect(videoTypeOf({ name: "cozinha.mp4", type: "video/mp4" })).toBe("video/mp4");
    expect(videoTypeOf({ name: "IMG_0412.MOV", type: "" })).toBe("video/quicktime");
    expect(videoTypeOf({ name: "sala.webm", type: "application/octet-stream" })).toBe("video/webm");
  });

  it("recusa formato fora da lista", () => {
    expect(videoTypeOf({ name: "gravacao.avi", type: "video/x-msvideo" })).toBeNull();
    expect(videoTypeOf({ name: "foto.mp4", type: "image/jpeg" })).toBeNull();
  });
});

describe("isVideoFile e videoProblem", () => {
  it("separa vídeo de foto", () => {
    expect(isVideoFile({ name: "IMG_0412.MOV", type: "" })).toBe(true);
    expect(isVideoFile({ name: "foto.jpg", type: "image/jpeg" })).toBe(false);
  });

  it("recusa vídeo acima de 200 MB ou em formato não aceito", () => {
    expect(videoProblem({ name: "ok.mp4", type: "video/mp4", size: 150 * MB })).toBeNull();
    expect(videoProblem({ name: "longo.mp4", type: "video/mp4", size: 201 * MB })).toMatch(/200 MB/);
    expect(videoProblem({ name: "x.avi", type: "video/x-msvideo", size: MB })).toMatch(/MP4, MOV ou WebM/);
  });
});

describe("formatDuration e formatMegabytes", () => {
  it("formata a duração como no player", () => {
    expect(formatDuration(7)).toBe("0:07");
    expect(formatDuration(75.4)).toBe("1:15");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(null)).toBeNull();
  });

  it("formata o tamanho em MB", () => {
    expect(formatMegabytes(12 * MB)).toBe("12 MB");
    expect(formatMegabytes(850_000)).toBe("0,8 MB");
  });
});
