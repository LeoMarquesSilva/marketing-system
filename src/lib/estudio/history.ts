/**
 * Histórico de desfazer/refazer do editor. Edições seguidas no mesmo campo (digitação,
 * deslizador) dentro de `COALESCE_MS` viram um passo só; mudanças de estrutura (slide
 * novo, reordenar, IA) sempre abrem um passo novo.
 */

export const COALESCE_MS = 700;
const LIMIT = 60;

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  lastKey: string | null;
  lastAt: number;
}

export type HistoryAction<T> =
  /** `next` pode ser o valor novo ou uma função do valor atual (como no setState). */
  | { type: "set"; next: T | ((present: T) => T); key?: string; at: number }
  | { type: "undo" }
  | { type: "redo" };

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

export function historyReducer<T>(state: History<T>, action: HistoryAction<T>): History<T> {
  if (action.type === "undo") {
    const previous = state.past[state.past.length - 1];
    if (previous === undefined) return state;
    return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], lastKey: null, lastAt: 0 };
  }
  if (action.type === "redo") {
    const [next, ...rest] = state.future;
    if (next === undefined) return state;
    return { past: [...state.past, state.present].slice(-LIMIT), present: next, future: rest, lastKey: null, lastAt: 0 };
  }
  const next = typeof action.next === "function" ? (action.next as (present: T) => T)(state.present) : action.next;
  if (next === state.present) return state;
  const coalesce = Boolean(action.key) && action.key === state.lastKey && action.at - state.lastAt < COALESCE_MS;
  if (coalesce) return { ...state, present: next, future: [], lastAt: action.at };
  return {
    past: [...state.past, state.present].slice(-LIMIT),
    present: next,
    future: [],
    lastKey: action.key ?? null,
    lastAt: action.at,
  };
}
