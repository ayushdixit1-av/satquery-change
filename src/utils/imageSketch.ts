/**
 * Utility to generate bi-temporal change evidence:
 *  - a T2 overlay tinted where pixels differ,
 *  - tight bounding-box rectangles that hug the actual change regions,
 *  - a plain-text natural-language summary of where the changes are.
 */

export interface ChangeRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  ratio: number;
  changedPixels: number;
}

/** Assumed ground-sample distance when no sensor metadata is supplied (m/pixel). */
export const GSD_METERS = 30;

/** Honest self-evaluation of how well the box representation captures the change mask. */
export interface CoverageMetrics {
  precision: number;
  recall: number;
  f1: number;
  iou: number;
}

export interface SketchEvidenceResult {
  evidenceUrl: string;
  changedKm2: number;
  changedPct: number;
  regionCount: number;
  regions: ChangeRegion[];
  width: number;
  height: number;
  gsdMeters: number;
  coverage: CoverageMetrics;
}

/**
 * Coverage metrics comparing the boxed zones against the raw change mask:
 *  - recall = fraction of changed pixels that fall inside a zone box
 *  - precision = fraction of zone-box area that is actually changed
 *  - f1 / iou derived as usual (iou === P·R / (P+R−P·R)).
 */
export function computeCoverageMetrics(totalChanged: number, boxes: ChangeRegion[]): CoverageMetrics {
  const overlap = boxes.reduce((s, b) => s + b.changedPixels, 0);
  const boxArea = boxes.reduce((s, b) => s + b.w * b.h, 0);
  const tp = Math.min(overlap, Math.max(0, totalChanged));
  const recall = totalChanged > 0 ? tp / totalChanged : 0;
  const precision = boxArea > 0 ? tp / boxArea : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const union = totalChanged + boxArea - tp;
  const iou = union > 0 ? tp / union : 0;
  return { precision, recall, f1, iou };
}

interface RawBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cnt: number;
}

const MASK_ALPHA = 32;

/** Heat-ramp tint for a given change magnitude (0..1). Green → yellow → red. */
export function heatTint(score: number): { r: number; g: number; b: number; a: number } {
  const s = Math.max(0, Math.min(1, score));
  let r: number;
  let g: number;
  let b: number;
  if (s < 0.33) {
    const t = s / 0.33;
    r = 74 + (250 - 74) * t;
    g = 222 + (204 - 222) * t;
    b = 128 + (21 - 128) * t;
  } else if (s < 0.66) {
    const t = (s - 0.33) / 0.33;
    r = 250 + (249 - 250) * t;
    g = 204 + (115 - 204) * t;
    b = 21 + (22 - 21) * t;
  } else {
    const t = (s - 0.66) / 0.34;
    r = 249;
    g = 115 - 115 * t;
    b = 22;
  }
  const a = Math.round(34 + s * 110);
  return { r, g, b, a };
}

function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  lw: number,
  brace: number,
) {
  const b = Math.max(8, brace);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // top-left
  ctx.moveTo(x, y + b);
  ctx.lineTo(x, y);
  ctx.lineTo(x + b, y);
  // top-right
  ctx.moveTo(x + w - b, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + b);
  // bottom-right
  ctx.moveTo(x + w, y + h - b);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - b, y + h);
  // bottom-left
  ctx.moveTo(x + b, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h - b);
  ctx.stroke();
}

