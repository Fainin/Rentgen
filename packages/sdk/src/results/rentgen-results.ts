/**
 * <rentgen-results> — renders scan results with impact (Workstream 4).
 * Subscribes to the event bus (scan:start/complete/error); renders item cards +
 * the climbing idle-capital total. Emits selection:change as checkboxes toggle.
 *
 * Renders ONLY items that passed the sellability gate (RentgenClient already
 * filtered). The "N hidden" counter is operator-facing — makes the honesty filter
 * visible without polluting the jury-facing list.
 *
 * Self-registers on import. Theme via CSS custom properties only.
 */
import { LitElement, html, css, nothing } from 'lit';
import type { EnrichedItem, ScanResult } from '../types.js';
import { emit, on } from '../events.js';


function formatRange(min: number, max: number, currency: string): string {
  const sym = currency === 'EUR' ? '€' : '';
  const lo = Math.round(min).toLocaleString('de-DE');
  const hi = Math.round(max).toLocaleString('de-DE');
  return min === max ? `${sym}${lo}` : `${sym}${lo}–${hi}`;
}

export class RentgenResults extends LitElement {
  static properties = {
    _result: { state: true },
    _busy: { state: true },
    _error: { state: true },
    _hidden: { state: true },
    _displayTotal: { state: true },
    _selected: { state: true },
  };

  declare _result: ScanResult | null;
  declare _busy: boolean;
  declare _error: string;
  declare _hidden: number;
  declare _displayTotal: number;
  declare _selected: Record<string, boolean>;

  private offs: Array<() => void> = [];
  private rafId = 0;

