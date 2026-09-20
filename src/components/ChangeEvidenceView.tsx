import React, { useEffect, useRef, useState } from 'react';
import { Flame, ScanEye, MoveHorizontal } from 'lucide-react';
import { computeChangeBoxes, heatTint, type ChangeRegion } from '../utils/imageSketch';

export type ChangeVisMode = 'heat' | 'bounds' | 'scrub';

interface ChangeEvidenceViewProps {
  t1: string;
  t2: string;
  onReady?: (boxes: ChangeRegion[]) => void;
}

const MAX_SIZE = 900;
const HUE = (i: number) => 348 - i * 24;

function bracketPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, brace: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + brace);
  ctx.lineTo(x, y);
  ctx.lineTo(x + brace, y);
  ctx.moveTo(x + w - brace, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + brace);
  ctx.moveTo(x + w, y + h - brace);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - brace, y + h);
  ctx.moveTo(x + brace, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h - brace);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface Layers {
  t1: HTMLCanvasElement;
  t2: HTMLCanvasElement;
  heat: HTMLCanvasElement;
  box: HTMLCanvasElement;
  w: number;
  h: number;
}

interface UiState {
  mode: ChangeVisMode;
  scrub: number;
  active: number | null;
}

function drawEqualizer(
  ctx: CanvasRenderingContext2D,
  boxes: ChangeRegion[],
  w: number,
  h: number,
  tb: number,
  active: number | null,
) {
  if (!boxes.length) return;
  const slot = 13;
  const gap = 4;
  const totalW = boxes.length * slot + (boxes.length - 1) * gap + 14;
  const baseX = 12;
  const baseY = h - 16;
  const maxH = 44;

  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.74)';
  roundedRect(ctx, baseX - 6, baseY - maxH - 20, totalW + 10, maxH + 32, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
  ctx.font = 'bold 8px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Δ SEVERITY / ZONE', baseX, baseY - maxH + 2);

  boxes.forEach((b, i) => {
    const hue = HUE(i);
    const baseH = Math.max(8, Math.round(b.ratio * maxH));
    const osc = 0.75 + 0.25 * Math.sin(tb * 3.2 + i * 1.3);
    const bh = Math.max(6, Math.round(baseH * osc));
    const x = baseX + i * (slot + gap) + 2;
    const y = baseY - bh - 6;

    const barGrad = ctx.createLinearGradient(0, baseY, 0, y);
    barGrad.addColorStop(0, `hsl(${hue}, 92%, 30%)`);
    barGrad.addColorStop(1, `hsl(${hue}, 92%, 62%)`);
    ctx.fillStyle = barGrad;
    if (ctx.roundRect) ctx.beginPath(), ctx.roundRect(x, y, slot, bh, 3);
    else ctx.fillRect(x, y, slot, bh);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = `hsla(${hue}, 92%, 60%, 0.9)`;
    ctx.shadowBlur = 6;
    ctx.fillStyle = `hsl(${hue}, 90%, 55%)`;
    roundedRect(ctx, x, y, slot, 3, 1.5);
    ctx.fill();
    ctx.restore();

    ctx.font = 'bold 8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = active === i ? '#ffffff' : `hsl(${hue}, 95%, 78%)`;
    ctx.fillText(String(i + 1), x + slot / 2, baseY - 2);
  });
  ctx.restore();
}

