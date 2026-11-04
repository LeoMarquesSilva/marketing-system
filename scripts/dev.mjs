// Sobe o `next dev` com limite maior de cabeçalho HTTP.
//
// Os cookies do localhost valem para todas as portas: com outros projetos locais (CRM, Supabase de cada um)
// o Chrome passa dos 16 KB que o Node aceita por padrão e a página volta com HTTP 431. O NODE_OPTIONS vale
// também para o processo filho que o Next cria para o servidor. Argumentos extras seguem para o `next dev`
// (ex.: `npm run dev -- -p 3002`).
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const nodeOptions = [process.env.NODE_OPTIONS, "--max-http-header-size=65536"].filter(Boolean).join(" ");

const filho = spawn(process.execPath, [next, "dev", "--webpack", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
});

for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => filho.kill(sinal));
filho.on("exit", (codigo, sinal) => process.exit(codigo ?? (sinal ? 1 : 0)));
