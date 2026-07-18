/**
 * DetectionAdapter — OpenAI vision. "List the distinct sellable/rentable objects in
 * this photo, each with name, category, condition, confidence."
 *
 * STATUS: skeleton. The request/parse shape is here; tune the prompt and validate the
 * JSON against real photos (Vision teammate, hour 1). Falls back to the stub adapter
 * when no API key is provided, so the app keeps working offline.
 *
 * ⚠️ Keys are embedded in the browser bundle — a deliberate, demo-scoped trade-off
 * (spec §9). Rotate after the event. This is not a shipped-product posture.
 */

import type { DetectionAdapter } from './types.js';
import type { DetectedObject } from '../types.js';
import { StubDetectionAdapter } from './stub.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o'; // vision-capable; swap per available credits

const SYSTEM_PROMPT = `You identify distinct physical objects in a photo that could be
resold or rented out. Return ONLY JSON of the form:
{"objects":[{"name":string,"category":string,"condition":string,"confidence":number}]}
- name: specific if possible (brand + model), else generic.
- category: e.g. Electronics, Furniture, Accessories, Tools.
- condition: short, e.g. "used - good".
- confidence: 0..1.
List each distinct object once. Ignore fixtures (walls, floors, built-ins).`;

export class OpenAIVisionAdapter implements DetectionAdapter {
  private readonly fallback = new StubDetectionAdapter();

  constructor(private readonly apiKey?: string) {}

  async detect(imageBase64: string): Promise<DetectedObject[]> {
    if (!this.apiKey) {
      // No key → keep the demo alive with mock objects.
      return this.fallback.detect(imageBase64);
    }

    const imageUrl = toDataUrl(imageBase64);
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Identify the objects in this photo.' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI vision failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? '{}';
    return parseObjects(raw);
  }
}

/** Ensure OpenAI gets a data URL. Accepts either a bare base64 string or a full data URL. */
function toDataUrl(imageBase64: string): string {
  return imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
}

/** Parse + defensively validate the model's JSON into DetectedObject[]. */
function parseObjects(raw: string): DetectedObject[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`OpenAI vision returned non-JSON: ${raw.slice(0, 200)}`);
  }

  const objects = (parsed as { objects?: unknown[] })?.objects;
  if (!Array.isArray(objects)) return [];

  return objects.map((o, i) => {
    const obj = o as Record<string, unknown>;
    return {
      id: `oa-${i}`,
      name: String(obj.name ?? 'Unknown item'),
      category: String(obj.category ?? 'Other'),
      condition: String(obj.condition ?? 'unknown'),
      confidence: clamp01(Number(obj.confidence ?? 0.5)),
    };
  });
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}
