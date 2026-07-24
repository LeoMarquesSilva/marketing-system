import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { NfcActionConfig, NfcActionType } from "@/lib/nfc/types";

const PUBLIC_TOKEN_PATTERN = /^nfc_[A-Za-z0-9_-]{16,64}$/;
const SAFE_PROTOCOLS = new Set(["https:", "http:"]);

export function generatePublicToken(): string {
  return `nfc_${randomBytes(18).toString("base64url")}`;
}

export function isValidPublicToken(value: string): boolean {
  return PUBLIC_TOKEN_PATTERN.test(value);
}

export function generateIdempotencyKey(scanId: string, actionKey = "default"): string {
  return createHash("sha256").update(`${scanId}:${actionKey}`).digest("hex");
}

export function generateAnonymousSessionId(): string {
  return randomUUID();
}

export function sanitizePublicUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!SAFE_PROTOCOLS.has(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function appendSafeParams(
  destination: string,
  params: Record<string, string> | undefined
): string {
  const parsed = new URL(destination);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (/^[a-zA-Z0-9_.-]{1,80}$/.test(key)) parsed.searchParams.set(key, value.slice(0, 500));
  }
  return parsed.toString();
}

export function isSensitiveAction(type: NfcActionType, config: NfcActionConfig): boolean {
  return (
    config.sensitive === true ||
    config.requireConfirmation === true ||
    type === "webhook" ||
    type === "whatsapp" ||
    type === "form" ||
    type === "sequence" ||
    type === "asset_loan" ||
    (type === "menu" && (config.menuItems?.some((item) => item.actionType !== "url") ?? false))
  );
}

export function hashIpAddress(ip: string | null, secret: string): string | null {
  if (!ip) return null;
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export function signN8nPayload(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function verifyHmac(value: string, expected: string): boolean {
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sanitizeTechnicalError(error: unknown): { code: string; message: string } {
  if (error instanceof Error && error.name === "AbortError") {
    return { code: "N8N_TIMEOUT", message: "A automação não respondeu dentro do tempo esperado." };
  }
  return { code: "ACTION_FAILED", message: "Não foi possível concluir a ação. Tente novamente." };
}
