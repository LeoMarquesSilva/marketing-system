"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * Link do menu com prefetch só quando há intenção (mouse em cima, foco ou toque).
 * As telas são dinâmicas: o prefetch automático renderizava no servidor cada
 * link visível a cada navegação, o que pesava na CPU da Vercel.
 */
export function NavLink({ onMouseEnter, onFocus, onTouchStart, ...props }: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      {...props}
      prefetch={intent ? null : false}
      onMouseEnter={(event) => {
        setIntent(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
    />
  );
}
