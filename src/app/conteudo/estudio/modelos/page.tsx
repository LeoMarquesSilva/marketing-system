import { Suspense } from "react";
import { TemplateCreator } from "@/components/estudio/template-creator/template-creator";

export default function EstudioModelosPage() {
  return (
    <Suspense>
      <TemplateCreator />
    </Suspense>
  );
}
