import { afterEach, describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./cron-auth";

const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }
});

describe("isAuthorizedCronRequest", () => {
  it("rejeita a chamada quando CRON_SECRET não está configurado", () => {
    delete process.env.CRON_SECRET;
    const request = new Request("https://example.com/api/cron", {
      headers: { "x-vercel-cron": "1" },
    });

    expect(isAuthorizedCronRequest(request)).toBe(false);
  });

  it("rejeita um x-vercel-cron sem o bearer correto", () => {
    process.env.CRON_SECRET = "segredo-correto";
    const request = new Request("https://example.com/api/cron", {
      headers: { "x-vercel-cron": "1" },
    });

    expect(isAuthorizedCronRequest(request)).toBe(false);
  });

  it("aceita apenas o bearer com o CRON_SECRET", () => {
    process.env.CRON_SECRET = "  segredo-correto  ";
    const request = new Request("https://example.com/api/cron", {
      headers: { Authorization: "Bearer segredo-correto" },
    });

    expect(isAuthorizedCronRequest(request)).toBe(true);
  });
});
