"use client";

import {
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "framer-motion";
import { useSyncExternalStore, type ReactNode } from "react";

const subscribeToHydration = () => () => {};
const getHydratedSnapshot = () => true;
const getServerSnapshot = () => false;

function useHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerSnapshot
  );
}

export function getProfileMotionState(
  reduced: boolean,
  delay = 0,
  hydrated = true
) {
  if (reduced || !hydrated) {
    return {
      initial: false as const,
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0 },
    };
  }

  return {
    initial: false as const,
    animate: {
      opacity: [1, 0.96, 1],
      y: [0, 8, 0],
    },
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
  const hydrated = useHydrated();
  const state = getProfileMotionState(reduced, delay, hydrated);

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
