import { describe, expect, it } from "vitest";
import { buildInstagramReelEmbedUrl } from "@/components/profiles/profile-instagram-reel";

describe("buildInstagramReelEmbedUrl", () => {
  it("converte Reel público em URL canônica de incorporação", () => {
    expect(
      buildInstagramReelEmbedUrl(
        "https://www.instagram.com/reel/DAtegZsygMk/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ=="
      )
    ).toBe("https://www.instagram.com/reel/DAtegZsygMk/embed/");
  });

  it("aceita o caminho reels e o host sem www", () => {
    expect(
      buildInstagramReelEmbedUrl("https://instagram.com/reels/AbC_123-xyz")
    ).toBe("https://www.instagram.com/reel/AbC_123-xyz/embed/");
  });

  it.each([
    "https://instagram.com.evil.example/reel/DAtegZsygMk/",
    "https://www.instagram.com/p/DAtegZsygMk/",
    "javascript:alert(1)",
    "",
  ])("não incorpora uma URL não permitida: %s", (url) => {
    expect(buildInstagramReelEmbedUrl(url)).toBeNull();
  });
});
