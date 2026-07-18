/**
 * Real DetectionAdapter (Stream 2): browser fetch → OpenAI vision (Structured Outputs) →
 * defensive parse → DetectedObject[]. Never reads import.meta.env — keys arrive via config.
 */

import type { DetectionAdapter } from '../adapters/types.js';
import type { DetectedObject } from '../types.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/** Fixed category list — keeps Stream 3's queries and Stream 4's grouping stable. */
export const CATEGORIES = [
  'Photography',
  'Electronics',
  'Audio',
  'Gaming',
  'Computing',
  'Tools',
  'Sports & Outdoor',
  'Music Instruments',
  'Home & Kitchen',
  'Furniture',
  'Other',
] as const;

const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORIES);

const MIN_CONFIDENCE = 0.3;
const MAX_ITEMS = 12;
const NAME_MAX_LEN = 80;
const CONDITION_MAX_LEN = 60;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_TOKENS = 500;
const TEMPERATURE = 0.2;

const PROMPT = `You are an expert at identifying distinct sellable/rentable objects in a photo for a peer-to-peer marketplace.

List each distinct movable object that a person could sell or rent out. For each object, provide:

1. "name" — follow this specificity ladder, in order of preference:
   a. brand + model, if legible (e.g. "Canon PowerShot G7X Mark II")
   b. brand + type, if the model isn't legible (e.g. "Bosch cordless drill")
   c. precise generic description (e.g. "18V cordless drill")
   Never return a vague name like "electronic device" or "gadget" — if you truly cannot tell what it is, omit it.

2. "category" — exactly one of: ${CATEGORIES.join(' · ')}.

3. "condition" — short resale-speak based only on visible evidence, e.g. "used - good", "used - visible wear", "like new". Do not invent details you cannot see.

4. "confidence" — a number 0..1 representing how certain you are that the NAME is correct (not whether something is present). If the brand/model is unreadable, use a generic name and an honestly lower confidence.

Skip rules — do NOT list: built-in fixtures, walls, floors, ceilings, cables or chargers as standalone items, or people.

List each distinct physical object once. An empty list is a valid and correct answer if nothing sellable/rentable is visible.

Return at most ${MAX_ITEMS} objects.`;

const JSON_SCHEMA = {
  name: 'detected_objects',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            category: { type: 'string', enum: [...CATEGORIES] },
            condition: { type: 'string' },
            confidence: { type: 'number' },
          },
          required: ['name', 'category', 'condition', 'confidence'],
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  },
} as const;

interface OpenAIVisionConfig {
  readonly openaiApiKey: string;
  readonly model?: 'gpt-4o' | 'gpt-4o-mini';
}

interface RawItem {
  readonly name?: unknown;
  readonly category?: unknown;
  readonly condition?: unknown;
  readonly confidence?: unknown;
}

const cleanString = (value: unknown, maxLen: number): string =>
  String(value ?? '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function toImageUrl(imageBase64: string): string {
  return imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
}

function validateItem(raw: RawItem, index: number): DetectedObject | undefined {
  const name = cleanString(raw.name, NAME_MAX_LEN);
  if (!name) {
    console.warn(`[openai-vision] dropping item ${index}: missing/empty name`);
    return undefined;
  }

  const rawCategory = cleanString(raw.category, 40);
  const category = CATEGORY_SET.has(rawCategory) ? rawCategory : 'Other';

  const condition = cleanString(raw.condition, CONDITION_MAX_LEN) || 'used - good';

  const rawConfidence = typeof raw.confidence === 'number' ? raw.confidence : Number(raw.confidence);
  const confidence = clamp01(Number.isFinite(rawConfidence) ? rawConfidence : 0);

  if (confidence < MIN_CONFIDENCE) {
    console.warn(`[openai-vision] dropping "${name}": confidence ${confidence} below ${MIN_CONFIDENCE}`);
    return undefined;
  }

  return { id: `oa-${index}`, name, category, condition, confidence };
}

function parseResponseContent(content: string): DetectedObject[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`OpenAI vision returned invalid JSON: ${content.slice(0, 200)}`);
  }

  const items = (parsed as { items?: unknown })?.items;
  if (!Array.isArray(items)) {
    throw new Error('OpenAI vision response missing "items" array');
  }

  const validated: DetectedObject[] = [];
  for (const raw of items) {
    if (validated.length >= MAX_ITEMS) break;
    const item = validateItem((raw ?? {}) as RawItem, validated.length);
    if (item) validated.push(item);
  }
  return validated;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenAI(imageBase64: string, config: OpenAIVisionConfig): Promise<string> {
  const model = config.model ?? 'gpt-4o';
  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          {
            type: 'image_url',
            image_url: { url: toImageUrl(imageBase64), detail: 'auto' },
          },
        ],
      },
    ],
    response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
  };

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw new Error(`OpenAI vision request failed: ${lastError.message}`);
    }

    if (res.ok) {
      const json = (await res.json()) as {
        choices?: ReadonlyArray<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('OpenAI vision response missing message content');
      }
      return content;
    }

    const isRetryable = res.status === 429 || res.status >= 500;
    if (isRetryable && attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    const errorBody = await res.text().catch(() => '');
    throw new Error(`OpenAI vision request failed with status ${res.status}: ${errorBody.slice(0, 200)}`);
  }

  // Unreachable: the loop above always returns or throws.
  throw new Error(`OpenAI vision request failed: ${lastError?.message ?? 'unknown error'}`);
}

export function createOpenAIVisionAdapter(config: OpenAIVisionConfig): DetectionAdapter {
  return {
    async detect(imageBase64: string): Promise<DetectedObject[]> {
      const content = await callOpenAI(imageBase64, config);
      return parseResponseContent(content);
    },
  };
}
