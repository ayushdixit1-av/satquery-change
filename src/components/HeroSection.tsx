import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { SatQueryLogo } from './SatQueryLogo';

export interface HeroSectionProps {
  onStart: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onStart }) => {
  return (
    <section className="relative px-4 pt-5 lg:px-6 lg:pt-[clamp(0.5rem,1.8vh,1.5rem)]">
      <div className="grid items-center gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8">
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

          <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.03] tracking-tight sm:text-[2.5rem] lg:text-[clamp(2rem,4.4vh,3.25rem)]">
            <span className="sq-text-gradient">See Earth differently</span>
            <br />
            <span className="text-slate-100">with AI —</span>
          </h1>
          <h2 className="mt-1.5 text-[1.5rem] font-extrabold tracking-tight text-sky-300 sm:text-[2rem] lg:text-[clamp(1.35rem,3.2vh,2.6rem)]">
            Ask. Analyze. Discover.
          </h2>

          {/* Handwritten annotation */}
          <div className="relative mt-2 inline-block">
            <p className="sq-handwritten text-xl text-amber-300 lg:text-[clamp(1rem,2.3vh,1.6rem)]" style={{ transform: 'rotate(-2deg)' }}>
              yes — any two dates, any two images
            </p>
          </div>

          <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-slate-300 lg:text-[clamp(0.8125rem,1.55vh,0.9375rem)]">
            SatQuery turns satellite imagery into plain-language, evidence-backed answers. Compare a before/after pair,
            classify a single scene, or trace how coastlines, crops, water and cities change over time — entirely on your device.
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStart}
              className="group flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/30 transition-all hover:-translate-y-0.5 hover:bg-sky-400"
            >
              Start an Analysis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        {/* Visual */}
        <motion.div
          className="relative mx-auto flex w-full max-w-md items-center justify-center py-2"
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="earth-glow relative rounded-full">
            <SatQueryLogo className="h-52 w-52 sm:h-64 sm:w-64 lg:h-[clamp(10rem,26vh,15rem)] lg:w-[clamp(10rem,26vh,15rem)]" />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;