import "server-only";
import crypto from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DATA_API_BASE = "https://analyticsdata.googleapis.com/v1beta";

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function getServiceAccountCredentials() {
  const email = process.env.GA4_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY;
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  if (!email || !rawKey || !propertyId) {
    throw new Error(
      "Configure GA4_SERVICE_ACCOUNT_EMAIL, GA4_SERVICE_ACCOUNT_PRIVATE_KEY e GA4_PROPERTY_ID no .env."
    );
  }
  const privateKey = rawKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
  return { email, privateKey, propertyId };
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const { email, privateKey } = getServiceAccountCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64url(signer.sign(privateKey));
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`Falha ao obter token do GA4: ${data.error_description ?? data.error ?? res.status}`);
  }
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.accessToken;
}

export interface Ga4ReportRow {
  dimensionValues: string[];
  metricValues: number[];
}

export interface Ga4ReportResult {
  dimensionNames: string[];
  metricNames: string[];
  rows: Ga4ReportRow[];
}

/** Filtro "dimensão está dentro desta lista de valores" (ex.: restringir a algumas páginas/cidades). */
export function inListDimensionFilter(fieldName: string, values: string[]) {
  return { filter: { fieldName, inListFilter: { values } } };
}

export async function runGa4Report(body: {
  dateRanges: { startDate: string; endDate: string }[];
  dimensions?: { name: string }[];
  metrics: { name: string }[];
  orderBys?: unknown[];
  limit?: number;
  dimensionFilter?: unknown;
}): Promise<Ga4ReportResult> {
  const { propertyId } = getServiceAccountCredentials();
  const token = await getAccessToken();

  const res = await fetch(`${DATA_API_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Erro na Google Analytics Data API: ${res.status} ${JSON.stringify(data)}`);
  }

  const dimensionNames = (data.dimensionHeaders ?? []).map((h: { name: string }) => h.name);
  const metricNames = (data.metricHeaders ?? []).map((h: { name: string }) => h.name);
  const rows: Ga4ReportRow[] = (data.rows ?? []).map(
    (row: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }) => ({
      dimensionValues: (row.dimensionValues ?? []).map((v) => v.value),
      metricValues: (row.metricValues ?? []).map((v) => Number(v.value) || 0),
    })
  );

  return { dimensionNames, metricNames, rows };
}

/** GA4 devolve datas como "YYYYMMDD"; converte para "YYYY-MM-DD". */
export function parseGa4Date(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}
