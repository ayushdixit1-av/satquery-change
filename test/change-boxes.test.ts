import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { computeChangeBoxes } from '../src/utils/imageSketch.ts';
import { decodePng } from './png.ts';

/** Mirrors the exact mask imageSketch builds: alpha=130 tint where mean RGB diff > 42. */
function buildMask(a: Uint8ClampedArray, b: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < a.length; i += 4) {
    const dr = Math.abs(a[i] - b[i]);
    const dg = Math.abs(a[i + 1] - b[i + 1]);
    const db = Math.abs(a[i + 2] - b[i + 2]);
    if ((dr + dg + db) / 3 > 42) {
      mask[i] = 239;
      mask[i + 1] = 68;
      mask[i + 2] = 68;
      mask[i + 3] = 130;
    }
  }
  return mask;
}

const W = 1024;
const H = 1024;

// 1) Real T1/T2 pair must produce >= 1 tight box every time
if (existsSync('T1_before.png') && existsSync('T2_after.png')) {
  const { data: d1 } = decodePng('T1_before.png');
  const { data: d2 } = decodePng('T2_after.png');
  const mask = buildMask(d1, d2, W, H);

  let changed = 0;
  for (let i = 0; i < mask.length; i += 4) if (mask[i + 3]) changed++;
  console.log(`changed pixels: ${changed.toLocaleString()} (${((changed / (W * H)) * 100).toFixed(2)}% of frame)`);

  const boxes = computeChangeBoxes(W, H, mask);
  console.log(`regionCount = ${boxes.length}`);
  for (const b of boxes) {
    console.log(
      `  box x=${b.x} y=${b.y} w=${b.w} h=${b.h} changed=${b.changedPixels} fill=${(b.ratio * 100).toFixed(1)}%`,
    );
    assert.ok(b.w >= 8 && b.h >= 8, 'box too small (<8px)');
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H, 'box out of canvas bounds');
    assert.ok(b.ratio >= 0.03 && b.ratio <= 1, `fill ratio out of range: ${b.ratio}`);
  }
  assert.ok(boxes.length >= 1, 'expected at least one change box on the demo T1/T2 pair');
  assert.ok(boxes.length <= 6, 'expected at most 6 kept regions');
} else {
  console.log('SKIP — T1_before.png / T2_after.png not present');
}

// 2) Identical pair must yield zero boxes
{
  const a = new Uint8ClampedArray(W * H * 4);
  const b = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < a.length; i += 4) {
    a[i] = b[i] = 120;
    a[i + 1] = b[i + 1] = 100;
    a[i + 2] = b[i + 2] = 80;
    a[i + 3] = b[i + 3] = 255;
  }
  const boxes = computeChangeBoxes(W, H, buildMask(a, b, W, H));
  assert.strictEqual(boxes.length, 0, 'identical images must not produce boxes');
}

// 3) A small square region in the center must yield exactly one box hugging it
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
  const boxes = computeChangeBoxes(W, H, buildMask(a, b, W, H));
  assert.ok(boxes.length >= 1, 'expected a box for the 80x80 inserted block');
  const main = boxes[0];
  assert.ok(main.w >= 60 && main.w <= 140, `box width ${main.w} should roughly hug 80px block`);
  assert.ok(main.h >= 60 && main.h <= 140, `box height ${main.h} should roughly hug 80px block`);
  assert.ok(main.x >= 470 && main.x <= 490, `box x ${main.x} near 480`);
  assert.ok(main.y >= 470 && main.y <= 490, `box y ${main.y} near 480`);
  console.log(`  inserted-block box: x=${main.x} y=${main.y} w=${main.w} h=${main.h} fill=${(main.ratio * 100).toFixed(1)}%`);
}

console.log(process.exitCode ? '❌ box checks failed' : '✅ box checks passed');