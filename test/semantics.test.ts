import assert from 'node:assert/strict';
import { classifyZoneChange, KIND_LABEL } from '../src/utils/imageSketch.ts';

const W = 64;
const H = 64;
const REGION = { x: 16, y: 16, w: 32, h: 32, ratio: 1, changedPixels: 0 };

function solid(r: number, g: number, b: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = 255;
  }
  return px;
}

const GREEN = solid(40, 160, 60); // healthy vegetation
const BARE = solid(180, 160, 120); // dry soil / exposure
const DEEP_WATER = solid(20, 50, 140); // water
const PASTURE = solid(90, 150, 70); // lighter vegetation

// 1) vegetation -> bare : vegetation-loss
{
  const s = classifyZoneChange(GREEN, BARE, W, REGION);
  console.log(`veg->bare   : ${s.kind}  green ${s.greennessBefore.toFixed(2)}→${s.greennessAfter.toFixed(2)} bright ${s.brightnessBefore.toFixed(2)}→${s.brightnessAfter.toFixed(2)}`);
  assert.strictEqual(s.kind, 'vegetation-loss');
  assert.ok(s.greennessBefore > s.greennessAfter, 'greenness must fall');
  assert.ok(KIND_LABEL[s.kind].length > 0);
}

// 2) bare -> vegetation : vegetation-gain
{
  const s = classifyZoneChange(BARE, GREEN, W, REGION);
  console.log(`bare->veg   : ${s.kind}`);
  assert.strictEqual(s.kind, 'vegetation-gain');
}

// 3) neutral-dark grey -> bright grey : brightening (exposure), greenness unchanged
{
  const s = classifyZoneChange(solid(60, 60, 60), solid(200, 200, 200), W, REGION);
  console.log(`dark->light : ${s.kind}`);
  assert.strictEqual(s.kind, 'brightening');
  assert.ok(Math.abs(s.greennessBefore - s.greennessAfter) < 1e-9, 'greenness must be neutral both sides');
  assert.ok(s.brightnessAfter > s.brightnessBefore, 'brightness must rise');
}

// 4) bright land -> dark water : darkening (possible flooding)
{
  const s = classifyZoneChange(BARE, DEEP_WATER, W, REGION);
  console.log(`bare->water : ${s.kind}`);
  assert.strictEqual(s.kind, 'darkening');
}

// 5) subtle shift (pasture -> lighter green) : mixed (below both deltas)
{
  const s = classifyZoneChange(GREEN, PASTURE, W, REGION);
  console.log(`veg->pasture: ${s.kind}`);
  assert.strictEqual(s.kind, 'mixed');
}

// 6) identical -> mixed, zero deltas
{
  const s = classifyZoneChange(GREEN, GREEN, W, REGION);
  assert.strictEqual(s.kind, 'mixed');
  assert.ok(Math.abs(s.greennessBefore - s.greennessAfter) < 1e-9);
}

console.log(process.exitCode ? '❌ semantics checks failed' : '✅ semantics checks passed');