import { Suspense } from "react";
import { ReelDeliveriesClient } from "@/components/conteudo/reel-deliveries/reel-deliveries-client";

export default function AprovacaoReelsPage() {
  return (
    <Suspense>
      <ReelDeliveriesClient />
    </Suspense>
  );
}
