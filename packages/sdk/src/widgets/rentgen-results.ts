/**
 * <rentgen-results> — item cards + running idle-capital total.
 *
 * Subscribes to the shared event bus, so it lights up whenever <rentgen-scanner> (or any
 * host code that emits on rentgenEvents) completes a scan. Each card shows resale +
 * rent/day + its web sources + a confidence chip → the number is visibly grounded.
 *
 * Theming: --rentgen-accent, --rentgen-card-bg, --rentgen-radius, --rentgen-font
 */

import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { rentgenEvents } from '../events.js';
import type { EnrichedItem, PriceRange, ScanResult } from '../types.js';

@customElement('rentgen-results')
export class RentgenResults extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--rentgen-font, system-ui, sans-serif);
    }
    .total {
      margin: 1rem 0;
      padding: 1rem 1.25rem;
      background: var(--rentgen-accent, #4f46e5);
      color: #fff;
      border-radius: var(--rentgen-radius, 14px);
    }
    .total .amount {
      font-size: 2rem;
      font-weight: 800;
    }
    .total .sub {
      opacity: 0.85;
    }
    .card {
      margin: 0.75rem 0;
      padding: 1rem;
      background: var(--rentgen-card-bg, #fff);
      border: 1px solid #e5e7eb;
      border-radius: var(--rentgen-radius, 14px);
    }
    .card header {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      align-items: baseline;
    }
    .name {
      font-weight: 700;
    }
    .chip {
      font-size: 0.75rem;
      padding: 0.1rem 0.5rem;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      white-space: nowrap;
    }
    .prices {
      display: flex;
      gap: 1.5rem;
      margin: 0.5rem 0;
    }
    .price .label {
      font-size: 0.75rem;
      color: #6b7280;
      text-transform: uppercase;
    }
    .price .value {
      font-weight: 700;
    }
    .sources {
      font-size: 0.8rem;
    }
    .sources a {
      color: var(--rentgen-accent, #4f46e5);
    }
    .empty,
    .error {
      color: #6b7280;
      padding: 1rem 0;
    }
    .error {
      color: #b91c1c;
    }
  `;

  @state() private result: ScanResult | null = null;
  @state() private loading = false;
  @state() private error: string | null = null;

  private unsubscribers: Array<() => void> = [];

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribers = [
      rentgenEvents.on('scan:start', () => {
        this.loading = true;
        this.error = null;
      }),
      rentgenEvents.on('scan:complete', (result) => {
        this.result = result;
        this.loading = false;
      }),
      rentgenEvents.on('scan:error', ({ message }) => {
        this.error = message;
        this.loading = false;
      }),
    ];
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribers.forEach((off) => off());
    this.unsubscribers = [];
  }

  render() {
    if (this.error) return html`<p class="error">⚠️ ${this.error}</p>`;
    if (this.loading && !this.result) return html`<p class="empty">Scanning…</p>`;
    if (!this.result) return html`<p class="empty">Scan something to see its idle capital.</p>`;

    const { items, totalIdleValue, currency } = this.result;
    return html`
      <div class="total">
        <div class="amount">${money(totalIdleValue, currency)}</div>
        <div class="sub">idle capital across ${items.length} item${items.length === 1 ? '' : 's'} · earning €0</div>
      </div>
      ${items.map((item) => this.renderCard(item))}
    `;
  }

  private renderCard(item: EnrichedItem) {
    return html`
      <div class="card">
        <header>
          <span class="name">${item.name}</span>
          <span class="chip">${Math.round(item.confidence * 100)}% · ${item.condition}</span>
        </header>
        <div class="prices">
          <div class="price">
            <div class="label">Resale</div>
            <div class="value">${range(item.resale)}</div>
          </div>
          <div class="price">
            <div class="label">Rent / day</div>
            <div class="value">${range(item.rentPerDay)}</div>
          </div>
        </div>
        ${item.sources.length
          ? html`<div class="sources">
              ${item.sources.map(
                (s) => html`<a href=${s.url} target="_blank" rel="noreferrer">${s.title}</a><br />`,
              )}
            </div>`
          : nothing}
      </div>
    `;
  }
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

function range(r: PriceRange): string {
  return `${money(r.min, r.currency)}–${money(r.max, r.currency)}`;
}

declare global {
  interface HTMLElementTagNameMap {
    'rentgen-results': RentgenResults;
  }
}
