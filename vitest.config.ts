import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // .tsx cobre testes de componente que renderizam marcação com
    // react-dom/server — sem precisar de DOM nem de biblioteca extra.
    // robos/: a parte sem navegador dos robôs que rodam fora da Vercel (URLs, conferências).
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "robos/**/src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
