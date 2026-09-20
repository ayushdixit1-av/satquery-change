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

const ChangeEvidenceView: React.FC<ChangeEvidenceViewProps> = ({ t1, t2, onReady }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<ChangeVisMode>('bounds');
  const [scrub, setScrub] = useState(50);
  const boxesRef = useRef<ChangeRegion[]>([]);

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

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // --- base layers ---
        const t1Can = document.createElement('canvas');
        const t2Can = document.createElement('canvas');
        t1Can.width = width;
        t2Can.width = width;
        t1Can.height = height;
        t2Can.height = height;
        const c1 = t1Can.getContext('2d');
        const c2 = t2Can.getContext('2d');
        if (!c1 || !c2) return;
        c1.drawImage(a, 0, 0, width, height);
        c2.drawImage(b, 0, 0, width, height);

        // --- heat layer ---
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

        const boxes = computeChangeBoxes(width, height, maskImg.data);
        boxesRef.current = boxes;
        onReady?.(boxes);

        // boxes overlay layer (spotlight + corner brackets + pins), redrawn per mode toggle
        const boxCan = document.createElement('canvas');
        boxCan.width = width;
        boxCan.height = height;
        const bg = boxCan.getContext('2d');
        if (!bg) return;

        bg.save();
        bg.fillStyle = 'rgba(3, 7, 18, 0.38)';
        bg.fillRect(0, 0, width, height);
        bg.globalCompositeOperation = 'destination-out';
        for (const b of boxes) {
          bg.beginPath();
          bg.roundRect ? bg.roundRect(b.x - 7, b.y - 7, b.w + 14, b.h + 14, 12) : bg.rect(b.x - 7, b.y - 7, b.w + 14, b.h + 14);
          bg.fill();
        }
        bg.restore();

        boxes.forEach((b, i) => {
          const hue = 348 - i * 24;
          bg.save();
          bg.shadowColor = `hsla(${hue}, 92%, 56%, 0.85)`;
          bg.shadowBlur = 12;
          bg.strokeStyle = `hsl(${hue}, 92%, 62%)`;
          bg.lineWidth = Math.max(2.5, Math.round(b.w / 220));
          bg.lineCap = 'round';
          const br = Math.max(8, Math.min(22, Math.round(b.w / 14)));
          bg.beginPath();
          bg.moveTo(b.x, b.y + br);
          bg.lineTo(b.x, b.y);
          bg.lineTo(b.x + br, b.y);
          bg.moveTo(b.x + b.w - br, b.y);
          bg.lineTo(b.x + b.w, b.y);
          bg.lineTo(b.x + b.w, b.y + br);
          bg.moveTo(b.x + b.w, b.y + b.h - br);
          bg.lineTo(b.x + b.w, b.y + b.h);
          bg.lineTo(b.x + b.w - br, b.y + b.h);
          bg.moveTo(b.x + br, b.y + b.h);
          bg.lineTo(b.x, b.y + b.h);
          bg.lineTo(b.x, b.y + b.h - br);
          bg.stroke();
          bg.restore();

          // pin + chip
          const bd = 22;
          const bx = Math.min(Math.max(6, b.x), width - bd - 6);
          const by = Math.min(Math.max(6, b.y), height - bd - 6);
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

          const text = `${i + 1} ${Math.round(b.ratio * 100)}%`;
          const lw = Math.ceil(text.length * 6.2) + 18;
          const lh = 20;
          const lxc = Math.min(Math.max(6, bx + bd + 8), width - lw - 6);
          const lyc = Math.max(6, by + (bd - lh) / 2);
          bg.fillStyle = 'rgba(2, 6, 23, 0.82)';
          bg.beginPath();
          if (bg.roundRect) bg.roundRect(lxc, lyc, lw, lh, 10);
          else bg.rect(lxc, lyc, lw, lh);
          bg.fill();
          bg.fillStyle = `hsl(${hue}, 95%, 80%)`;
          bg.font = 'bold 10px ui-monospace, monospace';
          bg.fillText(text, lxc + 10, lyc + 14);
        });

        const draw = () => {
          if (!ctx) return;
          ctx.clearRect(0, 0, width, height);
          if (mode === 'scrub') {
            ctx.globalAlpha = 1;
            ctx.drawImage(t1Can, 0, 0);
            ctx.globalAlpha = scrub / 100;
            ctx.drawImage(t2Can, 0, 0);
            ctx.globalAlpha = 1;
            ctx.drawImage(boxCan, 0, 0);
          } else {
            ctx.drawImage(t2Can, 0, 0);
            ctx.drawImage(heat, 0, 0);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.45;
            ctx.drawImage(heat, 0, 0);
            ctx.restore();
            if (mode === 'bounds') ctx.drawImage(boxCan, 0, 0);
          }
        };
        draw();
        (canvas as HTMLCanvasElement & { __draw?: () => void }).__draw = draw;
      } catch {
        if (!cancelled) {
          // fall back to raw T2 on the canvas
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

  // redraw when mode or scrub changes
  useEffect(() => {
    const canvas = canvasRef.current as (HTMLCanvasElement & { __draw?: () => void }) | null;
    canvas?.__draw?.();
  }, [mode, scrub]);

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-slate-200/80">
      <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: '16/10', objectFit: 'cover' }} />
      <div className="flex items-center justify-between gap-2 bg-slate-900/95 px-2.5 py-1.5">
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
    </div>
  );
};

export default ChangeEvidenceView;