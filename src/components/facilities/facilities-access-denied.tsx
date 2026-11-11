import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function FacilitiesAcessoNegado() {
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="rounded-full bg-muted p-3 text-muted-foreground">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-foreground">Acesso restrito</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Fornecedores, contratos e manutenção têm valores e dados de pagamento. Peça a um administrador para liberar
            &quot;Facilities (fornecedores, contratos e manutenção)&quot; em Usuários.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
