import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lucide-react, recharts e date-fns já são otimizados por padrão no Next.js 16.
  // Radix: usar experimental.optimizePackageImports (tipagem pode não incluir; cast abaixo).
  experimental: {
    optimizePackageImports: [
      "@radix-ui/react-select",
      "@radix-ui/react-dialog",
      "@radix-ui/react-popover",
      "@radix-ui/react-label",
    ],
  } as NextConfig["experimental"],
};

export default nextConfig;
