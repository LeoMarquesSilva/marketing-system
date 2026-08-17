/**
 * Gera o payload para deploy da API central de fotos via Supabase MCP.
 * Uso: node scripts/redeploy-official-photos-api.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function source(name) {
  return {
    name,
    content: fs.readFileSync(path.join(root, "supabase/functions", name), "utf8"),
  };
}

const payload = {
  name: "official-photos-api",
  entrypoint_path: "official-photos-api/index.ts",
  verify_jwt: false,
  files: [
    source("official-photos-api/index.ts"),
    source("_shared/official-photos-domain.ts"),
  ],
};

const out = path.join(root, ".cursor/mcp-deploy-official-photos-api.json");
fs.writeFileSync(out, JSON.stringify(payload));
console.log(`Payload escrito em ${out}`);
console.log("Deploy somente via MCP user-ORQESTRAI.");
