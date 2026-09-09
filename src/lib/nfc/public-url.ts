import { PUBLIC_APP_ORIGIN } from "@/lib/public-origin";

const DEFAULT_NFC_PUBLIC_BASE_URL = PUBLIC_APP_ORIGIN;

export type NfcScanSource = "nfc" | "qr";

interface NfcPublicUrlEnvironment {
  [key: string]: string | undefined;
  NFC_PUBLIC_BASE_URL?: string;
  MARKETING_PUBLIC_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getNfcPublicBaseUrl(
  environment: NfcPublicUrlEnvironment = process.env
): string {
  return normalizeBaseUrl(
    environment.NFC_PUBLIC_BASE_URL ||
      environment.MARKETING_PUBLIC_URL ||
      environment.NEXT_PUBLIC_APP_URL ||
      DEFAULT_NFC_PUBLIC_BASE_URL
  );
}

export function getNfcPublicUrl(
  token: string,
  environment: NfcPublicUrlEnvironment = process.env,
  options?: { source?: NfcScanSource }
): string {
  const baseUrl = getNfcPublicBaseUrl(environment);
  const path = `${baseUrl}/t/${encodeURIComponent(token)}`;
  if (!options?.source) return path;
  return `${path}?source=${options.source}`;
}

export function parseNfcScanSource(
  value: string | null | undefined
): NfcScanSource {
  return value === "qr" ? "qr" : "nfc";
}
