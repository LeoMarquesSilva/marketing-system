"use client";

import { useEffect, useReducer } from "react";
import { parseIconify } from "@/lib/estudio/fields";
import type { IconData } from "@/lib/estudio/iconify";

/** Desenhos já baixados, para a prévia, as miniaturas e a exportação não repetirem o pedido. */
const loaded = new Map<string, IconData | null>();
const loading = new Map<string, Promise<IconData | null>>();

export function loadIcon(value: string): Promise<IconData | null> {
  if (loaded.has(value)) return Promise.resolve(loaded.get(value) ?? null);
  let pending = loading.get(value);
  if (!pending) {
    const icon = parseIconify(value);
    pending = (icon
      ? fetch(`/api/estudio/icones/${icon.prefix}/${icon.name}`, { credentials: "include" }).then((res) => (res.ok ? (res.json() as Promise<IconData>) : null))
      : Promise.resolve(null)
    )
      .catch(() => null)
      .then((data) => {
        loaded.set(value, data);
        loading.delete(value);
        return data;
      });
    loading.set(value, pending);
  }
  return pending;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Exportadores esperam os ícones chegarem e a arte redesenhar antes de copiar. */
export async function iconsReady(): Promise<void> {
  if (loading.size === 0) return;
  await Promise.all(loading.values());
  await nextFrame();
  await nextFrame();
}

/** Ícone da Iconify ("iconify:lucide:scale") na cor do texto em volta. */
export function IconifyIcon({ value, size, stroke }: { value: string; size: number; stroke?: number }) {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const data = loaded.get(value);

  useEffect(() => {
    if (!loaded.has(value)) void loadIcon(value).then(() => redraw());
  }, [value]);

  if (!data) return <span aria-hidden style={{ display: "inline-block", width: size, height: size }} />;
  // traço fino como o dos outros ícones do modelo
  const body = stroke ? data.body.replace(/stroke-width="[\d.]+"/g, `stroke-width="${stroke}"`) : data.body;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${data.width} ${data.height}`}
      width={size}
      height={size}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
