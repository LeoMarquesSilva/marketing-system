const DEFAULT_NPS_PUBLIC_BASE_URL = "https://marketing-system-xi.vercel.app";

interface NpsPublicUrlEnvironment {
  [key: string]: string | undefined;
  NPS_PUBLIC_BASE_URL?: string;
  MARKETING_PUBLIC_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getNpsPublicBaseUrl(
  environment: NpsPublicUrlEnvironment = process.env
): string {
  return normalizeBaseUrl(
    environment.NPS_PUBLIC_BASE_URL ||
      environment.MARKETING_PUBLIC_URL ||
      environment.NEXT_PUBLIC_APP_URL ||
      DEFAULT_NPS_PUBLIC_BASE_URL
  );
}

export function getNpsPublicUrl(
  token: string,
  environment: NpsPublicUrlEnvironment = process.env
): string {
  const baseUrl = getNpsPublicBaseUrl(environment);
  return `${baseUrl}/nps/${encodeURIComponent(token)}`;
}
