import { VibeMarketingClient } from "@/components/vibe-marketing/vibe-marketing-client";

export const metadata = {
  title: "Vibe Marketing | Sistema de Marketing",
  description: "Inspiração, validação e ferramentas de IA para conteúdo em redes sociais",
};

export default function VibeMarketingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Vibe Marketing
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Inspiração (hooks, frameworks, arquétipos), validação antes de publicar e ferramentas avançadas
        </p>
      </div>
      <VibeMarketingClient />
    </div>
  );
}
