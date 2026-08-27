import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function request(path: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(`https://orquestrai.test${path}`, { headers });
}

describe("proxy — retorno após login", () => {
  it("guarda o check-in do Café com Cultura quando não há sessão", () => {
    const response = proxy(request("/cafe-com-cultura?source=nfc"));
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const next = new URL(location!, "https://orquestrai.test").searchParams.get("next");
    expect(next).toBe("/cafe-com-cultura?source=nfc");
  });

  it("não redireciona o check-in quando já há sessão", () => {
    const response = proxy(
      request("/cafe-com-cultura", "sb-xxx-auth-token=session")
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