function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  sub: string,
  width: number,
  height: number,
  hue: number,
) {
  const bd = 22;
  const bx = Math.min(Math.max(6, x), width - bd - 6);
  const by = Math.min(Math.max(6, y), height - bd - 6);

  // pin ring
  ctx.save();
  ctx.shadowColor = `hsla(${hue}, 90%, 55%, 0.9)`;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(bx + bd / 2, by + bd / 2, bd / 2, 0, Math.PI * 2);
  ctx.fillStyle = `hsl(${hue}, 92%, 46%)`;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(label), bx + bd / 2, by + bd / 2 + 0.5);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const text = `${label} ${sub}`;
  const lw = Math.ceil(text.length * 6.2) + 18;
  const lh = 20;
  const lx = Math.min(Math.max(6, bx + bd + 8), width - lw - 6);
  const ly = Math.max(6, by + (bd - lh) / 2);

  ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
  roundedRect(ctx, lx, ly, lw, lh, 10);
  ctx.fill();
  ctx.fillStyle = `hsl(${hue}, 95%, 80%)`;
  ctx.font = 'bold 10px ui-monospace, monospace';
  ctx.fillText(text, lx + 10, ly + 14);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mergeBoxes(boxes: RawBox[]): RawBox[] {
  const list = boxes.map((b) => ({ ...b }));
  let merged = true;

  while (merged) {
    merged = false;
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const iw = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const ih = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);

        if (iw > 0 && ih > 0) {
          const inter = iw * ih;
          const areaA = (a.x1 - a.x0 + 1) * (a.y1 - a.y0 + 1);
          const areaB = (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);
          const iou = inter / (areaA + areaB - inter);
          if (iou >= 0.25) {
            list[i] = {
              x0: Math.min(a.x0, b.x0),
              y0: Math.min(a.y0, b.y0),
              x1: Math.max(a.x1, b.x1),
              y1: Math.max(a.y1, b.y1),
              cnt: a.cnt + b.cnt,
            };
            list.splice(j, 1);
            merged = true;
            break outer;
          }
        }
      }
    }
  }

  return list;
}

/**
 * Cluster the change mask into regions, splitting connected blobs at the pixel
 * level so dense change zones get their own boxes instead of one whole-frame
 * outline. Cells seed candidate zones; 8-connected pixels refine the bounds.
 */
