/**
 * localStorage-backed session store + image-hash cache (Stream 4).
 *
 * Rehearsal contract: scanning the same image twice hits the hash cache and returns the
 * persisted session instantly — no API spend, no latency.
 *
 * Quota strategy: item images (data URLs) can be large. On QuotaExceededError we evict
 * the oldest sessions and retry once; if it still fails, we persist the session without
 * item images (the demo keeps working, cards just lose their photo).
 */

import type { Session } from '../types.js';

const INDEX_KEY = 'rentgen:sessions';
const SESSION_PREFIX = 'rentgen:session:';

/** FNV-1a 32-bit hash — fast and stable enough to dedup identical captures. */
export function hashImage(imageBase64: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < imageBase64.length; i++) {
    hash ^= imageBase64.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `h${(hash >>> 0).toString(16)}-${imageBase64.length}`;
}

function readIndex(): readonly string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: readonly string[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

export function getSession(sessionId: string): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_PREFIX + sessionId);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** Find a persisted session whose scan came from an identical image. */
export function findByImageHash(imageHash: string): Session | null {
  for (const id of readIndex()) {
    const session = getSession(id);
    if (session && session.imageHash === imageHash) return session;
  }
  return null;
}

function stripImages(session: Session): Session {
  return {
    ...session,
    result: {
      ...session.result,
      items: session.result.items.map(({ image: _image, ...rest }) => rest),
    },
  };
}

function evictOldest(): boolean {
  const ids = readIndex();
  if (ids.length === 0) return false;
  const sessions = ids
    .map((id) => getSession(id))
    .filter((s): s is Session => s !== null)
    .sort((a, b) => a.createdAt - b.createdAt);
  const oldest = sessions[0];
  if (!oldest) return false;
  localStorage.removeItem(SESSION_PREFIX + oldest.id);
  writeIndex(ids.filter((id) => id !== oldest.id));
  return true;
}

export function saveSession(session: Session): void {
  const write = (s: Session): void => {
    localStorage.setItem(SESSION_PREFIX + s.id, JSON.stringify(s));
    const ids = readIndex();
    if (!ids.includes(s.id)) writeIndex([...ids, s.id]);
  };
  try {
    write(session);
  } catch {
    if (evictOldest()) {
      try {
        write(session);
        return;
      } catch {
        /* fall through to image-free save */
      }
    }
    try {
      write(stripImages(session));
    } catch {
      /* storage unavailable (private mode, hard quota) — scan still returns in-memory */
    }
  }
}
