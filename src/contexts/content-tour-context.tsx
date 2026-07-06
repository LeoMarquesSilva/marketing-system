"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export interface ContentTourState {
  active: boolean;
  stepIndex: number;
  stepId: string | null;
}

interface ContentTourContextValue extends ContentTourState {
  setTourState: (state: ContentTourState) => void;
}

const ContentTourContext = createContext<ContentTourContextValue | null>(null);

export function ContentTourProvider({ children }: { children: ReactNode }) {
  const [state, setTourState] = useState<ContentTourState>({
    active: false,
    stepIndex: 0,
    stepId: null,
  });

  return (
    <ContentTourContext.Provider value={{ ...state, setTourState }}>
      {children}
    </ContentTourContext.Provider>
  );
}

export function useContentTour() {
  const ctx = useContext(ContentTourContext);
  if (!ctx) {
    return {
      active: false,
      stepIndex: 0,
      stepId: null,
      setTourState: () => {},
    };
  }
  return ctx;
}

export function isTourDemoStep(stepId: string | null | undefined): boolean {
  return Boolean(stepId?.startsWith("demo-"));
}
