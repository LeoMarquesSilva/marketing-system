import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reduz tempo de compilação ao importar só o que é usado desses pacotes
  optimizePackageImports: [
    "lucide-react",
    "recharts",
    "date-fns",
    "@radix-ui/react-select",
    "@radix-ui/react-dialog",
    "@radix-ui/react-popover",
    "@radix-ui/react-label",
  ],
};

export default nextConfig;
