export type ToolInfo = {
  server: string;
  serverName: string;
  name: string;
  description: string;
  inputSchema?: {
    properties?: { [key: string]: { type?: string; description?: string; enum?: string[]; default?: unknown } };
  };
};

export const NETWORKS = [
  "twitter",
  "instagram",
  "linkedin",
  "tiktok",
  "youtube",
  "facebook",
] as const;

export const PLATFORMS = [
  "twitter",
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "youtube",
] as const;

export const FRAMEWORKS = [
  "aida",
  "pas",
  "bab",
  "4cs",
  "uuuu",
  "pppp",
  "slap",
  "app",
  "storybrand",
] as const;
