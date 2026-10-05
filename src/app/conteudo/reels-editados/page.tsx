import { Suspense } from "react";
import { ReelDeliveriesClient } from "@/components/conteudo/reel-deliveries/reel-deliveries-client";

export default function ReelsEditadosPage() {
  return (
    <Suspense>
      <ReelDeliveriesClient />
    </Suspense>
  );
}
