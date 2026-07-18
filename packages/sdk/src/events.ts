/**
 * The shared event bus — the ONLY channel between widgets (frozen seam, Stream 4 owns).
 *
 * Contract (see workstreams README seam registry):
 * - `scan:start` {} — a scan began. Emitted by <rentgen-scanner> BEFORE calling scan().
 * - `scan:complete` ScanResult — emitted by RentgenClient when a scan finishes.
 * - `scan:error` { message } — emitted by RentgenClient on failure.
 * - `selection:change` { sessionId, selectedItemIds } — emitted by <rentgen-results>.
 *
 * Widgets never import each other; they import this bus and the frozen types only.
 */

import type { ScanResult } from './types.js';

export interface RentgenEventMap {
  'scan:start': Record<string, never>;
  'scan:complete': ScanResult;
  'scan:error': { readonly message: string };
  'selection:change': {
    readonly sessionId: string;
    readonly selectedItemIds: readonly string[];
  };
}

export type RentgenEventName = keyof RentgenEventMap;

const bus = new EventTarget();

/** Emit a bus event. Payloads are treated as immutable — never mutate after emitting. */
export function emit<K extends RentgenEventName>(name: K, payload: RentgenEventMap[K]): void {
  bus.dispatchEvent(new CustomEvent(name, { detail: payload }));
}

/** Subscribe to a bus event. Returns an unsubscribe function. */
export function on<K extends RentgenEventName>(
  name: K,
  listener: (payload: RentgenEventMap[K]) => void,
): () => void {
  const handler = (event: Event): void => {
    listener((event as CustomEvent<RentgenEventMap[K]>).detail);
  };
  bus.addEventListener(name, handler);
  return () => bus.removeEventListener(name, handler);
}
