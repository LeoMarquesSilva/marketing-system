"use client";

import type { ComponentType } from "react";
import { OabAvisoFeed, OabAvisoStory, OabCapa, OabListaFeed, OabListaStory, OabProgramacao } from "./oab";
import type { SlideRenderProps } from "./parts";

/** Desenho de cada modelo de `src/lib/estudio/templates.ts`, pelo id. */
export const TEMPLATE_COMPONENTS: Record<string, ComponentType<SlideRenderProps>> = {
  "oab-capa": OabCapa,
  "oab-programacao": OabProgramacao,
  "oab-aviso-feed": OabAvisoFeed,
  "oab-aviso-story": OabAvisoStory,
  "oab-lista-feed": OabListaFeed,
  "oab-lista-story": OabListaStory,
};

export type { SlideRenderProps };
