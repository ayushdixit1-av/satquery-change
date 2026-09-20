/**
 * Gemini "boost" — a cellsense-minimal language enhancer.
 *
 * Design goal: the user should never *feel* an API, and the key should barely
 * move. To achieve that:
 *  - Local pixel analysis still runs first and instantly.
 *  - Gemini is called at most ONCE per analysis, only when it adds value.
 *  - Images are downscaled to a single <=768px JPEG before leaving the device.
 *  - Results are cached locally (identical input = 0 calls).
 *  - A per-day hard cap stops all calls once exhausted (fall back to heuristics).
 *  - Every claim is grounded: the model is told the exact pixel evidence and
 *    told to describe only that — no inventing.
 */

import type { AnalysisItem } from '../types';

export interface BoostSettings {
  key: string;
  model: string;
  mode: 'off' | 'auto' | 'always';
  dailyCap: number;
}

interface BoostResult {
  ok: boolean;
  text?: string;
  error?: string;
  fromCache?: boolean;
}

interface BudgetEntry {
  day: string;
  calls: number;
}

const BUDGET_KEY = 'satquery.gemini.budget';
const CACHE_KEY = 'satquery.gemini.cache';
const CACHE_MAX = 60;
const REQUEST_TIMEOUT_MS = 20_000;

const GATE_WORDS = [
  'describe',
  'explain',
  'what happened',
  'why',
  'tell',
  'detail',
  'summar',
  'answer',
  'scene',
  'see',
  'look',
];

export const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', label: '2.5 Flash (fast, $0.30/M in)' },
  { id: 'gemini-2.5-flash-lite', label: '2.5 Flash-Lite (cheapest)' },
  { id: 'gemini-2.5-pro', label: '2.5 Pro (best reasoning, pricier)' },
];

export function geminiReady(s: BoostSettings): boolean {
  return Boolean(s.key && s.mode !== 'off');
}

export function shouldBoost(query: string, mode: 'off' | 'auto' | 'always'): boolean {
  if (mode === 'always') return true;
  if (mode === 'off') return false;
  const q = query.toLowerCase();
  return GATE_WORDS.some((w) => q.includes(w));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readBudget(): BudgetEntry {
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    if (raw) {
      const entry = JSON.parse(raw) as BudgetEntry;
      if (entry.day === today()) return entry;
    }
  } catch {
    // ignore
  }
  return { day: today(), calls: 0 };
}

function writeBudget(entry: BudgetEntry): void {
  try {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

export function usageToday(): number {
  return readBudget().calls;
}

function consumeBudget(cap: number): boolean {
  const entry = readBudget();
  if (entry.calls >= cap) return false;
  entry.calls += 1;
  writeBudget(entry);
  return true;
}

interface CacheEntry {
  key: string;
  text: string;
  at: number;
}

export function cacheGet(key: string): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw) as CacheEntry[];
    const hit = list.find((e) => e.key === key);
    return hit ? hit.text : null;
  } catch {
    return null;
  }
}

