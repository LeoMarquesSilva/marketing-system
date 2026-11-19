"use client";

import { authFetch } from "@/lib/auth-fetch";

export const OPS_API = "/api/operacoes-legais/planner";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`${OPS_API}${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir. Tente de novo.");
  return data;
}

export const opsApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível concluir. Tente de novo.";
}
