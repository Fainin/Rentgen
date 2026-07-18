/**
 * <rentgen-scanner> — the capture surface (Workstream 1, Phase 1: tap-to-capture).
 * Camera preview + a "Scan my room" button. On tap: capture a frame → getClient().scan().
 *
 * No <canvas> overlay, no live boxes (dropped — they glitch at low fps and read as
 * fake AR). The feed stays clean; results stream into <rentgen-results> as cards.
 * Real camera via getUserMedia (needs HTTPS or localhost); graceful "Simulate scan"
 * fallback when no camera so the offline stub demo always works.
 *
 * Self-registers on import. Theme via CSS custom properties only.
 */
import { LitElement, html, css } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { getClient } from '../config.js';


export class RentgenScanner extends LitElement {
  static properties = {
    _busy: { state: true },
    _cameraOk: { state: true },
    _error: { state: true },
  };

  declare _busy: boolean;
  declare _cameraOk: boolean;
  declare _error: string;

  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;

  static styles = css`
    :host { display: block; }
    .frame {
      position: relative; aspect-ratio: 4 / 3; width: 100%;
      background: #0b0f14; border-radius: var(--rentgen-radius, 16px); overflow: hidden;
      display: flex; align-items: center; justify-content: center;
    }
    video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .no-cam {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      color: #9ca3af; font-family: var(--rentgen-font, system-ui); font-size: 0.85rem;
      text-align: center; padding: 1rem;
    }
    button {
      margin-top: 0.75rem; width: 100%; padding: 0.9rem 1rem; font-size: 1rem; font-weight: 600;
      color: #04121a; background: var(--rentgen-accent, #06b6d4); border: 0; border-radius: var(--rentgen-radius, 12px);
      cursor: pointer; font-family: var(--rentgen-font, system-ui);
    }
    button:disabled { opacity: 0.55; cursor: progress; }
    .err { color: #dc2626; font-size: 0.85rem; margin-top: 0.5rem; font-family: var(--rentgen-font, system-ui); }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this._busy = false;
    this._cameraOk = false;
    this._error = '';
    void this.startCamera();
  }

  disconnectedCallback(): void {
    this.stopCamera();
    super.disconnectedCallback();
  }

  private readonly setVideoRef = (el?: Element): void => {
    this.video = (el as HTMLVideoElement | null) ?? null;
    if (this.video && this.stream) this.video.srcObject = this.stream;
  };

  private async startCamera(): Promise<void> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this._cameraOk = false;
        return;
      }
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      this._cameraOk = true;
      await this.updateComplete;
      if (this.video) this.video.srcObject = this.stream;
    } catch (err) {
      this._cameraOk = false;
      this._error = err instanceof Error ? err.message : String(err);
    }
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private async captureFrame(): Promise<string> {
    const video = this.video;
    if (!video || !video.videoWidth) return this.simulateImage();
    const max = 1280;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  /** No camera (or insecure context) — synthesize a frame so the stub demo still runs. */
  private simulateImage(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '20px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('simulated frame (no camera)', 320, 240);
    }
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  private async onScan(): Promise<void> {
    if (this._busy) return;
    this._busy = true;
    this._error = '';
    try {
      const image = this._cameraOk ? await this.captureFrame() : this.simulateImage();
      await getClient().scan(image);
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
    } finally {
      this._busy = false;
    }
  }

  protected render() {
    return html`
      <div class="frame">
        <video ${ref(this.setVideoRef)} ?autoplay=${true} ?muted=${true} playsinline></video>
        ${!this._cameraOk
          ? html`<div class="no-cam">
              ${this._error ? `Camera unavailable — ${this._error}` : 'No camera — simulation mode.'}
            </div>`
          : ''}
      </div>
      <button ?disabled=${this._busy} @click=${() => void this.onScan()}>
        ${this._busy ? 'Scanning…' : 'Scan my room'}
      </button>
      ${this._error ? html`<div class="err">${this._error}</div>` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'rentgen-scanner': RentgenScanner;
  }
}

customElements.define('rentgen-scanner', RentgenScanner);