export function cacheSet(key: string, text: string): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const list = (raw ? (JSON.parse(raw) as CacheEntry[]) : []).filter((e) => e.key !== key);
    list.unshift({ key, text, at: Date.now() });
    while (list.length > CACHE_MAX) list.pop();
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** Downscale to a single JPEG <= maxW, returns base64 data URL (sans prefix). */
async function toSmallJpeg(dataUrl: string, maxW = 768, quality = 0.72): Promise<{ b64: string; mime: string } | null> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxW / (img.naturalWidth || 1));
  const w = Math.max(8, Math.round((img.naturalWidth || 8) * scale));
  const h = Math.max(8, Math.round((img.naturalHeight || 8) * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const jpeg = c.toDataURL('image/jpeg', quality);
  return { b64: jpeg.split(',')[1], mime: 'image/jpeg' };
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

async function callGemini(
  key: string,
  model: string,
  parts: GeminiPart[],
  schema: Record<string, unknown>,
): Promise<string | null> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

function extractSummary(raw: string): string | null {
  try {
    const obj = JSON.parse(raw) as { summary?: string };
    return typeof obj.summary === 'string' && obj.summary.trim() ? obj.summary.trim() : null;
  } catch {
    // the model sometimes returns plain text inside JSON mode — trust it if useful
    return raw && raw.trim().length > 8 ? raw.trim() : null;
  }
}

function cacheKey(seed: string, query: string, model: string): string {
  return fnv(`${seed.slice(0, 4000)}|${query}|${model}`);
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
  },
  required: ['summary'],
};

export async function boostScene(
  settings: BoostSettings,
  scene: { imageUrl: string; fileName: string; classes: { label: string; pct: number }[]; vegetationHealth: number; waterPct: number; urbanPct: number; brightness: number; detail: number; cloudPct: number },
  query: string,
): Promise<BoostResult> {
  if (!geminiReady(settings)) return { ok: false, error: 'gemini-off' };
  if (!consumeBudget(settings.dailyCap)) return { ok: false, error: 'budget' };

  const key = cacheKey(scene.imageUrl, `scene:${query}`, settings.model);
  const cached = cacheGet(key);
  if (cached) return { ok: true, text: cached, fromCache: true };

  try {
    const image = await toSmallJpeg(scene.imageUrl);
    if (!image) return { ok: false, error: 'img' };
    const evidence = scene.classes.map((c) => `${c.label} ${c.pct.toFixed(1)}%`).join(', ');
    const prompt =
      `You are a remote-sensing analyst. A device already measured your reference image on-device. ` +
      `Here is the measured evidence — DO NOT contradict it and DO NOT invent facts beyond it: ` +
      `land-cover shares: ${evidence}; vegetation-health index ${scene.vegetationHealth.toFixed(2)}; ` +
      `open water ${scene.waterPct.toFixed(1)}%; built/exposed ${scene.urbanPct.toFixed(1)}%; ` +
      `brightness ${Math.round(scene.brightness * 100)}%; structural detail ${Math.round(scene.detail * 100)}%; ` +
      `cloud cover ${scene.cloudPct.toFixed(1)}%. Look at the reference image of "${scene.fileName}" and ` +
      `answer the question "${query}" by describing the scene in 3-6 vivid but strictly evidence-based sentences. ` +
      `Return JSON with a single field "summary".`;

    const raw = await callGemini(settings.key, settings.model, [{ text: prompt }, { inlineData: { mimeType: image.mime, data: image.b64 } }], SCHEMA);
    const text = extractSummary(raw ?? '');
    if (!text) return { ok: false, error: 'empty' };
    cacheSet(key, text);
    return { ok: true, text };
  } catch {
    return { ok: false, error: 'net' };
  }
}

export async function boostChange(
  settings: BoostSettings,
  analysis: Pick<AnalysisItem, 't1Image' | 't2Image' | 'metrics'>,
  evidenceImageUrl: string,
  query: string,
): Promise<BoostResult> {
  if (!geminiReady(settings)) return { ok: false, error: 'gemini-off' };
  if (!consumeBudget(settings.dailyCap)) return { ok: false, error: 'budget' };

  const a = analysis;
  const key = cacheKey(`${a.t1Image}|${a.t2Image}`, `change:${query}`, settings.model);
  const cached = cacheGet(key);
  if (cached) return { ok: true, text: cached, fromCache: true };

  try {
    const image = await toSmallJpeg(evidenceImageUrl);
    if (!image) return { ok: false, error: 'img' };
    const m = a.metrics;
    const prompt =
      `You are a remote-sensing change-detection analyst. A device already measured this T1/T2 pair. ` +
      `The composite image shows T2 with red numbered boxes around detected change zones. ` +
      `Ground truth (measured on-device, do not invent beyond it): changed area ${m.changedAreaPct.toFixed(1)}% ` +
      `(≈ ${a.metrics.changedAreaKm2.toFixed(2)} km² with your scale), Precision ${m.precision.toFixed(1)}, Recall ${m.recall.toFixed(1)}, ` +
      `F1 ${m.f1.toFixed(1)}, IoU ${m.iou.toFixed(1)}. Look at the boxed zones in the image and, answering the ` +
      `question "${query}", explain in 4-7 sentences WHAT changed in each visible zone and the overall picture. ` +
      `Describe only what the boxes/evidence support. Return JSON with a single field "summary".`;

    const raw = await callGemini(settings.key, settings.model, [{ text: prompt }, { inlineData: { mimeType: image.mime, data: image.b64 } }], SCHEMA);
    const text = extractSummary(raw ?? '');
    if (!text) return { ok: false, error: 'empty' };
    cacheSet(key, text);
    return { ok: true, text };
  } catch {
    return { ok: false, error: 'net' };
  }
}