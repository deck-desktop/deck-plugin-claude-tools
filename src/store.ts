// Per chat, what the buttons and the band share: whether the captures band is open, the last tidy
// (for its undo), and what is running. In memory: none of it is worth keeping past a reload.
import { useCallback, useSyncExternalStore } from "react";

export interface PaneState {
  /** The band of recent captures is open. */
  open: boolean;
  /** The draft before the last tidy and what it became: undo shows while the box still holds `tidied`. */
  tidy: { original: string; tidied: string } | null;
  busy: "tidy" | "capture" | null;
}

const EMPTY: PaneState = { open: false, tidy: null, busy: null };
const states = new Map<string, PaneState>();
const subs = new Map<string, Set<() => void>>();

export const stateOf = (pane: string) => states.get(pane) ?? EMPTY;

export function patch(pane: string, part: Partial<PaneState>) {
  states.set(pane, { ...stateOf(pane), ...part });
  subs.get(pane)?.forEach((f) => f());
}

export function usePaneState(pane: string): PaneState {
  const sub = useCallback((f: () => void) => {
    let s = subs.get(pane);
    if (!s) subs.set(pane, s = new Set());
    s.add(f);
    return () => { s!.delete(f); };
  }, [pane]);
  return useSyncExternalStore(sub, () => stateOf(pane));
}
