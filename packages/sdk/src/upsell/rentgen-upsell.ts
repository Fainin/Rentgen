/**
 * <rentgen-upsell> (Stream 5) — the bottom export action bar: "N selected · €X/wk" plus a
 * primary "List N items" button, per the result-screen mockup. Hidden until the first
 * `scan:complete`; selection defaults to all items and follows `selection:change` from
 * Stream 4's <rentgen-results> (never received = stays "all").
 *
 * Auth is host-injected via config.auth (read through getAssetConfig(), since the frozen
 * AssetAdapter interface only exposes `render`). Signed out -> "Sign in to export" calls
 * config.onSignInRequest(). No asset config ever arrived -> "export not configured" hint.
 */

import { css, html, LitElement, nothing } from 'lit';
import type { EnrichedItem, ScanResult } from '../types.js';
import { on } from '../events.js';
import { getClient } from '../config.js';
import { getAssetConfig } from './asset-config.js';
import { assembleExportBundle } from './export.js';
import { formatMoney } from './format.js';
import { sumRentPerDay } from './projection.js';
import type { AssetAdapterConfig, ExportBundle, UploadResult } from './types.js';

type ExportStatus = 'idle' | 'exporting' | 'done' | 'error';

const DAYS_PER_WEEK = 7;

export class RentgenUpsell extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--rentgen-font, system-ui, sans-serif);
    }
    .bar {
      position: sticky;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      background: var(--rentgen-card-bg, #16181d);
      border: 1px solid #262a32;
      border-radius: var(--rentgen-radius, 16px);
      padding: 0.85rem 1rem;
      margin-top: 0.75rem;
    }
    .summary {
      display: flex;
      flex-direction: column;
      color: #e5e7eb;
      min-width: 0;
    }
    .count {
      font-size: 0.85rem;
      color: #9ca3af;
    }
    .amount {
      font-weight: 800;
      font-size: 1.1rem;
      color: var(--rentgen-accent, #86efac);
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: none;
    }
    button {
      appearance: none;
      border: none;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      border-radius: 999px;
      padding: 0.7rem 1.4rem;
      white-space: nowrap;
    }
    button.primary {
      background: var(--rentgen-accent, #86efac);
      color: #05230f;
    }
    button.primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button.secondary {
      background: transparent;
      color: var(--rentgen-accent, #86efac);
      border: 1px solid var(--rentgen-accent, #86efac);
      padding: 0.65rem 1.1rem;
    }
    .hint {
      color: #9ca3af;
      font-size: 0.85rem;
    }
    .status {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      text-align: right;
      color: #9ca3af;
    }
    .status.error {
      color: #fca5a5;
    }
    .status.done {
      color: var(--rentgen-accent, #86efac);
    }
  `;

  declare private result: ScanResult | null;
  declare private selected: ReadonlySet<string>;
  declare private status: ExportStatus;
  declare private statusMessage: string;

  static get properties() {
    return {
      result: { state: true },
      selected: { state: true },
      status: { state: true },
      statusMessage: { state: true },
    };
  }

  private unsubscribes: Array<() => void> = [];

  constructor() {
    super();
    this.result = null;
    this.selected = new Set();
    this.status = 'idle';
    this.statusMessage = '';
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribes = [
      on('scan:complete', (result) => {
        this.result = result;
        this.selected = new Set(result.items.map((item) => item.id));
        this.status = 'idle';
        this.statusMessage = '';
      }),
      on('selection:change', ({ sessionId, selectedItemIds }) => {
        if (sessionId !== this.result?.sessionId) return;
        this.selected = new Set(selectedItemIds);
      }),
    ];
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribes.forEach((unsubscribe) => unsubscribe());
    this.unsubscribes = [];
  }

  private get selectedItems(): readonly EnrichedItem[] {
    if (!this.result) return [];
    return this.result.items.filter((item) => this.selected.has(item.id));
  }

  private async runExport(
    config: AssetAdapterConfig,
    run?: (bundle: ExportBundle) => Promise<UploadResult | void> | UploadResult | void,
  ): Promise<void> {
    const result = this.result;
    if (!result) return;
    this.status = 'exporting';
    this.statusMessage = '';
    try {
      const session = getClient().consume(result.sessionId);
      if (!session) throw new Error('Session not found — the scan may have expired.');
      const bundle = await assembleExportBundle(session, config, {
        selectedItemIds: [...this.selected],
      });
      config.onExportReady?.(bundle);
      const outcome = run ? await run(bundle) : undefined;
      if (outcome) {
        this.status = outcome.ok ? 'done' : 'error';
        this.statusMessage =
          outcome.message ?? (outcome.ok ? `${outcome.uploaded} listed ✓` : 'Export failed.');
      } else {
        this.status = 'done';
        this.statusMessage = 'Export ready.';
      }
    } catch (error: unknown) {
      this.status = 'error';
      this.statusMessage = error instanceof Error ? error.message : 'Export failed.';
    }
  }

  render() {
    const result = this.result;
    if (!result || result.items.length === 0) return nothing;
    const config = getAssetConfig();
    const items = this.selectedItems;
    const count = items.length;
    const weekly = sumRentPerDay(items) * DAYS_PER_WEEK;

    return html`
      <div class="bar">
        <div class="summary">
          <span class="count">${count} selected</span>
          <span class="amount">${formatMoney(weekly, result.currency)}/wk</span>
        </div>
        <div class="actions">${this.renderActions(config, count)}</div>
      </div>
      ${this.statusMessage
        ? html`<div class="status ${this.status}">${this.statusMessage}</div>`
        : nothing}
    `;
  }

  private renderActions(config: AssetAdapterConfig | undefined, count: number) {
    if (!config) {
      return html`<span class="hint">Export not configured</span>`;
    }
    if (config.auth?.isAuthenticated !== true) {
      return html`<button class="primary" @click=${() => config.onSignInRequest?.()}>
        Sign in to export
      </button>`;
    }
    const uploader = config.uploader;
    return html`
      <button
        class="primary"
        ?disabled=${count === 0 || this.status === 'exporting'}
        @click=${() =>
          this.runExport(config, uploader ? (bundle) => uploader.upload(bundle) : undefined)}
      >
        ${this.status === 'exporting' ? 'Listing…' : `List ${count} item${count === 1 ? '' : 's'}`}
      </button>
      ${(config.actions ?? []).map(
        (action) => html`
          <button
            class="secondary"
            ?disabled=${count === 0 || this.status === 'exporting'}
            @click=${() => this.runExport(config, (bundle) => action.run(bundle))}
          >
            ${action.label}
          </button>
        `,
      )}
    `;
  }
}

if (!customElements.get('rentgen-upsell')) {
  customElements.define('rentgen-upsell', RentgenUpsell);
}
