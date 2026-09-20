import assert from 'node:assert/strict';
import { classifySceneData } from '../src/utils/sceneAnalysis.ts';

const W = 64;
const H = 64;

function makeScene(rowColors: Array<[number, number, number]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  const rows = rowColors.length;
  for (let y = 0; y < H; y++) {
    const [r, g, b] = rowColors[Math.min(rows - 1, Math.floor((y * rows) / H))];
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

function run(name: string, scene: Uint8ClampedArray, expect: (r: ReturnType<typeof classifySceneData>, assert: typeof assert) => void) {
  try {
    const res = classifySceneData('test', `${name}.png`, scene, W, H);
    expect(res, assert);
    const bars = res.classes.slice(0, 4).map((c) => `${c.label} ${c.pct.toFixed(0)}%`).join(' · ');
    console.log(`PASS  ${name.padEnd(28)} → ${bars}`);
  } catch (e) {
    console.error(`FAIL  ${name} — ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

function share(res: ReturnType<typeof classifySceneData>, label: string): number {
  return res.classes.find((c) => c.label === label)?.pct ?? 0;
}

// 1) Solid healthy vegetation
run('solid vegetation', makeScene([[40, 160, 60]]), (r, a) => {
  a.ok(share(r, 'Vegetation') > 98, `expected ~100% vegetation, got ${share(r, 'Vegetation')}`);
  a.ok(r.dominant === 'Vegetation');
  a.ok(r.vegetationHealth > 0.5, `veg health too low: ${r.vegetationHealth}`);
});

// 2) Solid deep-navy water (previously misclassified!)
run('solid navy water', makeScene([[30, 60, 120]]), (r, a) => {
  a.ok(share(r, 'Water') > 98, `expected ~100% water, got ${share(r, 'Water')}`);
  a.ok(r.waterPct > 98, `waterPct=${r.waterPct}`);
});

// 3) Solid mid-grey built-up
run('solid grey urban', makeScene([[128, 128, 128]]), (r, a) => {
  a.ok(share(r, 'Built-up') > 98, `expected ~100% built-up, got ${share(r, 'Built-up')}`);
});

// 4) Solid dark shadow
run('solid dark shadow', makeScene([[12, 12, 12]]), (r, a) => {
  a.ok(share(r, 'Shadow') > 98, `expected ~100% shadow, got ${share(r, 'Shadow')}`);
});

// 5) Solid white cloud
run('solid white cloud', makeScene([[250, 250, 250]]), (r, a) => {
  a.ok(share(r, 'Cloud') > 98, `expected ~100% cloud, got ${share(r, 'Cloud')}`);
});

// 6) Half veg / half water split → ~50/50
run('50% veg 50% water', makeScene([[40, 160, 60], [30, 60, 120]]), (r, a) => {
  const v = share(r, 'Vegetation');
  const w = share(r, 'Water');
  a.ok(Math.abs(v - 50) < 4, `veg expected ~50, got ${v}`);
  a.ok(Math.abs(w - 50) < 4, `water expected ~50, got ${w}`);
});

// 7) Half cloud / half dark → cloud ~50, shadow ~50
run('50% cloud 50% shadow', makeScene([[250, 250, 250], [10, 10, 10]]), (r, a) => {
  a.ok(Math.abs(share(r, 'Cloud') - 50) < 4, `cloud expected ~50`);
  a.ok(Math.abs(share(r, 'Shadow') - 50) < 4, `shadow expected ~50`);
});

// 8) Bright bare soil (r>=g>=b, low saturation)
run('solid bare soil', makeScene([[220, 200, 160]]), (r, a) => {
  a.ok(share(r, 'Bare') > 95, `expected ~100% bare, got ${share(r, 'Bare')}`);
});

// 9) Checkerboard urban block → high structural detail is reported
run('checkerboard urban', (() => {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const on = (x + y) % 2 === 0;
      d[i] = on ? 200 : 90;
      d[i + 1] = on ? 200 : 90;
      d[i + 2] = on ? 200 : 90;
      d[i + 3] = 255;
    }
  return d;
})(), (r, a) => {
  a.ok(r.detail > 0.4, `expected high detail on checkerboard, got ${r.detail}`);
  a.ok(share(r, 'Built-up') > 98);
});

// 10) Same color both frames → edge pairs stay zero-drift (sanity for detail == 0)
run('flat field (no texture)', makeScene([[100, 110, 90]]), (r, a) => {
  a.strictEqual(r.detail, 0);
});

if (process.exitCode) console.log('❌ some checks failed');
else console.log('✅ all checks passed');