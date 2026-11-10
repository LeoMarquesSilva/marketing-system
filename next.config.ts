import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pasta de build alternativa para rodar um segundo `next dev` na mesma pasta
  // (o primeiro trava .next/dev/lock). Padrão continua .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // lucide-react, recharts e date-fns já são otimizados por padrão no Next.js 16.
  // Radix: usar experimental.optimizePackageImports (tipagem pode não incluir; cast abaixo).
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-select",
      "@radix-ui/react-dialog",
      "@radix-ui/react-popover",
      "@radix-ui/react-label",
    ],
  } as NextConfig["experimental"],
  // Arquivos do modelo de certificado lidos com fs pela rota (fora de /public).
  outputFileTracingIncludes: {
    // A leitura dos autos importa o pdfjs em tempo de execução, fora do bundle (ver src/lib/processos/leitura-pdf.ts):
    // os arquivos entram à mão nas rotas que leem os autos.
    "/api/operacoes-legais/processos/autos/documentos/*/ler": ["./node_modules/pdfjs-dist/package.json", "./node_modules/pdfjs-dist/legacy/build/pdf.mjs", "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    "/api/robos/autos/pedidos/*": ["./node_modules/pdfjs-dist/package.json", "./node_modules/pdfjs-dist/legacy/build/pdf.mjs", "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    "/api/certificados/modelo/*": ["./src/lib/certificados/assets/**/*"],
    // Fontes licenciadas dos modelos do Estúdio de peças.
    "/api/estudio/fontes": ["./src/lib/estudio/assets/fonts/**/*"],
    "/api/estudio/fontes/*": ["./src/lib/estudio/assets/fonts/**/*"],
    "/conteudo/estudio": ["./src/lib/estudio/assets/fonts/**/*"],
    "/conteudo/estudio/*": ["./src/lib/estudio/assets/fonts/**/*"],
  },
  async redirects() {
    return [
      // Nome antigo da página de aprovação de reels.
      { source: "/conteudo/reels-editados", destination: "/conteudo/aprovacao-reels", permanent: true },
    ];
  },
};

export default nextConfig;
