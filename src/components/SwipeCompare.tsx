import React, { useCallback, useRef, useState } from 'react';

export interface SwipeCompareProps {
  t1: string;
  t2: string;
  className?: string;
  label1?: string;
  label2?: string;
}

/**
 * Interactive 0–100% split-screen swipe comparison.
 * Drag anywhere on the image or use the slider beneath.
 */
const SwipeCompare: React.FC<SwipeCompareProps> = ({
  t1,
  t2,
  className = '',
  label1 = 'T1 Baseline',
  label2 = 'T2 Observation',
}) => {
  const [pos, setPos] = useState(50);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) updateFromClientX(e.clientX);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div className={className}>
      <div
        ref={boxRef}
        className="relative aspect-[16/10] w-full select-none overflow-hidden rounded-2xl ring-1 ring-slate-800/40"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ touchAction: 'none', cursor: 'ew-resize' }}
      >
        {/* T2 base */}
        <img src={t2} alt={label2} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        {/* T1 clipped overlay */}
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <img src={t1} alt={label1} className="h-full w-full object-cover" draggable={false} />
        </div>

        {/* Divider */}
        <div
          className="absolute inset-y-0 w-[3px] bg-white shadow-[0_0_16px_rgba(56,189,248,0.9)]"
          style={{ left: `calc(${pos}% - 1.5px)` }}
        >
          <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg ring-4 ring-white/40">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 7l-5 5 5 5" />
              <path d="M16 7l5 5-5 5" />
            </svg>
          </span>
        </div>

        <span className="glass-pill absolute left-2 top-2 rounded-lg px-2 py-0.5 text-[10px] font-bold text-slate-800">
          {label1}
        </span>
        <span className="glass-pill absolute right-2 top-2 rounded-lg px-2 py-0.5 text-[10px] font-bold text-slate-800">
          {label2}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3 px-1">
        <span className="text-[10px] font-bold text-slate-500">{label1}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="sq-slider w-full"
          style={{ ['--fill' as string]: `${pos}%` }}
          aria-label="Comparison slider position"
        />
        <span className="text-[10px] font-bold text-slate-500">{label2}</span>
      </div>
    </div>
  );
};

export default SwipeCompare;