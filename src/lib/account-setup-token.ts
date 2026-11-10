/**
 * Link de primeiro acesso ao ORQESTRAI: token aleatório que vai só no e-mail;
 * o banco guarda o SHA-256. Vale WELCOME_SETUP_VALIDITY_DAYS e funciona uma vez.
 * É validado só ao salvar a senha (o Safe Links do Outlook abre o link antes da
 * pessoa e não pode gastá-lo).
 */

import { createHash, randomBytes } from "node:crypto";

const TOKEN_PATTERN = /^pa_[A-Za-z0-9_-]{43}$/;

export type SetupTokenStatus = "valid" | "used" | "expired" | "invalid";

export function generateSetupToken(): string {
  return `pa_${randomBytes(32).toString("base64url")}`;
}

export function isSetupTokenFormat(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

export function hashSetupToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function firstAccessLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/primeiro-acesso?token=${encodeURIComponent(token)}`;
}

export function setupTokenStatus(
  row: { expires_at: string; used_at: string | null } | null,
  now: Date = new Date()
): SetupTokenStatus {
  if (!row) return "invalid";
  if (row.used_at) return "used";
  if (Date.parse(row.expires_at) <= now.getTime()) return "expired";
  return "valid";
}
