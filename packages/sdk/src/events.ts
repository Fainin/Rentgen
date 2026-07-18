/**
 * The only widget↔widget channel (frozen seam). A typed wrapper over EventTarget.
 * See workstreams README — these four event names + payloads are the contract.
 */
import type { ScanResult } from './types.js';

export interface RentgenEvents {
  /** A scan began — show a spinner. */
  'scan:start': void;
  /** A scan finished; results + upsell render from this. */
  'scan:complete': ScanResult;
  /** Surface it. */
  'scan:error': { message: string };
  /** Result-list selection changed; Stream 5 exports only the selected subset. */
  'selection:change': { sessionId: string; selectedItemIds: readonly string[] };
}

const target = new EventTarget();

export function emit<K extends keyof RentgenEvents>(type: K, payload: RentgenEvents[K]): void {
  target.dispatchEvent(new CustomEvent(type, { detail: payload }));
}

/** Subscribe; returns an unsubscribe function. */
export function on<K extends keyof RentgenEvents>(
  type: K,
  handler: (payload: RentgenEvents[K]) => void,
): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<RentgenEvents[K]>).detail);
  target.addEventListener(type, listener);
  return () => target.removeEventListener(type, listener);
}
