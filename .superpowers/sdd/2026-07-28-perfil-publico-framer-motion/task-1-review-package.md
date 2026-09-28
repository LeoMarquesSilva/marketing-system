# Task 1 review package

## Added: src/components/profiles/profile-motion.tsx

```tsx
"use client";

import {
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "framer-motion";
import type { ReactNode } from "react";

export function getProfileMotionState(reduced: boolean, delay = 0) {
  if (reduced) {
    return {
      initial: false as const,
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0 },
    };
  }

  return {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.58,
      delay,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  };
}

export function ProfileMotionRoot({ children }: { children: ReactNode }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}

export function ProfileMotionItem({
  children,
  className,
  delay = 0,
  viewport = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  viewport?: boolean;
}) {
  const reduced = Boolean(useReducedMotion());
  const state = getProfileMotionState(reduced, delay);

  return (
    <m.div
      className={className}
      initial={state.initial}
      animate={viewport ? undefined : state.animate}
      whileInView={viewport ? state.animate : undefined}
      viewport={viewport ? { once: true, amount: 0.14 } : undefined}
      transition={state.transition}
    >
      {children}
    </m.div>
  );
}
```

## Added: src/components/profiles/profile-motion.test.tsx

```tsx
import { describe, expect, it } from "vitest";
import { getProfileMotionState } from "@/components/profiles/profile-motion";

describe("getProfileMotionState", () => {
  it("usa deslocamento e atraso no modo normal", () => {
    expect(getProfileMotionState(false, 0.12)).toMatchObject({
      initial: { opacity: 0, y: 18 },
      transition: { delay: 0.12 },
    });
  });

  it("remove deslocamento e atraso com movimento reduzido", () => {
    expect(getProfileMotionState(true, 0.12)).toEqual({
      initial: false,
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0 },
    });
  });
});
```

