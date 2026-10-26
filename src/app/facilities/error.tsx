"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Falha ao carregar fornecedores/contratos (ex.: Supabase fora do ar): explica e deixa tentar de novo. */
export default function FacilitiesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="rounded-full bg-muted p-3 text-muted-foreground">
          <WifiOff className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="font-semibold text-foreground">Não deu para carregar agora</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A conexão com o banco de dados falhou. Os dados estão salvos; tente de novo em alguns segundos.
          </p>
        </div>
        <Button type="button" className="gap-2" onClick={reset}>
          <RefreshCw className="size-4" aria-hidden />
          Tentar de novo
        </Button>
      </CardContent>
    </Card>
  );
}