export function computeChangeBoxes(width: number, height: number, maskData: Uint8ClampedArray): ChangeRegion[] {
  const totalPixels = width * height;
  const alphaAt = (px: number, py: number) => maskData[(py * width + px) * 4 + 3];

  // 1. Coarse occupancy grid for seeding clusters (cells only qualify if a
  //    meaningful share of their area is actually changed)
  const cols = Math.min(96, Math.max(28, Math.ceil(width / 12)));
  const rows = Math.min(96, Math.max(28, Math.ceil(height / 12)));
  const cellW = width / cols;
  const cellH = height / rows;
  const cellHits = new Uint32Array(cols * rows);

  for (let py = 0; py < height; py++) {
    const cj = Math.min(rows - 1, Math.floor(py / cellH));
    const rowBase = cj * cols;
    for (let px = 0; px < width; px++) {
      if (alphaAt(px, py) > MASK_ALPHA) {
        const ci = Math.min(cols - 1, Math.floor(px / cellW));
        cellHits[rowBase + ci]++;
      }
    }
  }

  const cellArea = cellW * cellH;
  const cellActive = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (cellHits[j * cols + i] >= Math.max(2, cellArea * 0.12)) cellActive[j * cols + i] = 1;
    }
  }

  // 2. Flood-fill connected cells into candidate zones
  const visited = new Uint8Array(cols * rows);
  const stack: number[] = [];
  const seeds: { minI: number; maxI: number; minJ: number; maxJ: number; size: number }[] = [];

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const idx = j * cols + i;
      if (!cellActive[idx] || visited[idx]) continue;

      visited[idx] = 1;
      stack.push(idx);
      let minI = i;
      let maxI = i;
      let minJ = j;
      let maxJ = j;
      let size = 0;

      while (stack.length) {
        const cur = stack.pop()!;
        const ci = cur % cols;
        const cj = (cur - ci) / cols;
        size++;
        minI = Math.min(minI, ci);
        maxI = Math.max(maxI, ci);
        minJ = Math.min(minJ, cj);
        maxJ = Math.max(maxJ, cj);

        const neighbors = [
          ci > 0 ? cur - 1 : -1,
          ci < cols - 1 ? cur + 1 : -1,
          cj > 0 ? cur - cols : -1,
          cj < rows - 1 ? cur + cols : -1,
        ];
        for (const nb of neighbors) {
          if (nb >= 0 && !visited[nb] && cellActive[nb]) {
            visited[nb] = 1;
            stack.push(nb);
          }
        }
      }

      if (size >= 3) seeds.push({ minI, maxI, minJ, maxJ, size });
    }
  }

  // 3. Within each zone, run 8-connected component labeling on the exact
  //    changed pixels so spatially separate change areas stay separate.
  const minPixels = Math.max(12, Math.round(totalPixels * 0.0003));
  const raw: RawBox[] = [];

  for (const seed of seeds) {
    const sx0 = Math.max(0, Math.floor(seed.minI * cellW) - 2);
    const sy0 = Math.max(0, Math.floor(seed.minJ * cellH) - 2);
    const sx1 = Math.min(width - 1, Math.ceil((seed.maxI + 1) * cellW) + 2);
    const sy1 = Math.min(height - 1, Math.ceil((seed.maxJ + 1) * cellH) + 2);

    const wl = sx1 - sx0 + 1;
    const hl = sy1 - sy0 + 1;
    const seen = new Uint8Array(wl * hl);
    const label = new Int32Array(wl * hl).fill(-1);
    const sizeOf = new Map<number, number>();
    const stack2: number[] = [];
    let nextLabel = 0;

    for (let yy = 0; yy < hl; yy++) {
      for (let xx = 0; xx < wl; xx++) {
        const gx = sx0 + xx;
        const gy = sy0 + yy;
        const key = yy * wl + xx;
        if (seen[key] || alphaAt(gx, gy) <= MASK_ALPHA) continue;
        seen[key] = 1;
        label[key] = nextLabel;
        sizeOf.set(nextLabel, 1);
        stack2.push(key);

        while (stack2.length) {
          const cur = stack2.pop()!;
          const cx = cur % wl;
          const cy = (cur - cx) / wl;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx < 0 || ny < 0 || nx >= wl || ny >= hl) continue;
              const nk = ny * wl + nx;
              if (seen[nk] || alphaAt(sx0 + nx, sy0 + ny) <= MASK_ALPHA) continue;
              seen[nk] = 1;
              label[nk] = nextLabel;
              sizeOf.set(nextLabel, (sizeOf.get(nextLabel) ?? 0) + 1);
              stack2.push(nk);
            }
          }
        }
        nextLabel++;
      }
    }

    const bounds = new Map<number, { x0: number; y0: number; x1: number; y1: number }>();
    for (let yy = 0; yy < hl; yy++) {
      for (let xx = 0; xx < wl; xx++) {
        const lb = label[yy * wl + xx];
        if (lb < 0) continue;
        const b = bounds.get(lb) ?? { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        const gx = sx0 + xx;
        const gy = sy0 + yy;
        b.x0 = Math.min(b.x0, gx);
        b.x1 = Math.max(b.x1, gx);
        b.y0 = Math.min(b.y0, gy);
        b.y1 = Math.max(b.y1, gy);
        bounds.set(lb, b);
      }
    }

    for (const [lb, b] of bounds) {
      const cnt = sizeOf.get(lb) ?? 0;
      if (cnt < minPixels) continue;
      const pad = 3;
      const bx0 = Math.max(0, b.x0 - pad);
      const by0 = Math.max(0, b.y0 - pad);
      const bx1 = Math.min(width - 1, b.x1 + pad);
      const by1 = Math.min(height - 1, b.y1 + pad);
      if (bx1 - bx0 < 8 || by1 - by0 < 8) continue;
      raw.push({ x0: bx0, y0: by0, x1: bx1, y1: by1, cnt });
    }
  }

  // 4. Merge overlapping neighbours, drop sparse echoes, keep top regions
  return mergeBoxes(raw)
    .map((b) => {
      const w = b.x1 - b.x0 + 1;
      const h = b.y1 - b.y0 + 1;
      return {
        x: b.x0,
        y: b.y0,
        w,
        h,
        changedPixels: b.cnt,
        ratio: b.cnt / (w * h),
      };
    })
    .filter((b) => b.ratio >= 0.08)
    .sort((a, b) => b.changedPixels - a.changedPixels)
    .slice(0, 6);
}

function nth(i: number): string {
  const words = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
  return words[i] ?? `${i + 1}th`;
}

function locate(r: ChangeRegion, width: number, height: number): string {
  const cx = (r.x + r.w / 2) / width;
  const cy = (r.y + r.h / 2) / height;
  const horiz = cx < 0.33 ? 'left' : cx > 0.66 ? 'right' : 'centre';
  const vert = cy < 0.33 ? 'top' : cy > 0.66 ? 'bottom' : 'middle';
  if (vert === 'middle' && horiz === 'centre') return 'centre of the frame';
  return `${vert}-${horiz}`;
}

