/**
 * <rentgen-scanner> — the capture widget.
 *
 * Phase 1: one button → pick/take a photo → RentgenClient.scan() → emit the result on
 * the shared event bus (so <rentgen-results> updates with zero app glue). Phase 2 swaps
 * this for a live pan without changing the client call.
 *
 * Theming (host sets CSS custom properties, no internals touched):
 *   --rentgen-accent, --rentgen-radius, --rentgen-font
 */

import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getClient } from '../config.js';
import { rentgenEvents } from '../events.js';

@customElement('rentgen-scanner')
export class RentgenScanner extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--rentgen-font, system-ui, sans-serif);
    }
    button {
      width: 100%;
      padding: 1rem 1.25rem;
      font-size: 1.05rem;
      font-weight: 600;
      color: #fff;
      background: var(--rentgen-accent, #4f46e5);
      border: none;
      border-radius: var(--rentgen-radius, 14px);
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: progress;
    }
    input {
      display: none;
    }
  `;

  @state() private busy = false;

  render() {
    return html`
      <button ?disabled=${this.busy} @click=${this.pickPhoto}>
        ${this.busy ? 'Scanning…' : '📸 Scan your stuff'}
      </button>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        @change=${this.onFile}
      />
    `;
  }

  private pickPhoto() {
    this.renderRoot.querySelector<HTMLInputElement>('input')?.click();
  }

  private async onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-picking the same file
    if (!file) return;

    try {
      const imageBase64 = await readAsDataUrl(file);
      await this.runScan(imageBase64);
    } catch (err) {
      this.fail(err);
    }
  }

  /** Exposed so a host / Phase-2 detector can feed a crop directly. */
  async runScan(imageBase64: string): Promise<void> {
    this.busy = true;
    rentgenEvents.emit('scan:start', { imageBase64 });
    try {
      const result = await getClient().scan(imageBase64);
      rentgenEvents.emit('scan:complete', result);
    } catch (err) {
      this.fail(err);
    } finally {
      this.busy = false;
    }
  }

  private fail(err: unknown) {
    this.busy = false;
    const message = err instanceof Error ? err.message : String(err);
    rentgenEvents.emit('scan:error', { message });
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'rentgen-scanner': RentgenScanner;
  }
}
