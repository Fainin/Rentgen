/** Stream 1 barrel — importing registers <rentgen-scanner>. */
export { RentgenScanner } from './rentgen-scanner.js';

/**
 * Warm the on-device detector (WASM + model download + delegate init) ahead of time —
 * call it while the user is still on the onboarding screen so live scanning starts hot.
 * Shares the scanner's lazy singleton; safe to call repeatedly, never throws.
 */
export async function preloadDetector(): Promise<void> {
  try {
    const { loadDetector } = await import('./detector.js');
    await loadDetector();
  } catch {
    /* preload is best-effort — the scanner retries with its own error handling */
  }
}