/** Natural-language description of the full change picture. */
export function describeChanges(ev: SketchEvidenceResult): string {
  const scaleNote = `assuming ${ev.gsdMeters} m/pixel ground sampling`;
  if (ev.regionCount === 0) {
    return [
      'Change scan complete — no significant pixel-level delta was found in this pair.',
      `Net difference stayed negligible across the AOI (≈ ${ev.changedPct.toFixed(1)}%), ${scaleNote}.`,
    ].join('\n');
  }

  const c = ev.coverage;
  const head = `Change scan complete: ${ev.regionCount} distinct change zone${ev.regionCount === 1 ? '' : 's'} boxed and labeled.`;
  const lines = [
    head,
    `Net change: ${ev.changedPct.toFixed(1)}% of the area (≈ ${ev.changedKm2.toFixed(2)} km², ${scaleNote}).`,
    `Zone fidelity: boxes capture ${(c.recall * 100).toFixed(0)}% of the detected change footprint at ${(c.precision * 100).toFixed(0)}% precision.`,
  ];

  const totalChanged = ev.regions.reduce((s, r) => s + r.changedPixels, 0) || 1;
  ev.regions.slice(0, 5).forEach((r, i) => {
    const share = (r.changedPixels / totalChanged) * 100;
    const shareTxt = share >= 90 && i === 0 ? 'the majority' : `~${Math.round(share)}%`;
    lines.push(
      `${nth(i)} region — ${locate(r, ev.width, ev.height)}: ${Math.round(r.ratio * 100)}% of that box changed, carrying ${shareTxt} of the total delta.`,
    );
  });

  return lines.join('\n');
}

