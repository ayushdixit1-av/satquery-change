/**
 * Single-image scene analysis.
 * Reads the pixels of one image and answers "what is in this image?":
 * land-cover shares, vegetation health, water extent, brightness and
 * structural detail — all rendered as a plain-language description.
 */

export interface SceneClassShare {
  label: string;
  pct: number;
  color: string;
}

export interface SceneResult {
  imageUrl: string;
  fileName: string;
  classes: SceneClassShare[];
  dominant: string;
  vegetationHealth: number;
  waterPct: number;
  urbanPct: number;
  brightness: number;
  detail: number;
  cloudPct: number;
  description: string;
}

const CLASS_COLORS: Record<string, string> = {
  Vegetation: '#22c55e',
  Water: '#38bdf8',
  'Built-up': '#94a3b8',
  Bare: '#d6a45a',
  Cloud: '#e2e8f0',
  Shadow: '#334155',
  Snow: '#f8fafc',
  Other: '#64748b',
};

function hsWords(n: number): { brightness: string; texture: string; health: string } {
  const brightness = n < 0.28 ? 'a dark scene' : n < 0.42 ? 'a dim scene' : n < 0.6 ? 'a moderately lit scene' : 'a bright scene';
  const texture = n < 0.14 ? 'smooth, uniform surfaces' : n < 0.3 ? 'mixed structure' : 'highly structured detail';
  const health = n > 0.65 ? 'excellent' : n > 0.5 ? 'healthy' : n > 0.35 ? 'moderate' : n > 0.2 ? 'stressed' : 'poor';
  return { brightness, texture, health };
}

function fallback(imageUrl: string, fileName: string): SceneResult {
  return {
    imageUrl,
    fileName,
    classes: [{ label: 'Other', pct: 100, color: CLASS_COLORS.Other }],
    dominant: 'Other',
    vegetationHealth: 0,
    waterPct: 0,
    urbanPct: 0,
    brightness: 0.5,
    detail: 0,
    cloudPct: 0,
    description: `Scene analysis of "${fileName}" could not be completed from the available pixels.`,
  };
}

/** Pure per-pixel classification + description assembly. Testable without a DOM. */
export function classifySceneData(
  imageUrl: string,
  fileName: string,
  data: Uint8ClampedArray,
  width: number,
  height: number,
): SceneResult {
  const counts: Record<string, number> = {};
  let total = 0;
  let luminanceSum = 0;
  let vegGreennessSum = 0;
  let vegPixels = 0;
  let waterPixels = 0;
  let urbanPixels = 0;
  let cloudPixels = 0;
  let edgePairs = 0;
  let edgeHits = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      luminanceSum += l;

      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const chroma = mx - mn;
      const sat = mx === 0 ? 0 : chroma / mx;

      let label: string;
      if (l > 225 && sat < 0.12) {
        label = 'Cloud';
        cloudPixels++;
      } else if (l < 40) {
        label = 'Shadow';
      } else if (b > r && b >= g && l < 150 && sat < 0.85) {
        label = 'Water';
        waterPixels++;
      } else if (g > r && g >= b && g - r > 10 && sat > 0.14) {
        label = 'Vegetation';
        vegPixels++;
        vegGreennessSum += (g - r) / (g + r + 1);
      } else if (r >= g && g >= b && chroma > 8 && sat < 0.45 && l > 70 && l < 235) {
        label = 'Bare';
      } else {
        label = 'Built-up';
        urbanPixels++;
      }

      counts[label] = (counts[label] ?? 0) + 1;
      total++;

      if (x < width - 1) {
        const nxt = (y * width + x + 1) * 4;
        const ln = 0.299 * data[nxt] + 0.587 * data[nxt + 1] + 0.114 * data[nxt + 2];
        edgePairs++;
        if (Math.abs(ln - l) > 30) edgeHits++;
      }
    }
  }

  const brightness = luminanceSum / Math.max(1, total) / 255;
  const detail = edgePairs ? edgeHits / edgePairs : 0;
  const vegetationHealth = vegPixels ? vegGreennessSum / vegPixels : 0;

  const classes = Object.entries(counts)
    .map(([label, n]) => ({ label, pct: (n / total) * 100, color: CLASS_COLORS[label] ?? CLASS_COLORS.Other }))
    .sort((a, b) => b.pct - a.pct);

  const totalClassified = Math.max(1, vegPixels + waterPixels + urbanPixels + cloudPixels);
  const waterPct = (waterPixels / totalClassified) * 100;
  const urbanPct = (urbanPixels / totalClassified) * 100;
  const cloudPct = (cloudPixels / totalClassified) * 100;

  const dominant = classes[0]?.label ?? 'Other';
  const words = hsWords(brightness);

  const parts: string[] = [];
  parts.push(
    `Scene analysis of "${fileName}". The frame is dominated by ${dominant.toLowerCase()} cover at ${classes[0]?.pct.toFixed(0)}%, ${words.brightness} with ${words.texture}.`,
  );

  const veg = classes.find((c) => c.label === 'Vegetation')?.pct ?? 0;
  if (veg > 8) {
    parts.push(
      `Vegetation spans ${veg.toFixed(0)}% of the scene and its health is ${words.health} (average greenness index ${vegetationHealth.toFixed(2)}).`,
    );
  }
  if (waterPct > 4) {
    parts.push(`Open water bodies cover ${waterPct.toFixed(0)}% of the frame.`);
  }
  if (urbanPct > 4) {
    parts.push(
      `Built-up or exposed surfaces account for ${urbanPct.toFixed(0)}% of the scene${
        detail > 0.3 ? ' — the strong edge density suggests structures, roads or dense development' : ' — mostly even, low-relief ground'
      }.`,
    );
  }
  if (cloudPct > 10) {
    parts.push(`About ${cloudPct.toFixed(0)}% of the frame is cloud-covered and may hide ground detail below.`);
  }
  const shadow = classes.find((c) => c.label === 'Shadow')?.pct ?? 0;
  if (shadow > 8) {
    parts.push(`Deep shadow accounts for ${shadow.toFixed(0)}% of the scene.`);
  }

  parts.push(`Overall brightness ${(brightness * 100).toFixed(0)}%, structural detail ${(detail * 100).toFixed(0)}%.`);

  return {
    imageUrl,
    fileName,
    classes,
    dominant,
    vegetationHealth,
    waterPct,
    urbanPct,
    brightness,
    detail,
    cloudPct,
    description: parts.join('\n'),
  };
}

export async function analyzeScene(imageUrl: string, fileName = 'scene.jpg'): Promise<SceneResult> {
  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = imageUrl;
  });

  try {
    const scale = Math.min(1, 256 / (img.naturalWidth || 256));
    const width = Math.max(8, Math.round((img.naturalWidth || 256) * scale));
    const height = Math.max(8, Math.round((img.naturalHeight || 256) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback(imageUrl, fileName);
    ctx.drawImage(img, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;

    return classifySceneData(imageUrl, fileName, data, width, height);
  } catch {
    return fallback(imageUrl, fileName);
  }
}