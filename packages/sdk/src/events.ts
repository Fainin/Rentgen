/**
 * A tiny typed event bus so <rentgen-scanner> and <rentgen-results> auto-coordinate
 * with zero glue in the host app: drop both elements on a page and a scan flows from
 * one to the other. Host apps can also subscribe (e.g. to update an idle-capital
 * headline) via the exported `rentgenEvents`.
 */

import type { ScanResult } from './types.js';

export interface RentgenEventMap {
  'scan:start': { imageBase64: string };
  'scan:complete': ScanResult;
  'scan:error': { message: string };
}

type Handler<K extends keyof RentgenEventMap> = (payload: RentgenEventMap[K]) => void;

class RentgenEventBus {
  private handlers = new Map<keyof RentgenEventMap, Set<Handler<never>>>();

  on<K extends keyof RentgenEventMap>(type: K, handler: Handler<K>): () => void {
    const set = (this.handlers.get(type) as Set<Handler<K>> | undefined) ?? new Set<Handler<K>>();
    set.add(handler);
    this.handlers.set(type, set as Set<Handler<never>>);
    return () => set.delete(handler);
  }

  emit<K extends keyof RentgenEventMap>(type: K, payload: RentgenEventMap[K]): void {
    const set = this.handlers.get(type) as Set<Handler<K>> | undefined;
    if (!set) return;
    for (const handler of set) handler(payload);
  }
}

/** Shared singleton bus for the SDK. */
export const rentgenEvents = new RentgenEventBus();
