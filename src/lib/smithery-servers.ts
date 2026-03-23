/**
 * Configuração dos servidores MCP do Smithery Connect.
 * Todos usam o mesmo namespace e SMITHERY_API_KEY.
 */

export const NAMESPACE = "marketing-system";

/** Apenas servidores gratuitos (sem API key externa). */
export const SERVERS = {
  "vibe-marketing": {
    connectionId: "vibe-marketing",
    mcpUrl: "https://vibe-marketing--synthetic-ci.run.tools",
    displayName: "Vibe Marketing",
    description: "Hooks, frameworks, arquétipos, validação de conteúdo",
  },
  "ai-marketing-agent": {
    connectionId: "ai-marketing-agent",
    mcpUrl: "https://ai-marketing-agent--enji.run.tools",
    displayName: "AI Marketing Agent",
    description: "Ideias de posts, personas, voz da marca, blog",
  },
} as const;

export type ServerId = keyof typeof SERVERS;
