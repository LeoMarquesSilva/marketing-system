import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function OperacoesLegaisAcessoNegado() {
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="rounded-full bg-muted p-3 text-muted-foreground">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-foreground">Acesso restrito</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Este módulo é exclusivo da área de Operações Legais.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
