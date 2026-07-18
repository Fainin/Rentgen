/**
 * <rentgen-results> (Stream 4) — the money shot. Dark card, idle-capital-first hero,
 * per-item cards (photo, rent/day, resale, sources, confidence chip, selection checkbox),
 * animated count-up total, and a bottom slot for Stream 5's <rentgen-upsell> action bar.
 *
 * Renders purely from bus events (`scan:start|complete|error`); emits `selection:change`.
 */

import { css, html, LitElement, nothing } from 'lit';
import type { ScanResult } from '../types.js';
import { emit, on } from '../events.js';
import { formatMoney, formatRange } from './format.js';
import { monthlyPassiveIncome } from './earnings.js';
import { midpoint } from './total.js';

export class RentgenResults extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--rentgen-font, system-ui, sans-serif);
      color: #e5e7eb;
    }
    .panel {
      background: var(--rentgen-card-bg, #16181d);
      border-radius: var(--rentgen-radius, 20px);
      padding: 1.25rem;
    }
    .heading {
      font-size: 1.35rem;
      font-weight: 800;
      color: #fff;
      margin: 0;
    }
    .subheading {
      color: #9ca3af;
      margin: 0.15rem 0 1rem;
      font-size: 0.9rem;
    }
    .hero {
      border-radius: var(--rentgen-radius, 20px);
      padding: 1.1rem 1.25rem;
      margin-bottom: 1rem;
      background:
        radial-gradient(120% 160% at 20% 0%, rgba(134, 239, 172, 0.18), transparent 60%),
        #1b2620;
      border: 1px solid rgba(134, 239, 172, 0.25);
    }
    .hero .label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #b7c0ba;
      font-size: 0.9rem;
    }
    .hero .badge {
      color: var(--rentgen-accent, #86efac);
      border: 1px solid var(--rentgen-accent, #86efac);
      border-radius: 999px;
      padding: 0.15rem 0.7rem;
      font-size: 0.78rem;
      background: rgba(134, 239, 172, 0.12);
    }
    .hero .amount {
      font-size: 2.6rem;
      font-weight: 800;
      color: var(--rentgen-accent, #86efac);
      letter-spacing: -0.02em;
      line-height: 1.15;
    }
    .hero .sub {
      color: #9ca3af;
      font-size: 0.92rem;
      margin-top: 0.2rem;
    }
    .card {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      background: #1d2026;
      border: 1px solid #262a32;
      border-radius: var(--rentgen-radius, 16px);
      padding: 0.75rem 0.9rem;
      margin-bottom: 0.65rem;
    }
    .card.unchecked {
      opacity: 0.45;
    }
    .check {
      flex: none;
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 0.5rem;
      border: 2px solid #3a4150;
      background: transparent;
      color: #05230f;
      cursor: pointer;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 1rem;
      padding: 0;
    }
    .check.on {
      background: var(--rentgen-accent, #86efac);
      border-color: var(--rentgen-accent, #86efac);
    }
    .thumb {
      flex: none;
      width: 3.4rem;
      height: 3.4rem;
      border-radius: 0.75rem;
      object-fit: cover;
      background: #262a32;
    }
    .thumb.placeholder {
      display: grid;
      place-items: center;
      color: #4b5563;
      font-size: 0.65rem;
    }
    .info {
      flex: 1;
      min-width: 0;
    }
    .name {
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta {
      color: #9ca3af;
      font-size: 0.8rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chip {
      display: inline-block;
      margin-top: 0.25rem;
      font-size: 0.7rem;
      color: #b7c0ba;
      border: 1px solid #3a4150;
      border-radius: 999px;
      padding: 0.05rem 0.5rem;
    }
    .sources {
      margin-top: 0.25rem;
      font-size: 0.72rem;
    }
    .sources a {
      color: #6ee7b7;
      opacity: 0.8;
      text-decoration: none;
      margin-right: 0.6rem;
    }
    .prices {
      flex: none;
      text-align: right;
    }
    .rent {
      color: var(--rentgen-accent, #86efac);
      font-weight: 800;
      font-size: 1.02rem;
      white-space: nowrap;
    }
    .resale {
      color: #9ca3af;
      font-size: 0.8rem;
      white-space: nowrap;
    }
    .empty,
    .scanning,
    .error {
      color: #9ca3af;
      text-align: center;
      padding: 1.5rem 0;
    }
    .error {
      color: #fca5a5;
    }
    .pulse {
      animation: pulse 1.2s ease-in-out infinite;
    }
    @keyframes pulse {
      50% {
        opacity: 0.45;
      }
    }
  `;

  declare private result: ScanResult | null;
  declare private selected: ReadonlySet<string>;
  declare private scanning: boolean;
  declare private error: string;
  declare private displayTotal: number;

  static get properties() {
    return {
      result: { state: true },
      selected: { state: true },
      scanning: { state: true },
      error: { state: true },
      displayTotal: { state: true },
    };
  }

  private unsubscribes: Array<() => void> = [];
  private animationFrame = 0;

  constructor() {
    super();
    this.result = null;
    this.selected = new Set();
    this.scanning = false;
    this.error = '';
    this.displayTotal = 0;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribes = [
      on('scan:start', () => {
        this.scanning = true;
        this.error = '';
      }),
      on('scan:complete', (result) => {
        this.scanning = false;
        this.error = '';
        this.result = result;
        this.selected = new Set(result.items.map((i) => i.id));
        this.animateTotal(result.totalIdleValue);
        this.emitSelection();
      }),
      on('scan:error', ({ message }) => {
        this.scanning = false;
        this.error = message;
      }),
    ];
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];
    cancelAnimationFrame(this.animationFrame);
  }

  private animateTotal(target: number): void {
    cancelAnimationFrame(this.animationFrame);
    const from = this.displayTotal;
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.displayTotal = Math.round(from + (target - from) * eased);
      if (t < 1) this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  private emitSelection(): void {
    if (!this.result) return;
    emit('selection:change', {
      sessionId: this.result.sessionId,
      selectedItemIds: [...this.selected],
    });
  }

  private toggle(id: string): void {
    const next = new Set(this.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selected = next;
    this.emitSelection();
  }

  render() {
    const result = this.result;
    return html`
      <div class="panel">
        ${this.error ? html`<div class="error">⚠ ${this.error}</div>` : nothing}
        ${this.scanning
          ? html`<div class="scanning pulse">X-raying your stuff…</div>`
          : nothing}
        ${result ? this.renderResult(result) : this.renderEmpty()}
        <slot></slot>
      </div>
    `;
  }

  private renderEmpty() {
    if (this.scanning || this.error) return nothing;
    return html`<div class="empty">Scan something — your idle capital will show up here.</div>`;
  }

  private renderResult(result: ScanResult) {
    const monthly = monthlyPassiveIncome(result.items);
    const count = result.items.length;
    return html`
      <h2 class="heading">${count} ${count === 1 ? 'item' : 'items'} found</h2>
      <p class="subheading">Uncheck anything you'll keep</p>
      <div class="hero">
        <div class="label">
          <span>Sitting idle, earning €0</span>
          <span class="badge">Renting</span>
        </div>
        <div class="amount">${formatMoney(this.displayTotal, result.currency)}</div>
        <div class="sub">
          ~${formatMoney(monthly, result.currency)}/month passive if you rent it out
        </div>
      </div>
      ${result.items.map((item) => {
        const checked = this.selected.has(item.id);
        return html`
          <div class="card ${checked ? '' : 'unchecked'}">
            <button
              class="check ${checked ? 'on' : ''}"
              @click=${() => this.toggle(item.id)}
              aria-label="Select ${item.name}"
            >
              ${checked ? '✓' : ''}
            </button>
            ${item.image
              ? html`<img class="thumb" src=${item.image} alt=${item.name} />`
              : html`<div class="thumb placeholder">photo</div>`}
            <div class="info">
              <div class="name">${item.name}</div>
              <div class="meta">${item.category} · ${item.condition}</div>
              <span class="chip">${Math.round(item.confidence * 100)}% sure</span>
              <div class="sources">
                ${item.sources.slice(0, 2).map(
                  (s) => html`<a href=${s.url} target="_blank" rel="noreferrer">${s.title}</a>`,
                )}
              </div>
            </div>
            <div class="prices">
              <div class="rent">
                ${formatRange(item.rentPerDay.min, item.rentPerDay.max, item.rentPerDay.currency)}/day
              </div>
              <div class="resale">
                ~${formatMoney(midpoint(item.resale), item.resale.currency)} resale
              </div>
            </div>
          </div>
        `;
      })}
    `;
  }
}

if (!customElements.get('rentgen-results')) {
  customElements.define('rentgen-results', RentgenResults);
}
