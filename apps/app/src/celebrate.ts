/**
 * Discovery feedback — the game layer (ported from the krempel prototype's motion.ts).
 * pling(): a two-note WebAudio chime, no audio asset needed.
 * moneyBurst(): money emojis launch from the bottom edge, fly up, and gravity-fall.
 * Both respect prefers-reduced-motion and must never break the scan flow.
 */

const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Sound ---------------------------------------------------------------------------

let actx: AudioContext | null = null;

function blip(freq: number, delayS: number, dur: number, gain: number): void {
  if (!actx) return;
  const t0 = actx.currentTime + delayS;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(actx.destination);
  o.start(t0);
  o.stop(t0 + dur);
}

/** Two rising notes — the "found money" pling. Safe to call from any event handler. */
export function pling(): void {
  try {
    actx = actx ?? new AudioContext();
    if (actx.state === 'suspended') void actx.resume();
    blip(880, 0, 0.12, 0.06);
    blip(1320, 0.09, 0.18, 0.06);
  } catch {
    /* audio must never break the flow */
  }
}

// ---- Money particles -----------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  glyph: string;
  rot: number;
  vrot: number;
  life: number;
}

const GLYPHS = ['💶', '💰', '💸', '€'];
const GRAVITY = 0.28;
const LIFE_FRAMES = 110;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let looping = false;

function ensureCanvas(): void {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40';
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  const size = (): void => {
    if (canvas) {
      canvas.width = innerWidth;
      canvas.height = innerHeight;
    }
  };
  addEventListener('resize', size);
  size();
}

function loop(): void {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter((p) => p.life > 0 && p.y < canvas!.height + 60);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += GRAVITY;
    p.vx *= 0.995;
    p.rot += p.vrot;
    p.life--;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.min(1, p.life / 25);
    ctx.font = `${p.size}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(p.glyph, 0, 0);
    ctx.restore();
  }
  if (particles.length > 0) requestAnimationFrame(loop);
  else looping = false;
}

/** Launch money from the bottom edge — up, then gravity brings it back down. */
export function moneyBurst(count = 14): void {
  if (reduced()) return;
  ensureCanvas();
  if (!canvas) return;
  for (let i = 0; i < count; i++) {
    const x = canvas.width * (0.25 + Math.random() * 0.5);
    particles.push({
      x,
      y: canvas.height + 24,
      vx: (Math.random() - 0.5) * 5,
      vy: -(11 + Math.random() * 7),
      size: 22 + Math.random() * 14,
      glyph: GLYPHS[i % GLYPHS.length],
      rot: (Math.random() - 0.5) * 0.8,
      vrot: (Math.random() - 0.5) * 0.18,
      life: LIFE_FRAMES,
    });
  }
  if (!looping) {
    looping = true;
    requestAnimationFrame(loop);
  }
}
