/**
 * Gera payload para deploy da edge function evolution-webhook via Supabase MCP.
 * Uso: node scripts/redeploy-evolution-webhook.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const content = fs.readFileSync(
  path.join(root, "supabase/functions/evolution-webhook/index.ts"),
  "utf8"
);

const payload = {
  name: "evolution-webhook",
  entrypoint_path: "index.ts",
  verify_jwt: false,
  files: [{ name: "index.ts", content }],
};

const out = path.join(root, ".cursor/mcp-deploy-invoke.json");
fs.writeFileSync(out, JSON.stringify(payload));
console.log(`Payload escrito em ${out} (${content.length} chars)`);
console.log("Deploy via MCP: deploy_edge_function com esse JSON como arguments.");
