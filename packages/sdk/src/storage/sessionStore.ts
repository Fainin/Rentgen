/**
 * localStorage-backed session store + image-hash cache (frozen seam).
 * Keyed by a SHA-256 of the image so a rehearsal re-scan is instant + free.
 * Lives in the SDK; capped so a long demo can't blow the quota.
 */
import type { ScanResult, Session } from '../types.js';

const KEY = 'rentgen:sessions';
const MAX_SESSIONS = 20;

function readAll(): Session[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Session[];
  } catch {
    return [];
  }
}

function writeAll(sessions: Session[]): void {
  try {
    // keep newest MAX_SESSIONS, most recent last
    localStorage.setItem(KEY, JSON.stringify(sessions.slice(-MAX_SESSIONS)));
  } catch {
    // quota / disabled storage — degrade silently; the demo still runs in-memory
  }
}

/** SHA-256 of the image, truncated. Browser crypto, no deps. */
export async function hashImage(imageBase64: string): Promise<string> {
  const data = new TextEncoder().encode(imageBase64);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

export function findByHash(imageHash: string): Session | null {
  return readAll().find((s) => s.imageHash === imageHash) ?? null;
}

export function save(result: ScanResult, imageHash: string): Session {
  const session: Session = {
    id: result.sessionId,
    imageHash,
    result,
    createdAt: Date.now(),
  };
  const sessions = readAll().filter((s) => s.id !== session.id);
  sessions.push(session);
  writeAll(sessions);
  return session;
}

export function consume(sessionId: string): Session | null {
  return readAll().find((s) => s.id === sessionId) ?? null;
}
