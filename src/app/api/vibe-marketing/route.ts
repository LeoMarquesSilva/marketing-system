import { NextResponse } from "next/server";
import { createConnection, SmitheryAuthorizationError } from "@smithery/api/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SERVERS, NAMESPACE, type ServerId } from "@/lib/smithery-servers";

export const dynamic = "force-dynamic";

type ToolCallPayload = {
  server?: string;
  tool: string;
  args?: Record<string, unknown>;
};

async function callServerTool(
  serverId: ServerId,
  tool: string,
  args: Record<string, unknown>
) {
  const config = SERVERS[serverId];
  if (!config) throw new Error(`Servidor desconhecido: ${serverId}`);

  const { transport } = await createConnection({
    connectionId: config.connectionId,
    namespace: NAMESPACE,
    mcpUrl: config.mcpUrl,
  });

  const client = new Client(
    { name: "marketing-system", version: "1.0.0" },
    { capabilities: {} }
  );
  await client.connect(transport);

  const result = await client.callTool({
    name: tool,
    arguments: args as Record<string, string | number | boolean>,
  });

  await client.close();

  const content = result.content as Array<{ text?: string }> | undefined;
  const text = content?.[0]?.text ?? JSON.stringify(result.content ?? result);
  return typeof text === "string" ? text : JSON.stringify(text, null, 2);
}

export async function POST(request: Request) {
  const apiKey = process.env.SMITHERY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SMITHERY_API_KEY não configurada." },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as ToolCallPayload;
    const { server = "vibe-marketing", tool, args = {} } = body;

    if (!tool || typeof tool !== "string") {
      return NextResponse.json(
        { error: "Parâmetro 'tool' é obrigatório." },
        { status: 400 }
      );
    }

    const serverId = server as ServerId;
    if (!(serverId in SERVERS)) {
      return NextResponse.json(
        { error: `Servidor inválido. Use: ${Object.keys(SERVERS).join(", ")}` },
        { status: 400 }
      );
    }

    const content = await callServerTool(serverId, tool, args);

    return NextResponse.json({
      success: true,
      content: [{ type: "text" as const, text: content }],
    });
  } catch (error) {
    if (error instanceof SmitheryAuthorizationError) {
      return NextResponse.json(
        {
          error: "Autorização OAuth necessária.",
          authorizationUrl: error.authorizationUrl,
        },
        { status: 401 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Erro ao chamar ferramenta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const apiKey = process.env.SMITHERY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SMITHERY_API_KEY não configurada." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const serverParam = searchParams.get("server");

  const serversToFetch = serverParam
    ? (serverParam in SERVERS ? [serverParam as ServerId] : [])
    : (Object.keys(SERVERS) as ServerId[]);

  if (serversToFetch.length === 0) {
    return NextResponse.json(
      { error: `Servidor inválido. Use: ${Object.keys(SERVERS).join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const allTools: Array<{
      server: ServerId;
      serverName: string;
      tools: Array<{ name: string; description: string; inputSchema?: unknown }>;
    }> = [];

    for (const serverId of serversToFetch) {
      const config = SERVERS[serverId];
      const { transport } = await createConnection({
        connectionId: config.connectionId,
        namespace: NAMESPACE,
        mcpUrl: config.mcpUrl,
      });

      const client = new Client(
        { name: "marketing-system", version: "1.0.0" },
        { capabilities: {} }
      );
      await client.connect(transport);

      const { tools } = await client.listTools();
      await client.close();

      allTools.push({
        server: serverId,
        serverName: config.displayName,
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description ?? "",
          inputSchema: t.inputSchema,
        })),
      });
    }

    return NextResponse.json({
      servers: Object.fromEntries(
        Object.entries(SERVERS).map(([id, c]) => [
          id,
          { displayName: c.displayName, description: c.description },
        ])
      ),
      tools: allTools,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao listar ferramentas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