const ChangeEvidenceView: React.FC<ChangeEvidenceViewProps> = ({ t1, t2, onReady }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layersRef = useRef<Layers | null>(null);
  const boxesRef = useRef<ChangeRegion[]>([]);
  const uiRef = useRef<UiState>({ mode: 'bounds', scrub: 50, active: null });
  const [mode, setMode] = useState<ChangeVisMode>('bounds');
  const [scrub, setScrub] = useState(50);
  const [active, setActive] = useState<number | null>(null);
  const [boxes, setBoxes] = useState<ChangeRegion[]>([]);

  useEffect(() => {
    uiRef.current = { mode, scrub, active };
  }, [mode, scrub, active]);

  useEffect(() => {
    boxesRef.current = boxes;
  }, [boxes]);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const load = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    void (async () => {
      try {
        const [a, b] = await Promise.all([load(t1), load(t2)]);
        if (cancelled || !canvas) return;

        const width = Math.min(Math.max(a.naturalWidth, b.naturalWidth, 8), MAX_SIZE);
        const height = Math.min(Math.max(a.naturalHeight, b.naturalHeight, 8), MAX_SIZE);
        canvas.width = width;
        canvas.height = height;

        const t1Can = document.createElement('canvas');
        const t2Can = document.createElement('canvas');
        t1Can.width = t2Can.width = width;
        t1Can.height = t2Can.height = height;
        const c1 = t1Can.getContext('2d');
        const c2 = t2Can.getContext('2d');
        if (!c1 || !c2) return;
        c1.drawImage(a, 0, 0, width, height);
        c2.drawImage(b, 0, 0, width, height);

        const heat = document.createElement('canvas');
        heat.width = width;
        heat.height = height;
        const hg = heat.getContext('2d');
        if (!hg) return;

        const d1 = c1.getImageData(0, 0, width, height).data;
        const d2 = c2.getImageData(0, 0, width, height).data;
        const maskImg = hg.createImageData(width, height);
        for (let i = 0; i < d1.length; i += 4) {
          const diff = (Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2])) / 3;
          if (diff > 42) {
            const tint = heatTint((diff - 42) / 200);
            maskImg.data[i] = tint.r;
            maskImg.data[i + 1] = tint.g;
            maskImg.data[i + 2] = tint.b;
            maskImg.data[i + 3] = tint.a;
          } else {
            maskImg.data[i + 3] = 0;
          }
        }
        hg.putImageData(maskImg, 0, 0);

        const computed = computeChangeBoxes(width, height, maskImg.data);
        setBoxes(computed);
        onReady?.(computed);

        const boxCan = document.createElement('canvas');
        boxCan.width = width;
        boxCan.height = height;
        const bg = boxCan.getContext('2d');
        if (!bg) return;

        bg.save();
        bg.fillStyle = 'rgba(3, 7, 18, 0.38)';
        bg.fillRect(0, 0, width, height);
        bg.globalCompositeOperation = 'destination-out';
        for (const z of computed) {
          roundedRect(bg, z.x - 7, z.y - 7, z.w + 14, z.h + 14, 12);
          bg.fill();
        }
        bg.restore();

        computed.forEach((z, i) => {
          const hue = HUE(i);
          bg.save();
          bg.shadowColor = `hsla(${hue}, 92%, 56%, 0.85)`;
          bg.shadowBlur = 12;
          bg.strokeStyle = `hsl(${hue}, 92%, 62%)`;
          bg.lineWidth = Math.max(2.5, Math.round(z.w / 220));
          bg.lineCap = 'round';
          bracketPath(bg, z.x, z.y, z.w, z.h, Math.max(8, Math.min(22, Math.round(z.w / 14))));
          bg.stroke();
          bg.restore();
          bg.fillStyle = `hsla(${hue}, 90%, 50%, 0.14)`;
          roundedRect(bg, z.x, z.y, z.w, z.h, Math.min(10, z.w / 4));
          bg.fill();

          const bd = 22;
          const bx = Math.min(Math.max(6, z.x), width - bd - 6);
          const by = Math.min(Math.max(6, z.y), height - bd - 6);
          bg.save();
          bg.shadowColor = `hsla(${hue}, 90%, 55%, 0.9)`;
          bg.shadowBlur = 10;
          bg.beginPath();
          bg.arc(bx + bd / 2, by + bd / 2, bd / 2, 0, Math.PI * 2);
          bg.fillStyle = `hsl(${hue}, 92%, 46%)`;
          bg.fill();
          bg.restore();
          bg.lineWidth = 2;
          bg.strokeStyle = 'rgba(255,255,255,0.85)';
          bg.stroke();
          bg.fillStyle = '#fff';
          bg.font = 'bold 12px system-ui, sans-serif';
          bg.textAlign = 'center';
          bg.textBaseline = 'middle';
          bg.fillText(String(i + 1), bx + bd / 2, by + bd / 2 + 0.5);
          bg.textAlign = 'left';
          bg.textBaseline = 'alphabetic';

          const text = `${i + 1} ${Math.round(z.ratio * 100)}%`;
          const lw = Math.ceil(text.length * 6.2) + 18;
          const lh = 20;
          const lxc = Math.min(Math.max(6, bx + bd + 8), width - lw - 6);
          const lyc = Math.max(6, by + (bd - lh) / 2);
          bg.fillStyle = 'rgba(2, 6, 23, 0.82)';
          roundedRect(bg, lxc, lyc, lw, lh, 10);
          bg.fill();
          bg.fillStyle = `hsl(${hue}, 95%, 80%)`;
          bg.font = 'bold 10px ui-monospace, monospace';
          bg.fillText(text, lxc + 10, lyc + 14);
        });

        layersRef.current = { t1: t1Can, t2: t2Can, heat, box: boxCan, w: width, h: height };

        let raf = 0;
        const render = (t: number) => {
          const L = layersRef.current;
          const ctx = canvas.getContext('2d');
          const ui = uiRef.current;
          if (L && ctx) {
            const { w, h } = L;
            const tb = t / 1000;

            ctx.clearRect(0, 0, w, h);
            if (ui.mode === 'scrub') {
              ctx.globalAlpha = 1;
              ctx.drawImage(L.t1, 0, 0);
              ctx.globalAlpha = ui.scrub / 100;
              ctx.drawImage(L.t2, 0, 0);
              ctx.globalAlpha = 1;
            } else {
              ctx.drawImage(L.t2, 0, 0);
              ctx.drawImage(L.heat, 0, 0);
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              ctx.globalAlpha = 0.45;
              ctx.drawImage(L.heat, 0, 0);
              ctx.restore();
            }

            ctx.drawImage(L.box, 0, 0);

            const zones = boxesRef.current;
            if (ui.active != null && zones[ui.active]) {
              zones.forEach((z, i) => {
                if (i === ui.active) return;
                ctx.fillStyle = 'rgba(3, 7, 18, 0.62)';
                roundedRect(ctx, z.x - 7, z.y - 7, z.w + 14, z.h + 14, 12);
                ctx.fill();
              });
            }

            zones.forEach((z, i) => {
              const hue = HUE(i);
              const brace = Math.max(8, Math.min(22, Math.round(z.w / 14)));
              const pulse = 0.04 + 0.07 * (0.5 + 0.5 * Math.sin(tb * 3 + i * 1.7));
              const isActive = ui.active === i;
              const amp = isActive ? 1.5 : 1;

              if (!isActive && ui.active != null) return;

              ctx.fillStyle = `hsla(${hue}, 90%, 50%, ${(pulse * amp).toFixed(3)})`;
              roundedRect(ctx, z.x, z.y, z.w, z.h, Math.min(10, z.w / 4));
              ctx.fill();

              ctx.save();
              ctx.shadowColor = `hsla(${hue}, 92%, 56%, ${((0.5 + 0.3 * Math.sin(tb * 4 + i)) * amp).toFixed(3)})`;
              ctx.shadowBlur = isActive ? 18 : 10;
              ctx.setLineDash([10, 8]);
              ctx.lineDashOffset = -((tb * 26 + i * 37) % 18);
              ctx.strokeStyle = `hsla(${hue}, 96%, 62%, ${(amp > 1 ? 1 : 0.95).toFixed(2)})`;
              ctx.lineWidth = Math.max(2, Math.round(z.w / 240)) * amp;
              ctx.lineCap = 'round';
              bracketPath(ctx, z.x, z.y, z.w, z.h, brace);
              ctx.stroke();
              ctx.restore();

              const bd = 22;
              const bx = Math.min(Math.max(6, z.x), w - bd - 6);
              const by = Math.min(Math.max(6, z.y), h - bd - 6);
              const cx = bx + bd / 2;
              const cy = by + bd / 2;
              for (const phase of [0, 34]) {
                const r = (tb * 42 + i * 130 + phase) % 74;
                ctx.strokeStyle = `hsla(${hue}, 90%, 60%, ${(0.38 * (1 - r / 74)).toFixed(3)})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
              }
            });

            drawEqualizer(ctx, zones, w, h, tb, ui.active);

            const sweep = (tb * 14) % (h + 160) - 80;
            const grad = ctx.createLinearGradient(0, sweep, 0, sweep + 26);
            grad.addColorStop(0, 'rgba(125, 211, 252, 0)');
            grad.addColorStop(0.5, 'rgba(125, 211, 252, 0.10)');
            grad.addColorStop(1, 'rgba(125, 211, 252, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, sweep, w, 26);
          }
          raf = requestAnimationFrame(render);
        };
        raf = requestAnimationFrame(render);

        return () => cancelAnimationFrame(raf);
      } catch {
        if (!cancelled) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0);
            img.src = t2;
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t1, t2]);

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-slate-200/80">
      <div className="relative">
        <canvas ref={canvasRef} className="block h-auto w-full" />
        <span className="pointer-events-none absolute left-1 top-1 h-3 w-3 border-l-2 border-t-2 border-sky-300/70" />
        <span className="pointer-events-none absolute right-1 top-1 h-3 w-3 border-r-2 border-t-2 border-sky-300/70" />
        <span className="pointer-events-none absolute bottom-1 left-1 h-3 w-3 border-b-2 border-l-2 border-sky-300/70" />
        <span className="pointer-events-none absolute bottom-1 right-1 h-3 w-3 border-b-2 border-r-2 border-sky-300/70" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/95 px-2.5 py-1.5">
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'heat', label: 'Heat map', Icon: Flame },
              { id: 'bounds', label: 'Change zones', Icon: ScanEye },
              { id: 'scrub', label: 'Before → After', Icon: MoveHorizontal },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={[
                'flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors',
                mode === id ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-white/10',
              ].join(' ')}
            >
              <Icon className="h-3 w-3" /> {label}
            </button>
          ))}
        </div>
        {mode === 'scrub' && (
          <div className="flex w-32 items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400">T1</span>
            <input
              type="range"
              min={0}
              max={100}
              value={scrub}
              onChange={(e) => setScrub(Number(e.target.value))}
              className="w-full accent-sky-400"
              aria-label="Before/after slider"
            />
            <span className="text-[9px] font-bold text-slate-400">T2</span>
          </div>
        )}
      </div>

      {boxes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 bg-slate-900/95 px-2.5 pb-2">
          {boxes.map((b, i) => {
            const hue = HUE(i);
            return (
              <button
                key={i}
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onClick={() => {
                  setMode('bounds');
                  setActive(active === i ? null : i);
                }}
                className={[
                  'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 transition-all',
                  active === i ? 'bg-white text-slate-900 ring-white' : 'ring-white/20 text-slate-300 hover:bg-white/10',
                ].join(' ')}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${hue}, 92%, 55%)` }} />
                Zone {i + 1}
                <span className="font-extrabold" style={{ color: `hsl(${hue}, 92%, 55%)` }}>
                  {Math.round(b.ratio * 100)}%
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChangeEvidenceView;