/**
 * Gemini DetectionAdapter (frame-batch first — the krempel pattern). All sampled
 * keyframes of a video pan go to Gemini in ONE call; the model sees full-scene context,
 * dedupes the same object across frames itself, and reports per item the frame with the
 * best view (`frameIndex`) plus a bounding box within THAT frame for card cropping.
 *
 * Why this beats the on-device-detector + per-crop pipeline (measured in krempel):
 * one request instead of N, no dependence on COCO's 80 classes (which simply don't
 * contain a DJI Osmo or smart glasses), and full frames instead of blurry partial crops.
 */

import type { DetectionAdapter } from '../adapters/types.js';
import type { BoundingBox, DetectedObject, PriceRange } from '../types.js';
import { CATEGORIES } from './openai-vision.js';

const GEMINI_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
/** Latest Flash, thinking disabled — measured ~1.8 s for a 2-frame batch. */
const DEFAULT_MODEL = 'gemini-flash-latest';
/**
 * Rate-limit fallback: chunked scanning sends ~4 requests per 15 s pan, which can trip
 * the per-minute quota (saw a live 429 burst). Lite has its OWN quota bucket and is
 * faster, so it makes a perfect pressure valve.
 */
const FALLBACK_MODEL = 'gemini-flash-lite-latest';
const RETRY_DELAY_MS = 2000;
const DEFAULT_MIN_CONFIDENCE = 0.45;
const MAX_ITEMS = 12;
const NAME_MAX_LEN = 80;
const CONDITION_MAX_LEN = 60;
const REQUEST_TIMEOUT_MS = 60_000;
const TEMPERATURE = 0.2;
/** Retail estimates are stamped in this currency (matches the enrichment default). */
const RETAIL_CURRENCY = 'EUR';
const MAX_RETAIL_EUR = 1_000_000;

const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORIES);

const PROMPT = `You see keyframes sampled from a video pan across a room. Identify every distinct movable object a person could sell or rent on a peer-to-peer marketplace.

Deduplicate across frames: the same physical object appearing in several frames = exactly ONE item.

For each item provide:
1. "name" — specificity ladder, in order of preference: (a) brand + model if legible ("Canon PowerShot G7X Mark II"), (b) brand + type ("Bosch cordless drill"), (c) precise generic description ("18V cordless drill"). Never a vague name like "electronic device".
2. "category" — exactly one of: ${CATEGORIES.join(' · ')}.
3. "condition" — short resale-speak from visible evidence only, e.g. "used - good", "like new".
4. "confidence" — 0..1: how certain you are the NAME is correct. Unreadable brand → generic name + honestly lower confidence.
5. "bestFrameIndex" — 0-based index of the frame with the clearest view of this object.
6. "box" — bounding box of the object IN THAT BEST FRAME as fractions 0..1 (x, y = top-left, w, h = size). Reasonably tight.
7. "estimatedRetail" — the approximate price to buy this item NEW at retail today, in EUR, as { "min", "max" } (a sensible range, not the used price). Use your knowledge of the product's typical new/MSRP price; if the exact model is unknown, give your best estimate for that product class. Always provide a positive range.

Skip: built-in fixtures, walls/floors, cables/chargers as standalone items, people; low-value clutter (bottles, cups, dishes, food, plants, deco knick-knacks, pens, paper notebooks, stationery); anything clearly under ~€15 used resale value.

Include an item when you are reasonably sure what it is (confidence ≥ 0.4) — a plausible generic listing beats a missed item. An empty list is valid. At most ${MAX_ITEMS} items.`;

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      name: { type: 'STRING' },
      category: { type: 'STRING' },
      condition: { type: 'STRING' },
      confidence: { type: 'NUMBER' },
      bestFrameIndex: { type: 'INTEGER' },
      box: {
        type: 'OBJECT',
        properties: {
          x: { type: 'NUMBER' },
          y: { type: 'NUMBER' },
          w: { type: 'NUMBER' },
          h: { type: 'NUMBER' },
        },
      },
      estimatedRetail: {
        type: 'OBJECT',
        properties: {
          min: { type: 'NUMBER' },
          max: { type: 'NUMBER' },
        },
      },
    },
    required: ['name', 'category', 'condition', 'confidence', 'bestFrameIndex'],
  },
} as const;

export interface GeminiVisionConfig {
  readonly geminiApiKey: string;
  /** e.g. 'gemini-flash-latest' (default) or 'gemini-flash-lite-latest' (faster). */
  readonly model?: string;
  /** Drop items below this identification confidence (default 0.45). */
  readonly minConfidence?: number;
  /** Known products likely to appear (demo inventory) — steadies naming. */
  readonly hints?: readonly string[];
}

function buildPrompt(hints: readonly string[] | undefined): string {
  if (!hints || hints.length === 0) return PROMPT;
  return `${PROMPT}

KNOWN INVENTORY HINTS: the user's items likely include: ${hints.join('; ')}.
If a detected object plausibly matches one of these products, use that EXACT name (and a higher confidence). Only when the visual evidence is compatible — never force a hint onto a clearly different object.`;
}

const cleanString = (value: unknown, maxLen: number): string =>
  String(value ?? '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Accept data URLs or bare base64; Gemini wants bare base64 + a mime type. */
function toInlineData(frame: string): { mime_type: string; data: string } {
  const match = /^data:(image\/[a-z+.-]+);base64,(.*)$/is.exec(frame);
  if (match) return { mime_type: match[1], data: match[2] };
  return { mime_type: 'image/jpeg', data: frame };
}

function validateBox(raw: unknown): BoundingBox | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const b = raw as { x?: unknown; y?: unknown; w?: unknown; h?: unknown };
  const x = clamp01(Number(b.x));
  const y = clamp01(Number(b.y));
  const w = clamp01(Number(b.w));
  const h = clamp01(Number(b.h));
  if (![x, y, w, h].every(Number.isFinite)) return undefined;
  if (w < 0.03 || h < 0.03) return undefined; // degenerate sliver
  if (w * h > 0.85) return undefined; // effectively the whole frame
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
}

