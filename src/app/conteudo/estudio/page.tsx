import { Suspense } from "react";
import { EstudioClient } from "@/components/estudio/estudio-client";

export default function EstudioPage() {
  return (
    <Suspense>
      <EstudioClient />
    </Suspense>
  );
}
