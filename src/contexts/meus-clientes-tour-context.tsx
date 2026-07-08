"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface MeusClientesTourState {
  active: boolean;
  stepIndex: number;
  stepId: string | null;
  dataLoaded: boolean;
  /** Há pelo menos um grupo de cliente para usar como exemplo nos passos guiados. */
  hasSampleGroup: boolean;
}

interface MeusClientesTourContextValue extends MeusClientesTourState {
  setTourState: (patch: Partial<MeusClientesTourState>) => void;
}

const MeusClientesTourContext = createContext<MeusClientesTourContextValue | null>(null);

export function MeusClientesTourProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MeusClientesTourState>({
    active: false,
    stepIndex: 0,
    stepId: null,
    dataLoaded: false,
    hasSampleGroup: false,
  });

  const setTourState = useCallback((patch: Partial<MeusClientesTourState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  return (
    <MeusClientesTourContext.Provider value={{ ...state, setTourState }}>
      {children}
    </MeusClientesTourContext.Provider>
  );
}

export function useMeusClientesTour() {
  const ctx = useContext(MeusClientesTourContext);
  if (!ctx) {
    return {
      active: false,
      stepIndex: 0,
      stepId: null as string | null,
      dataLoaded: false,
      hasSampleGroup: false,
      setTourState: () => {},
    };
  }
  return ctx;
}
