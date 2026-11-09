import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Metadados e worktrees locais de agentes não fazem parte da aplicação.
    ".claude/**",
    ".codex/**",
    "supabase/.temp/**",
    // Aplicação Node.js legada com configuração própria.
    "vios-app/**",
    // Scripts Node.js usam require(); não fazem parte do bundle.
    "scripts/**",
  ]),
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/font/google",
              message: "Use next/font/local com os arquivos de src/fonts: o build não pode depender do Google Fonts.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
