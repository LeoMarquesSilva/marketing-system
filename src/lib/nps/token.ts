import { randomBytes } from "node:crypto";

const PUBLIC_TOKEN_PATTERN = /^nps_[A-Za-z0-9_-]{16,64}$/;

export function generateNpsToken(): string {
  return `nps_${randomBytes(18).toString("base64url")}`;
}

export function isValidNpsToken(value: string): boolean {
  return PUBLIC_TOKEN_PATTERN.test(value);
}
