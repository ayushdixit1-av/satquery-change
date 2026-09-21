import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Play } from 'lucide-react';
import { SatQueryLogo } from './SatQueryLogo';

export interface HeroSectionProps {
  onStart: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onStart }) => {
  return (
    <section className="relative px-4 pt-8 lg:px-6 lg:pt-10">
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Copy */}
        <div className="relative z-10">
          <div className="glass-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="sq-live-dot relative inline-flex h-2 w-2 rounded-full bg-emerald-500 text-emerald-500" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">
              Live Earth View · NOMINAL
            </span>
          </div>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl xl:text-6xl">
            <span className="sq-text-gradient">See Earth differently</span>
            <br />
            <span className="text-slate-100">with AI —</span>
          </h1>
          <h2 className="mt-2 text-4xl font-extrabold tracking-tight text-sky-300 sm:text-5xl xl:text-6xl">
            Ask. Analyze. Discover.
          </h2>

          {/* Handwritten annotation + curved dashed arrow */}
          <div className="relative mt-3 inline-block">
            <p className="sq-handwritten text-2xl text-amber-300 sm:text-3xl" style={{ transform: 'rotate(-2deg)' }}>
              yes — any two dates, any two images
            </p>
            <svg
              className="pointer-events-none absolute -right-8 -top-3 hidden h-14 w-28 sm:block"
              viewBox="0 0 120 60"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 52 C 30 44, 58 40, 90 16 S 112 4, 116 6"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="5 6"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-slate-300">
            SatQuery turns satellite imagery into plain-language, evidence-backed answers. Compare a before/after pair,
            classify a single scene, or trace how coastlines, crops, water and cities change over time — entirely on your device.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStart}
              className="group flex items-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/30 transition-all hover:-translate-y-0.5 hover:bg-sky-400"
            >
              Start an Analysis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              type="button"
              onClick={onStart}
              className="glass-pill flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-slate-800 transition-all hover:-translate-y-0.5 hover:bg-white"
            >
              <Play className="h-4 w-4 text-sky-600" />
              Explore Live Demo
            </button>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" /> 100% on-device inference
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Evidence contours on every answer
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" /> Precision / Recall / IoU audited
            </span>
          </div>
        </div>

        {/* Visual */}
        <motion.div
          className="relative mx-auto flex w-full max-w-md items-center justify-center py-4"
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="earth-glow relative rounded-full">
            <SatQueryLogo className="h-64 w-64 sm:h-80 sm:w-80" />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;