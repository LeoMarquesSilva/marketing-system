import type { CelebrationDetail, CelebrationPraiseKey, CelebrationTarget } from "./celebrations";

async function call<T>(url: string, init?: { method: string; body: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    cache: "no-store",
    ...(init ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(init.body) } : {}),
  });
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.error ?? "Não foi possível concluir. Tente de novo.");
  return body;
}

export function fetchCelebration(target: CelebrationTarget): Promise<CelebrationDetail> {
  const query = new URLSearchParams({ pessoa: target.employeeId, tipo: target.kind, ano: String(target.year) });
  return call<CelebrationDetail>(`/api/inicio/comemoracoes?${query.toString()}`);
}

export function toggleLike(target: CelebrationTarget): Promise<{ likes: number; liked: boolean }> {
  return call("/api/inicio/comemoracoes", { method: "POST", body: target });
}

export function togglePraise(target: CelebrationTarget, praise: CelebrationPraiseKey): Promise<{ mine: boolean }> {
  return call("/api/inicio/comemoracoes", { method: "POST", body: { ...target, praise } });
}

export function toggleCommentLike(id: string): Promise<{ liked: boolean }> {
  return call("/api/inicio/comemoracoes/comentarios", { method: "PUT", body: { id } });
}

export function postComment(target: CelebrationTarget, body: string, mentions: string[]): Promise<{ id: string }> {
  return call("/api/inicio/comemoracoes/comentarios", { method: "POST", body: { ...target, body, mentions } });
}

export function removeComment(id: string): Promise<{ ok: boolean }> {
  return call("/api/inicio/comemoracoes/comentarios", { method: "DELETE", body: { id } });
}