/** Parse the model's new/retail estimate into a positive, currency-tagged EUR range. */
function validateRetail(raw: unknown): PriceRange | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as { min?: unknown; max?: unknown };
  let lo = Number(r.min);
  let hi = Number(r.max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return undefined;
  if (lo > hi) [lo, hi] = [hi, lo];
  lo = Math.min(MAX_RETAIL_EUR, Math.max(1, Math.round(lo)));
  hi = Math.min(MAX_RETAIL_EUR, Math.max(lo, Math.round(hi)));
  if (!(lo > 0 && lo <= hi)) return undefined;
  return { min: lo, max: hi, currency: RETAIL_CURRENCY };
}

interface RawItem {
  readonly name?: unknown;
  readonly category?: unknown;
  readonly condition?: unknown;
  readonly confidence?: unknown;
  readonly bestFrameIndex?: unknown;
  readonly box?: unknown;
  readonly estimatedRetail?: unknown;
}

function validateItem(
  raw: RawItem,
  index: number,
  frameCount: number,
  minConfidence: number,
): DetectedObject | undefined {
  const name = cleanString(raw.name, NAME_MAX_LEN);
  if (!name) return undefined;

  const rawCategory = cleanString(raw.category, 40);
  const category = CATEGORY_SET.has(rawCategory) ? rawCategory : 'Other';
  const condition = cleanString(raw.condition, CONDITION_MAX_LEN) || 'used - good';

  const rawConfidence = Number(raw.confidence);
  const confidence = clamp01(Number.isFinite(rawConfidence) ? rawConfidence : 0);
  if (confidence < minConfidence) {
    console.warn(`[gemini-vision] dropping "${name}": confidence ${confidence} below ${minConfidence}`);
    return undefined;
  }

  const rawFrame = Math.trunc(Number(raw.bestFrameIndex));
  const frameIndex =
    Number.isFinite(rawFrame) && rawFrame >= 0 && rawFrame < frameCount ? rawFrame : 0;
  const box = validateBox(raw.box);
  const estimatedRetail = validateRetail(raw.estimatedRetail);

  return {
    id: `gm-${index}`,
    name,
    category,
    condition,
    confidence,
    frameIndex,
    ...(box ? { box } : {}),
    ...(estimatedRetail ? { estimatedRetail } : {}),
  };
}

function parseResponseText(
  text: string,
  frameCount: number,
  minConfidence: number,
): DetectedObject[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini vision returned invalid JSON: ${text.slice(0, 200)}`);
  }
  if (!Array.isArray(parsed)) throw new Error('Gemini vision response was not an array');

  const validated: DetectedObject[] = [];
  for (const raw of parsed) {
    if (validated.length >= MAX_ITEMS) break;
    const item = validateItem((raw ?? {}) as RawItem, validated.length, frameCount, minConfidence);
    if (item) validated.push(item);
  }
  return validated;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 429 ladder: retry the same model once after a short pause; if still throttled, hop to
 * the fallback model (separate per-model quota). Anything else fails fast.
 */
async function callGemini(
  frames: readonly string[],
  config: GeminiVisionConfig,
): Promise<string> {
  const model = config.model ?? DEFAULT_MODEL;
  try {
    return await callGeminiModel(frames, config, model);
  } catch (error: unknown) {
    if (!isRateLimit(error)) throw error;
    await sleep(RETRY_DELAY_MS);
    try {
      return await callGeminiModel(frames, config, model);
    } catch (retryError: unknown) {
      if (!isRateLimit(retryError) || model === FALLBACK_MODEL) throw retryError;
      console.warn(`[gemini-vision] ${model} rate-limited twice — falling back to ${FALLBACK_MODEL}`);
      return callGeminiModel(frames, config, FALLBACK_MODEL);
    }
  }
}

const isRateLimit = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('status 429');

async function callGeminiModel(
  frames: readonly string[],
  config: GeminiVisionConfig,
  model: string,
): Promise<string> {
  const body = {
    contents: [
      {
        parts: [
          { text: buildPrompt(config.hints) },
          ...frames.map((frame) => ({ inline_data: toInlineData(frame) })),
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      response_schema: RESPONSE_SCHEMA,
      temperature: TEMPERATURE,
      // Latest Flash "thinks" by default — that took a 1.8 s call to 60 s+. Never think here.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetch(`${GEMINI_URL_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': config.geminiApiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`Gemini vision request failed with status ${res.status}: ${errorBody.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    candidates?: ReadonlyArray<{
      content?: { parts?: ReadonlyArray<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    const reason =
      json.candidates?.[0]?.finishReason ?? json.promptFeedback?.blockReason ?? 'unknown';
    throw new Error(`Gemini vision response had no text part (reason: ${reason})`);
  }
  return text;
}

export function createGeminiVisionAdapter(config: GeminiVisionConfig): DetectionAdapter {
  const minConfidence = config.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const run = async (frames: readonly string[]): Promise<DetectedObject[]> => {
    if (frames.length === 0) return [];
    const text = await callGemini(frames, config);
    return parseResponseText(text, frames.length, minConfidence);
  };
  return {
    detect: (imageBase64: string) => run([imageBase64]),
    detectBatch: (framesBase64: readonly string[]) => run(framesBase64),
  };
}
