import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { computeChangeBoxes, computeCoverageMetrics, computeDiffMask, GSD_METERS } from '../src/utils/imageSketch.ts';
import { decodePng } from './png.ts';

const W = 1024;
const H = 1024;

/** Mirrors the production mask path: blurred diff, adaptive threshold, opaque red at changed pixels. */
function buildMask(a: Uint8ClampedArray, b: Uint8ClampedArray, w: number, h: number): { mask: Uint8ClampedArray; changed: number } {
  const { diff, threshold, changed } = computeDiffMask(a, b, w, h);
  const mask = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, p = 0; i < mask.length; i += 4, p++) {
    if (diff[p] > threshold) {
      mask[i] = 239;
      mask[i + 1] = 68;
      mask[i + 2] = 68;
      mask[i + 3] = 130;
    }
  }
  return { mask, changed };
}

function checkCoverage(name: string, totalChanged: number, boxes: ReturnType<typeof computeChangeBoxes>) {
  const cov = computeCoverageMetrics(totalChanged, boxes);
  const p = cov.precision;
  const r = cov.recall;
  const f1 = cov.f1;
  const iou = cov.iou;
  console.log(
    `  ${name.padEnd(22)} changed=${totalChanged} boxes=${boxes.length} P=${(p * 100).toFixed(1)}% R=${(r * 100).toFixed(1)}% F1=${(f1 * 100).toFixed(1)}% IoU=${(iou * 100).toFixed(1)}%`,
  );

  assert.ok(p >= 0 && p <= 1, `precision ${p} out of range`);
  assert.ok(r >= 0 && r <= 1, `recall ${r} out of range`);
  assert.ok(f1 >= 0 && f1 <= 1, `f1 ${f1} out of range`);
  assert.ok(iou >= 0 && iou <= 1, `iou ${iou} out of range`);
  assert.ok(iou <= f1 + 1e-9, 'IoU must never exceed F1 for binary overlap');
  if (totalChanged > 0) {
    const expected = (p * r) / (p + r - p * r || Number.EPSILON);
    assert.ok(Math.abs(iou - expected) < 1e-9, `IoU ${iou} must equal P·R/(P+R−P·R) = ${expected}`);
  }
}

// 1) Real pair — honest, bounded, internally consistent metrics
if (existsSync('T1_before.png') && existsSync('T2_after.png')) {
  const { data: d1 } = decodePng('T1_before.png');
  const { data: d2 } = decodePng('T2_after.png');
  const { mask, changed } = buildMask(d1, d2, W, H);
  const changedPct = (changed / (W * H)) * 100;
  console.log(`demo pair: ${changedPct.toFixed(1)}% of frame changed (${changed} px)`);
  assert.ok(changedPct > 1 && changedPct < 95, `changedPct ${changedPct} implausible`);
  const boxes = computeChangeBoxes(W, H, mask);
  checkCoverage('demo pair metrics', changed, boxes);
  const km2 = (changed * GSD_METERS * GSD_METERS) / 1e6;
  console.log(`  km² @ ${GSD_METERS} m/pixel: ${km2.toFixed(2)}`);
}

// 2) Perfect wrap — a single inserted block fully captured by its box
{
  const a = new Uint8ClampedArray(W * H * 4).fill(255, 3);
  const b = new Uint8ClampedArray(W * H * 4).fill(255, 3);
  for (let y = 480; y < 560; y++) {
    for (let x = 480; x < 560; x++) {
      const i = (y * W + x) * 4;
      b[i] = 0;
      b[i + 1] = 0;
      b[i + 2] = 255; // 80x80 blue block appears in T2 only
    }
  }
  const { mask, changed } = buildMask(a, b, W, H);
  const boxes = computeChangeBoxes(W, H, mask);
  checkCoverage('inserted block (ground truth)', changed, boxes);
  const cov = computeCoverageMetrics(changed, boxes);
  assert.ok(cov.recall > 0.95, `recall ${cov.recall} should be near 1 with a faithful box`);
  assert.ok(cov.precision > 0.4, `precision ${cov.precision} should be high on a tight box`);
}

// 3) Identical pair — zero change, zero metrics, no crash
{
  const a = new Uint8ClampedArray(W * H * 4).fill(120, 3);
  const b = new Uint8ClampedArray(W * H * 4).fill(120, 3);
  a.fill(255, 3);
  b.fill(255, 3);
  const { mask, changed } = buildMask(a, b, W, H);
  const boxes = computeChangeBoxes(W, H, mask);
  checkCoverage('identical pair', changed, boxes);
  assert.strictEqual(boxes.length, 0);
}

console.log(process.exitCode ? '❌ model checks failed' : '✅ model checks passed');