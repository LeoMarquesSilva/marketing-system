const DEFAULT_NFC_PUBLIC_BASE_URL = "https://marketing-system-xi.vercel.app";

interface NfcPublicUrlEnvironment {
  [key: string]: string | undefined;
  NFC_PUBLIC_BASE_URL?: string;
  MARKETING_PUBLIC_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getNfcPublicUrl(
  token: string,
  environment: NfcPublicUrlEnvironment = process.env
): string {
  const baseUrl = normalizeBaseUrl(
    environment.NFC_PUBLIC_BASE_URL ||
      environment.MARKETING_PUBLIC_URL ||
      environment.NEXT_PUBLIC_APP_URL ||
      DEFAULT_NFC_PUBLIC_BASE_URL
  );

  return `${baseUrl}/t/${encodeURIComponent(token)}`;
}
