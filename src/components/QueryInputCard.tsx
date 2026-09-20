import React, { useRef, useState } from 'react';
import { ImagePlus, Send, Sparkles, MapPin } from 'lucide-react';
import { CAPABILITY_TAGS } from '../data/mockData';

export interface QueryInputCardProps {
  onQuery: (query: string) => void;
  onAttachImages: () => void;
}

const QueryInputCard: React.FC<QueryInputCardProps> = ({ onQuery, onAttachImages }) => {
  const [value, setValue] = useState('');
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  const submit = (query?: string) => {
    const q = (query ?? value).trim();
    if (!q) return;
    onQuery(q);
    setValue('');
    if (areaRef.current) areaRef.current.style.height = 'auto';
  };

  const autoGrow = () => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <section className="px-4 pt-10 lg:px-6">
      <div className="glass-panel relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-indigo-400/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-500" />
            <h3 className="text-sm font-extrabold tracking-tight text-slate-900">
              Ask satellite anything
            </h3>
          </div>

          <textarea
            ref={areaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoGrow();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder='e.g. "Measure the urban sprawl between my two satellite images…"'
            className="glass-input mt-3 w-full resize-none rounded-2xl px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {CAPABILITY_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => submit(tag)}
                className="glass-pill rounded-full px-3 py-1.5 text-[11px] font-bold text-slate-700 transition-all hover:-translate-y-0.5 hover:bg-white"
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAttachImages}
                className="flex items-center gap-2 rounded-xl bg-indigo-500/10 px-3.5 py-2 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-500/20"
              >
                <ImagePlus className="h-4 w-4" />
                Attach T1 / T2 images
              </button>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-amber-500" />
                AOI bounds auto-located from your imagery
              </span>
            </div>

            <button
              type="button"
              onClick={() => submit()}
              disabled={!value.trim()}
              className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-sky-500/30 transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
              Analyze
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default QueryInputCard;