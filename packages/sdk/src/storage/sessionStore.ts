/**
 * localStorage-backed session store + image-hash cache.
 *
 * Two jobs:
 *  1. Cache scan() results by a hash of the image → rehearsal re-runs are instant and
 *     free (spec §6). Warm the cache on demo objects before the pitch.
 *  2. Persist sessions so <rentgen-results> can redisplay via consume(sessionId) without
 *     re-scanning — the client-side stand-in for "GET the compiled product data".
 *
 * No server: this is the whole persistence layer for Phases 1–2.
 */

import type { ScanResult, Session } from '../types.js';

const CACHE_PREFIX = 'rentgen:cache:'; // imageHash -> Session
const SESSION_PREFIX = 'rentgen:session:'; // sessionId -> Session

/** Fast, dependency-free string hash (FNV-1a). Good enough to key the rehearsal cache. */
export function hashImage(imageBase64: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < imageBase64.length; i++) {
    h ^= imageBase64.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export class SessionStore {
  constructor(private readonly storage: Storage = safeLocalStorage()) {}

  /** Look up a previously computed session for this image (cache hit → instant). */
  getByImageHash(imageHash: string): Session | null {
    return this.read(CACHE_PREFIX + imageHash);
  }

  getById(sessionId: string): Session | null {
    return this.read(SESSION_PREFIX + sessionId);
  }

  /** Persist a result under both its session id and its image hash. Returns the Session. */
  save(imageHash: string, result: ScanResult, createdAt: number): Session {
    const session: Session = { id: result.sessionId, imageHash, result, createdAt };
    this.write(SESSION_PREFIX + session.id, session);
    this.write(CACHE_PREFIX + imageHash, session);
    return session;
  }

  private read(key: string): Session | null {
    try {
      const raw = this.storage.getItem(key);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, session: Session): void {
    try {
      this.storage.setItem(key, JSON.stringify(session));
    } catch {
      // Quota / private-mode failures are non-fatal — caching is an optimization.
    }
  }
}

/** localStorage isn't available in every context (SSR, sandboxed iframes). Degrade gracefully. */
function safeLocalStorage(): Storage {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // access can throw in some sandboxes
  }
  return new MemoryStorage();
}

/** In-memory Storage shim used when localStorage is unavailable. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}