  static styles = css`
    :host { display: block; font-family: var(--rentgen-font, system-ui); color: #111827; }
    .hero {
      background: var(--rentgen-card-bg, #0b0f14); color: #fff;
      border-radius: var(--rentgen-radius, 16px); padding: 1.25rem 1.25rem 1.1rem; margin-bottom: 0.75rem;
    }
    .hero .label { color: #9ca3af; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .hero .total { font-size: 2.4rem; font-weight: 700; letter-spacing: -0.02em; margin-top: 0.15rem; }
    .hero .sub { color: var(--rentgen-accent, #06b6d4); font-size: 0.9rem; margin-top: 0.15rem; }
    .hidden {
      font-size: 0.78rem; color: #92400e; background: #fef3c7; border-radius: 8px;
      padding: 0.4rem 0.6rem; margin-bottom: 0.75rem;
    }
    .card {
      display: grid; grid-template-columns: 64px 1fr auto; gap: 0.75rem; align-items: start;
      background: #fff; border: 1px solid #e5e7eb; border-radius: var(--rentgen-radius, 12px);
      padding: 0.75rem; margin-bottom: 0.5rem;
    }
    .thumb { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; background: #f3f4f6; }
    .name { font-weight: 600; font-size: 0.95rem; }
    .meta { color: #6b7280; font-size: 0.8rem; margin-top: 0.1rem; }
    .prices { margin-top: 0.35rem; font-size: 0.82rem; }
    .prices .resale { color: #047857; font-weight: 600; }
    .prices .rent { color: #6b7280; margin-left: 0.5rem; }
    .src { font-size: 0.72rem; color: var(--rentgen-accent, #06b6d4); margin-top: 0.3rem; word-break: break-all; }
    .src a { color: inherit; margin-right: 0.5rem; }
    .chip {
      font-size: 0.68rem; color: #6b7280; background: #f3f4f6; border-radius: 999px;
      padding: 0.15rem 0.5rem; margin-top: 0.3rem; display: inline-block;
    }
    .right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }
    input[type=checkbox] { width: 18px; height: 18px; accent-color: var(--rentgen-accent, #06b6d4); cursor: pointer; }
    .empty { color: #9ca3af; font-size: 0.9rem; padding: 2rem 0; text-align: center; }
    .spinner { color: #6b7280; font-size: 0.9rem; padding: 1.5rem 0; text-align: center; }
    .err { color: #dc2626; font-size: 0.85rem; padding: 1rem 0; }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this._result = null;
    this._busy = false;
    this._error = '';
    this._hidden = 0;
    this._displayTotal = 0;
    this._selected = {};
    this.offs.push(on('scan:start', () => { this._busy = true; this._error = ''; }));
    this.offs.push(
      on('scan:complete', (result) => {
        this._result = result;
        this._busy = false;
        this._selected = Object.fromEntries(result.items.map((i) => [i.id, true]));
        this.animateTotal(result.totalIdleValue);
        this.emitSelection(result);
      }),
    );
    this.offs.push(on('scan:error', ({ message }) => { this._busy = false; this._error = message; }));
  }

  disconnectedCallback(): void {
    this.offs.forEach((off) => off());
    this.offs = [];
    cancelAnimationFrame(this.rafId);
    super.disconnectedCallback();
  }

  /** Public hook for the app to push the operator-facing hidden count into the widget. */
  setHiddenCount(count: number): void {
    this._hidden = count;
  }

  private animateTotal(target: number): void {
    cancelAnimationFrame(this.rafId);
    const start = this._displayTotal;
    const t0 = performance.now();
    const dur = 650;
    const step = (now: number): void => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      this._displayTotal = Math.round(start + (target - start) * eased);
      this.requestUpdate();
      if (p < 1) this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  private toggle(id: string, checked: boolean): void {
    this._selected = { ...this._selected, [id]: checked };
    if (this._result) this.emitSelection(this._result);
  }

  private emitSelection(result: ScanResult): void {
    const selectedItemIds = result.items.filter((i) => this._selected[i.id] !== false).map((i) => i.id);
    emit('selection:change', { sessionId: result.sessionId, selectedItemIds });
  }

  private renderCard(item: EnrichedItem) {
    const checked = this._selected[item.id] !== false;
    return html`
      <div class="card">
        ${item.image
          ? html`<img class="thumb" src=${item.image} alt=${item.name} />`
          : html`<div class="thumb"></div>`}
        <div>
          <div class="name">${item.name}</div>
          <div class="meta">${item.category} · ${item.condition}</div>
          <div class="prices">
            <span class="resale">${formatRange(item.resale.min, item.resale.max, item.resale.currency)}</span>
            <span class="rent">rent ${formatRange(item.rentPerDay.min, item.rentPerDay.max, item.rentPerDay.currency)}/day</span>
          </div>
          <div class="src">
            ${item.sources.slice(0, 2).map((s) => html`<a href=${s.url} target="_blank" rel="noopener noreferrer">${s.title}</a>`)}
          </div>
          <span class="chip">conf ${(item.confidence * 100).toFixed(0)}%</span>
        </div>
        <div class="right">
          <input type="checkbox" .checked=${checked} @change=${(e: Event) => this.toggle(item.id, (e.target as HTMLInputElement).checked)} />
        </div>
      </div>
    `;
  }

  protected render() {
    if (this._error) return html`<div class="err">Scan failed: ${this._error}</div>`;
    if (this._busy) return html`<div class="spinner">Scanning your room…</div>`;
    if (!this._result) return html`<div class="empty">Tap “Scan my room” to see what it's worth.</div>`;
    const r = this._result;
    return html`
      <div class="hero">
        <div class="label">Idle capital in this room</div>
        <div class="total">${r.currency === 'EUR' ? '€' : ''}${this._displayTotal.toLocaleString('de-DE')}</div>
        <div class="sub">Earning €0 right now.</div>
      </div>
      ${this._hidden > 0
        ? html`<div class="hidden">${this._hidden} item${this._hidden === 1 ? '' : 's'} hidden — not sellable / unpriced (honesty filter).</div>`
        : nothing}
      ${r.items.map((i) => this.renderCard(i))}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'rentgen-results': RentgenResults;
  }
}

customElements.define('rentgen-results', RentgenResults);
