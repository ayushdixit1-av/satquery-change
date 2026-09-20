import React, { useState } from 'react';
import {
  PlugZap,
  Layers,
  CloudSun,
  Boxes,
  Map,
  Trash2,
  RotateCcw,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import type { SatQuerySettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { GEMINI_MODELS, usageToday } from '../lib/gemini';

export interface SettingsViewProps {
  settings: SatQuerySettings;
  onChange: (patch: Partial<SatQuerySettings>) => void;
}

const CONSTELLATIONS = ['Sentinel-2', 'Landsat 8/9', 'PlanetScope', 'MODIS'];
const CLOUD_TOLERANCE = [5, 10, 20, 50];
const INDICES = ['NDVI', 'NDWI', 'NDBI', 'EVI'];
const CRS_OPTIONS = ['EPSG:4326', 'MGRS', 'UTM', 'DMS'];

const SettingsView: React.FC<SettingsViewProps> = ({ settings, onChange }) => {
  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

  const testConnection = async () => {
    setTestState('testing');
    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(6000) });
      setTestState(res.ok ? 'ok' : 'fail');
    } catch {
      setTestState('fail');
    }
  };

  const purge = () => {
    localStorage.removeItem('satquery.analyses');
    localStorage.removeItem('satquery.settings');
    window.location.reload();
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6 lg:px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-400">Preferences</p>
      <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-100">Settings</h2>

      <div className="mt-6 space-y-4">
        {/* Model backend */}
        <section className="glass-panel rounded-3xl p-5">
          <div className="flex items-center gap-2">
            <PlugZap className="h-4 w-4 text-sky-500" />
            <h3 className="text-sm font-extrabold text-slate-900">Model backend</h3>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {(
              [
                { value: 'local', label: 'On-device engine', desc: 'Client-side canvas inference. Private, offline, instant.' },
                { value: 'live', label: 'Live model API', desc: 'POST /analyze to your PyTorch FastAPI/Flask backend.' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ apiMode: opt.value })}
                className={[
                  'rounded-2xl border-2 p-3 text-left transition-colors',
                  settings.apiMode === opt.value
                    ? 'border-sky-400 bg-sky-50'
                    : 'border-slate-200 bg-white/60 hover:border-slate-300',
                ].join(' ')}
              >
                <p className="text-xs font-extrabold text-slate-800">{opt.label}</p>
                <p className="mt-0.5 text-[10px] font-medium leading-snug text-slate-500">{opt.desc}</p>
              </button>
            ))}
          </div>

          {settings.apiMode === 'live' && (
            <div className="mt-4 rounded-2xl bg-white/70 p-3 ring-1 ring-slate-200/80">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">API endpoint</label>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={apiUrl}
                  onChange={(e) => {
                    setApiUrl(e.target.value);
                    onChange({ apiUrl: e.target.value });
                  }}
                  placeholder="http://localhost:7860"
                  className="glass-input min-w-0 flex-1 rounded-xl px-3 py-2 text-xs font-medium outline-none"
                />
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={testState === 'testing'}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-[11px] font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                >
                  {testState === 'testing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                  Test
                </button>
              </div>
              {testState === 'ok' && (
                <p className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> /health responded — live model reachable.
                </p>
              )}
              {testState === 'fail' && (
                <p className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-red-500">
                  <XCircle className="h-3 w-3" /> Could not reach the endpoint. Falling back to on-device engine.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Gemini boost */}
        <section className="glass-panel rounded-3xl p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-extrabold text-slate-900">Gemini boost</h3>
            <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600">
              minimal usage
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {(
              [
                { value: 'off', label: 'Off', desc: 'Heuristic engine only. Zero API calls.' },
                { value: 'auto', label: 'Auto (recommended)', desc: 'Only semantic questions, cached, capped.' },
                { value: 'always', label: 'Always', desc: 'Enhance every answer. Watch your cap.' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ geminiMode: opt.value })}
                className={[
                  'rounded-2xl border-2 p-3 text-left transition-colors',
                  settings.geminiMode === opt.value ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white/60 hover:border-slate-300',
                ].join(' ')}
              >
                <p className="text-xs font-extrabold text-slate-800">{opt.label}</p>
                <p className="mt-0.5 text-[10px] font-medium leading-snug text-slate-500">{opt.desc}</p>
              </button>
            ))}
          </div>

          {settings.geminiMode !== 'off' && (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-slate-200/80">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">API key</label>
                <input
                  type="password"
                  value={settings.geminiKey}
                  onChange={(e) => onChange({ geminiKey: e.target.value.trim() })}
                  placeholder="AIza… or AQ.…  (saved only in this browser)"
                  className="glass-input mt-1.5 w-full rounded-xl px-3 py-2 text-xs font-medium outline-none"
                />
                <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                  <KeyRound className="h-3 w-3" /> Optional when a Live model API backend is set — the server reads{' '}
                  <code className="rounded bg-slate-100 px-1">GEMINI_API_KEY</code> from its environment / .env. Without a
                  backend, the key is used directly from this browser and saved only here (never in the repo).
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-slate-200/80">
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Model</label>
                  <select
                    value={settings.geminiModel}
                    onChange={(e) => onChange({ geminiModel: e.target.value })}
                    className="glass-input w-full rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
                  >
                    {GEMINI_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-slate-200/80">
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Daily cap (calls)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={settings.geminiDailyCap}
                    onChange={(e) => onChange({ geminiDailyCap: Math.max(1, Math.min(100, Number(e.target.value) || 20)) })}
                    className="glass-input w-full rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 outline-none"
                  />
                  <p className="mt-1.5 text-[10px] font-semibold text-slate-400">
                    Used today: <span className="font-extrabold text-amber-600">{usageToday()}</span> / {settings.geminiDailyCap} — resets
                    at midnight.
                  </p>
                </div>
              </div>

              <p className="text-[10px] font-medium leading-relaxed text-slate-500">
                How it stays cheap: local pixel analysis always runs first and instantly. Gemini is called once per
                analysis, only for questions that need language (never for numbers), on a single downscaled image, and
                every result is cached locally — repeating an analysis costs zero calls.
              </p>
            </div>
          )}
        </section>

        {/* Acquisition */}
        <section className="glass-panel rounded-3xl p-5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-extrabold text-slate-900">Acquisition defaults</h3>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Layers className="h-3 w-3" /> Constellation
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CONSTELLATIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange({ constellation: c })}
                    className={[
                      'rounded-full px-3 py-1.5 text-[11px] font-bold transition-all',
                      settings.constellation === c ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' : 'glass-pill text-slate-600',
                    ].join(' ')}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <CloudSun className="h-3 w-3" /> Max cloud tolerance
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CLOUD_TOLERANCE.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange({ cloudTolerance: t })}
                    className={[
                      'rounded-full px-3 py-1.5 text-[11px] font-bold transition-all',
                      settings.cloudTolerance === t ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30' : 'glass-pill text-slate-600',
                    ].join(' ')}
                  >
                    &lt;{t}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Boxes className="h-3 w-3" /> Spectral indices
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {INDICES.map((idx) => {
                const on = settings.indices.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      onChange({ indices: on ? settings.indices.filter((i) => i !== idx) : [...settings.indices, idx] })
                    }
                    className={[
                      'rounded-full px-3 py-1.5 text-[11px] font-bold transition-all',
                      on ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'glass-pill text-slate-600',
                    ].join(' ')}
                  >
                    {idx}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Map className="h-3 w-3" /> Output coordinate reference system
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {CRS_OPTIONS.map((crs) => (
                <button
                  key={crs}
                  type="button"
                  onClick={() => onChange({ crs })}
                  className={[
                    'rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all',
                    settings.crs === crs ? 'bg-amber-500 text-white' : 'glass-pill text-slate-600',
                  ].join(' ')}
                >
                  {crs}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Data */}
        <section className="glass-panel rounded-3xl p-5">
          <h3 className="text-sm font-extrabold text-slate-900">Local data</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={purge}
              className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3.5 py-2 text-[11px] font-bold text-red-600 transition-colors hover:bg-red-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear previous scan storage
            </button>
            <button
              type="button"
              onClick={() =>
              onChange({
                ...DEFAULT_SETTINGS,
                geminiKey: settings.geminiKey,
                geminiModel: settings.geminiModel,
                geminiMode: settings.geminiMode,
                geminiDailyCap: settings.geminiDailyCap,
              })
            }
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-[11px] font-bold text-white transition-colors hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restore defaults
            </button>
            <span className="text-[10px] font-semibold text-slate-400">
              Scans are session-only — nothing is stored or uploaded after you leave.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsView;