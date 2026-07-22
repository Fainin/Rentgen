/**
 * <rentgen-results> (Stream 4) — the money shot. Dark card, idle-capital-first hero,
 * per-item cards (photo, rent/day, resale, sources, confidence chip). Tap a card to
 * toggle its active state (accent border); swipe it left to delete it from the tally.
 * Animated count-up total, and a bottom slot for Stream 5's <rentgen-upsell> action bar.
 *
 * Renders purely from bus events (`scan:start|complete|error`); emits `selection:change`.
 */

import { css, html, LitElement, nothing } from 'lit';
import type { EnrichedItem, ScanResult } from '../types.js';
import { emit, on } from '../events.js';
import { formatMoney, formatRange } from './format.js';
import { monthlyPassiveIncome } from './earnings.js';
import { midpoint, totalIdleValue } from './total.js';

// A leftward drag past this fraction of the card width commits the delete.
const SWIPE_DELETE_RATIO = 0.4;
// Movement (px) before a pointer drag counts as a swipe rather than a tap.
const TAP_SLOP = 8;
// Card slide-out animation before the row is actually removed from state.
const DELETE_ANIM_MS = 180;

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
      /* Generous bottom room so a fixed tab bar never overlays the last card/upsell. */
      padding-bottom: calc(7rem + env(safe-area-inset-bottom, 0px));
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
    /* Swipe row: the red delete affordance sits behind the sliding card. */
    .swipe {
      position: relative;
      border-radius: var(--rentgen-radius, 16px);
      overflow: hidden;
      margin-bottom: 0.65rem;
      touch-action: pan-y;
    }
    .delete-bg {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.4rem;
      padding: 0 1.3rem;
      background: #7f1d1d;
      color: #fecaca;
      font-weight: 700;
      font-size: 0.9rem;
    }
    .delete-bg.armed {
      background: #dc2626;
      color: #fff;
    }
    .card {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 0.8rem;
      background: #1d2026;
      border: 1px solid #262a32;
      border-radius: var(--rentgen-radius, 16px);
      padding: 0.75rem 0.9rem;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease,
        opacity 0.15s ease;
    }
    /* Active (selected) — accent border replaces the old checkbox.
       Inactive is simply the absence of this border; no dimming. */
    .card.active {
      border-color: var(--rentgen-accent, #86efac);
      box-shadow: 0 0 0 1px var(--rentgen-accent, #86efac) inset;
    }
    .card.removing {
      transition:
        transform 0.18s ease,
        opacity 0.18s ease;
      transform: translateX(-100%);
      opacity: 0;
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
  declare private removed: ReadonlySet<string>;
  declare private scanning: boolean;
  declare private error: string;
  declare private displayTotal: number;

  static get properties() {
    return {
      result: { state: true },
      selected: { state: true },
      removed: { state: true },
      scanning: { state: true },
      error: { state: true },
      displayTotal: { state: true },
    };
  }

  private unsubscribes: Array<() => void> = [];
  private animationFrame = 0;

  // Transient swipe-drag bookkeeping (not reactive — the dragged card is styled directly).
  private dragId: string | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragDX = 0;
  private dragging = false;
  private dragMoved = false;
  private dragEl: HTMLElement | null = null;

  constructor() {
    super();
    this.result = null;
    this.selected = new Set();
    this.removed = new Set();
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
        this.removed = new Set();
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

  private get visibleItems(): readonly EnrichedItem[] {
    if (!this.result) return [];
    return this.result.items.filter((i) => !this.removed.has(i.id));
  }

  /** Visible items that are still active — these drive the headline total. */
  private get activeItems(): readonly EnrichedItem[] {
    return this.visibleItems.filter((i) => this.selected.has(i.id));
  }

  private emitSelection(): void {
    if (!this.result) return;
    emit('selection:change', {
      sessionId: this.result.sessionId,
      selectedItemIds: [...this.selected].filter((id) => !this.removed.has(id)),
    });
  }

  private toggle(id: string): void {
    const next = new Set(this.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selected = next;
    this.animateTotal(totalIdleValue(this.activeItems));
    this.emitSelection();
  }

  /** Drop an item entirely: gone from the list, the total, and the selection. */
  private deleteItem(id: string): void {
    const nextRemoved = new Set(this.removed);
    nextRemoved.add(id);
    this.removed = nextRemoved;

    const nextSelected = new Set(this.selected);
    nextSelected.delete(id);
    this.selected = nextSelected;

    this.animateTotal(totalIdleValue(this.activeItems));
    this.emitSelection();
  }

  // --- Swipe-to-delete / tap-to-toggle pointer handling ---------------------

  private onPointerDown = (e: PointerEvent, id: string): void => {
    // Let source links behave normally; never start a drag/toggle from them.
    if ((e.target as HTMLElement).closest('a')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.dragId = id;
    this.dragEl = e.currentTarget as HTMLElement;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragDX = 0;
    this.dragging = false;
    this.dragMoved = false;
    this.dragEl.setPointerCapture?.(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.dragId === null || !this.dragEl) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    if (!this.dragging) {
      if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) return;
      // Past the slop — this is a drag, never a tap. A mostly-vertical move is a
      // scroll, so bail out of the gesture entirely (browser handles the scroll).
      this.dragMoved = true;
      if (Math.abs(dx) <= Math.abs(dy)) {
        this.endDrag();
        return;
      }
      this.dragging = true;
      this.dragEl.style.transition = 'none';
    }
    e.preventDefault();
    this.dragDX = Math.min(0, dx); // left swipes only
    this.dragEl.style.transform = `translateX(${this.dragDX}px)`;
    const armed = Math.abs(this.dragDX) > this.dragEl.offsetWidth * SWIPE_DELETE_RATIO;
    this.deleteBgFor(this.dragEl)?.classList.toggle('armed', armed);
  };

  private onPointerUp = (): void => {
    if (this.dragId === null || !this.dragEl) return;
    const id = this.dragId;
    const el = this.dragEl;
    const dragged = this.dragging;
    const moved = this.dragMoved;
    const dx = this.dragDX;
    this.endDrag();

    if (!dragged) {
      // Only a clean press (no scroll/drag movement) toggles the active state.
      if (!moved) this.toggle(id);
      return;
    }
    if (Math.abs(dx) > el.offsetWidth * SWIPE_DELETE_RATIO) {
      // Play the slide-out, then commit the removal to state.
      el.classList.add('removing');
      el.style.transition = '';
      el.style.transform = '';
      window.setTimeout(() => this.deleteItem(id), DELETE_ANIM_MS);
    } else {
      el.style.transition = 'transform 0.2s ease';
      el.style.transform = 'translateX(0)';
    }
  };

  // Pointer capture stolen (e.g. the browser starts scrolling): abort, never toggle.
  private onPointerCancel = (): void => {
    if (this.dragId === null || !this.dragEl) return;
    const el = this.dragEl;
    this.endDrag();
    el.style.transition = 'transform 0.2s ease';
    el.style.transform = 'translateX(0)';
  };

  private endDrag(): void {
    this.deleteBgFor(this.dragEl)?.classList.remove('armed');
    this.dragId = null;
    this.dragEl = null;
    this.dragging = false;
    this.dragDX = 0;
  }

  private deleteBgFor(card: HTMLElement | null): Element | null | undefined {
    return card?.parentElement?.querySelector('.delete-bg');
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
    const items = this.visibleItems;
    const count = items.length;
    if (count === 0) {
      return html`<div class="empty">Everything cleared — scan more to find idle value.</div>`;
    }
    // Total and monthly reflect only the active items, so toggling updates the sum.
    const monthly = monthlyPassiveIncome(this.activeItems);
    return html`
      <h2 class="heading">${count} ${count === 1 ? 'item' : 'items'} found</h2>
      <p class="subheading">Tap to toggle · swipe a card left to remove it</p>
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
      ${items.map((item) => {
        const active = this.selected.has(item.id);
        return html`
          <div class="swipe">
            <div class="delete-bg"><span>🗑 Delete</span></div>
            <div
              class="card ${active ? 'active' : ''}"
              role="button"
              aria-pressed=${active ? 'true' : 'false'}
              aria-label="${item.name} — tap to toggle"
              tabindex="0"
              @pointerdown=${(e: PointerEvent) => this.onPointerDown(e, item.id)}
              @pointermove=${this.onPointerMove}
              @pointerup=${this.onPointerUp}
              @pointercancel=${this.onPointerCancel}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this.toggle(item.id);
                }
              }}
            >
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
          </div>
        `;
      })}
    `;
  }
}

if (!customElements.get('rentgen-results')) {
  customElements.define('rentgen-results', RentgenResults);
}