export async function generateSketchedEvidence(
  t1Url: string,
  t2Url: string,
): Promise<SketchEvidenceResult> {
  return new Promise((resolve) => {
    const img1 = new Image();
    const img2 = new Image();
    img1.crossOrigin = 'anonymous';
    img2.crossOrigin = 'anonymous';

    const fallback = (evidenceUrl: string, width = 512, height = 512): SketchEvidenceResult => ({
      evidenceUrl,
      changedKm2: 0,
      changedPct: 0,
      regionCount: 0,
      regions: [],
      width,
      height,
      gsdMeters: GSD_METERS,
      coverage: { precision: 0, recall: 0, f1: 0, iou: 0 },
    });

    let loadedCount = 0;
    const onBothLoaded = () => {
      try {
        const width = Math.min(img2.naturalWidth || 512, 1024);
        const height = Math.min(img2.naturalHeight || 512, 1024);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(fallback(t2Url, width, height));
          return;
        }

        // 1. Draw base T2 observation image
        ctx.drawImage(img2, 0, 0, width, height);

        // 2. Pixel-difference mask
        const c1 = document.createElement('canvas');
        c1.width = width;
        c1.height = height;
        const ctx1 = c1.getContext('2d');

        const c2 = document.createElement('canvas');
        c2.width = width;
        c2.height = height;
        const ctx2 = c2.getContext('2d');

        let changeRatio = 0.12;
        let changeBoxes: ChangeRegion[] = [];
        let diffPixels = 0;
        const totalPixels = width * height;

        if (ctx1 && ctx2) {
          ctx1.drawImage(img1, 0, 0, width, height);
          ctx2.drawImage(img2, 0, 0, width, height);

          const d1 = ctx1.getImageData(0, 0, width, height).data;
          const d2 = ctx2.getImageData(0, 0, width, height).data;

          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = width;
          maskCanvas.height = height;
          const mCtx = maskCanvas.getContext('2d');

          if (mCtx) {
            const maskImg = mCtx.createImageData(width, height);
            for (let i = 0; i < d1.length; i += 4) {
              const dr = Math.abs(d1[i] - d2[i]);
              const dg = Math.abs(d1[i + 1] - d2[i + 1]);
              const db = Math.abs(d1[i + 2] - d2[i + 2]);
              const diff = (dr + dg + db) / 3;

              if (diff > 42) {
                diffPixels++;
                const tint = heatTint((diff - 42) / 200);
                maskImg.data[i] = tint.r;
                maskImg.data[i + 1] = tint.g;
                maskImg.data[i + 2] = tint.b;
                maskImg.data[i + 3] = tint.a;
              } else {
                maskImg.data[i + 3] = 0;
              }
            }
            mCtx.putImageData(maskImg, 0, 0);

            // Heat-tinted change overlay on T2 (severity ramps green → yellow → red)
            ctx.drawImage(maskCanvas, 0, 0);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.5;
            ctx.drawImage(maskCanvas, 0, 0);
            ctx.restore();
            changeRatio = diffPixels / totalPixels;

            // Tight rectangle zones around the exact changed pixels
            changeBoxes = computeChangeBoxes(width, height, maskImg.data);
          }
        }

        // 3. Spotlight: darken the frame, punch bright holes over the change zones
        ctx.save();
        ctx.fillStyle = 'rgba(3, 7, 18, 0.4)';
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'destination-out';
        changeBoxes.forEach((b) => {
          roundedRect(ctx, b.x - 7, b.y - 7, b.w + 14, b.h + 14, Math.min(12, (b.w + 14) / 4));
          ctx.fill();
        });
        ctx.restore();

        // 4. Corner-bracket boundaries + numbered pins over each change zone
        changeBoxes.forEach((b, i) => {
          const hue = 348 - i * 24;
          const brace = Math.min(22, Math.max(10, Math.round(b.w / 14)));
          const glow = `hsla(${hue}, 92%, 56%, 0.85)`;

          ctx.save();
          ctx.shadowColor = glow;
          ctx.shadowBlur = 12;
          drawCornerBrackets(ctx, b.x, b.y, b.w, b.h, `hsl(${hue}, 92%, 62%)`, Math.max(2.5, Math.round(b.w / 220)), brace);
          ctx.restore();

          // faint fill so the changed imagery stays visible
          ctx.fillStyle = `hsla(${hue}, 90%, 50%, 0.14)`;
          roundedRect(ctx, b.x, b.y, b.w, b.h, Math.min(10, b.w / 4));
          ctx.fill();

          drawPin(ctx, b.x, b.y, String(i + 1), `${Math.round(b.ratio * 100)}%`, width, height, hue);
        });

        // 5. Change-intensity legend + watermark
        const legendW = 150;
        const legendH = 9;
        const lx0 = 14;
        const ly0 = height - 22;
        ctx.save();
        ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
        roundedRect(ctx, lx0 - 8, ly0 - 7, legendW + 16, 24, 8);
        ctx.fill();
        const grad = ctx.createLinearGradient(lx0, 0, lx0 + legendW, 0);
        grad.addColorStop(0, '#4ade80');
        grad.addColorStop(0.33, '#facc15');
        grad.addColorStop(0.66, '#f97316');
        grad.addColorStop(1, '#ef4444');
        ctx.fillStyle = grad;
        roundedRect(ctx, lx0, ly0, legendW, legendH, 4);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 9px ui-monospace, monospace';
        ctx.fillText('Δ CHANGE INTENSITY  •  low → high', lx0, ly0 + 18);
        ctx.restore();

        ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
        ctx.fillRect(width - 212, height - 26, 202, 20);
        ctx.fillStyle = '#7dd3fc';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('SatQuery AI · Heatmap + Bounding-Box Evidence', width - 207, height - 12);

        const evidenceUrl = canvas.toDataURL('image/jpeg', 0.9);
        const coverage = computeCoverageMetrics(diffPixels, changeBoxes);
        const changedKm2 = Number((diffPixels * (GSD_METERS * GSD_METERS) / 1e6).toFixed(2));
        const changedPct = Number((changeRatio * 100).toFixed(1));

        resolve({
          evidenceUrl,
          changedKm2,
          changedPct,
          regionCount: changeBoxes.length,
          regions: changeBoxes,
          width,
          height,
          gsdMeters: GSD_METERS,
          coverage,
        });
      } catch (e) {
        console.error('Evidence sketching error:', e);
        resolve(fallback(t2Url));
      }
    };

    img1.onload = () => {
      loadedCount++;
      if (loadedCount === 2) onBothLoaded();
    };
    img2.onload = () => {
      loadedCount++;
      if (loadedCount === 2) onBothLoaded();
    };
    img1.onerror = () => resolve(fallback(t2Url));
    img2.onerror = () => resolve(fallback(t2Url));

    img1.src = t1Url;
    img2.src = t2Url;
  });
}