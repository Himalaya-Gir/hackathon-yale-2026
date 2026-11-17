'use client';
// The primary control: what are you building toward? Centered when idle, docked at the bottom after the first run.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight, ChevronUp, Mic, Moon, Target } from 'lucide-react';
import { useOrbit } from '@/lib/store';
import { PRESET_GOALS } from '@/lib/types';
import MissionLog from './MissionLog';
import TonightPanel from './TonightPanel';

type Recognition = {
  lang: string; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start(): void; stop(): void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { webkitSpeechRecognition?: RecognitionCtor; SpeechRecognition?: RecognitionCtor };
  return w.webkitSpeechRecognition ?? w.SpeechRecognition ?? null;
}
const noopSubscribe = () => () => {};

function GoalForm({ large, onSubmit, autoFocus }: { large: boolean; onSubmit: (goal: string) => void; autoFocus?: boolean }) {
  const goal = useOrbit((s) => s.goal);
  const locked = useOrbit((s) => s.phase === 'thinking');
  const [draft, setDraft] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const hasMic = useSyncExternalStore(noopSubscribe, () => recognitionCtor() !== null, () => false);
  const value = draft ?? goal;

  useEffect(() => () => { recRef.current?.stop(); }, []);

  function toggleMic() {
    if (listening) { recRef.current?.stop(); return; }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    try {
      const rec = new Ctor();
      rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const text = e.results[0]?.[0]?.transcript?.trim();
        if (text) setDraft(text.charAt(0).toUpperCase() + text.slice(1));
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch { setListening(false); }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); const t = value.trim(); if (t && !locked) { setDraft(null); onSubmit(t); } }}
      className="w-full"
    >
      <div className={`flex items-center gap-2 rounded-2xl border border-white/15 bg-[rgba(10,16,28,0.85)] pl-4 pr-2 transition duration-150 focus-within:border-gold/70 focus-within:shadow-[0_0_0_4px_rgba(255,200,87,0.12)] ${large ? 'h-16' : 'h-12'}`}>
        <Target size={large ? 22 : 18} className="shrink-0 text-gold" aria-hidden />
        <input
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          disabled={locked}
          autoFocus={autoFocus}
          maxLength={90}
          aria-label="What are you building toward?"
          placeholder="Break into the space industry"
          className={`min-w-0 flex-1 bg-transparent font-medium text-ink outline-none placeholder:text-ink-dim/60 disabled:opacity-60 ${large ? 'text-xl' : 'text-base'}`}
        />
        {hasMic && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={locked}
            aria-label={listening ? 'Stop listening' : 'Say your goal'}
            aria-pressed={listening}
            className={`grid shrink-0 place-items-center rounded-full transition duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky active:scale-90 disabled:opacity-40 ${large ? 'h-11 w-11' : 'h-9 w-9'} ${listening ? 'bg-sky/20 text-sky' : 'text-ink-dim hover:text-ink'}`}
          >
            <Mic size={large ? 20 : 18} className={listening ? 'animate-pulse' : ''} aria-hidden />
          </button>
        )}
        <button
          type="submit"
          disabled={locked || !value.trim()}
          aria-label="Show my week"
          className={`grid shrink-0 place-items-center rounded-xl bg-gold text-night transition duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95 active:brightness-90 disabled:opacity-40 ${large ? 'h-12 w-12' : 'h-9 w-9'}`}
        >
          <ArrowRight size={large ? 22 : 18} strokeWidth={2.5} aria-hidden />
        </button>
      </div>
      <div className={`flex flex-wrap gap-2 ${large ? 'mt-4 justify-center' : 'mt-3'}`}>
        {PRESET_GOALS.map((g) => {
          const active = g.label === goal;
          return (
            <button
              key={g.slug}
              type="button"
              disabled={locked}
              onClick={() => { setDraft(null); onSubmit(g.label); }}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold active:scale-95 disabled:opacity-40 ${active && !large ? 'border-gold/60 bg-gold/10 text-gold' : 'border-white/15 bg-[rgba(10,16,28,0.7)] text-ink hover:border-gold/70 hover:text-gold active:bg-gold/15'}`}
            >
              {g.label}
            </button>
          );
        })}
      </div>
    </form>
  );
}

export default function GoalBar() {
  const loaded = useOrbit((s) => s.loaded);
  const goal = useOrbit((s) => s.goal);
  const phase = useOrbit((s) => s.phase);
  const mode = useOrbit((s) => s.mode);
  const hasWeek = useOrbit((s) => s.weekPicks.length > 0);
  const runWeek = useOrbit((s) => s.runWeek);
  const [open, setOpen] = useState<null | 'goal' | 'tonight'>(null);

  const thinking = phase === 'thinking';
  const docked = phase !== 'idle' || hasWeek || mode === 'tonight';
  const shown = thinking ? null : open;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function submit(g: string) { setOpen(null); void runWeek(g); }

  if (!loaded) return null;

  return (
    <>
      {!docked && <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[760px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,rgba(7,11,20,0.82),rgba(7,11,20,0.5)_55%,transparent)]" />}
      {shown && <button type="button" aria-label="Close" tabIndex={-1} onClick={() => setOpen(null)} className="pointer-events-auto absolute inset-0 z-20 cursor-default" />}
      <div
        className="pointer-events-none absolute left-1/2 z-30 transition-[bottom,transform] duration-700 ease-out"
        style={{ width: 'min(560px, calc(100vw - 780px))', bottom: docked ? 16 : '50%', transform: `translate(-50%, ${docked ? '0%' : '50%'})` }}
      >
        {!docked ? (
          <div className="fade-up pointer-events-auto flex flex-col items-center text-center">
            <h1 className="text-balance text-[40px] font-semibold leading-[1.1] tracking-tight">What are you building toward?</h1>
            <p className="mb-6 mt-3 text-base text-ink-dim">Orbit reads every event at Yale this week and keeps the six that move you there.</p>
            <GoalForm large onSubmit={submit} />
          </div>
        ) : (
          <div className="relative">
            {thinking && <MissionLog />}
            {shown === 'goal' && (
              <div className="glass fade-up pointer-events-auto absolute inset-x-0 bottom-full mb-3 p-4 shadow-2xl">
                <div className="mb-3 text-lg font-semibold">What are you building toward?</div>
                <GoalForm large={false} onSubmit={submit} autoFocus />
              </div>
            )}
            {shown === 'tonight' && <TonightPanel onClose={() => setOpen(null)} />}
            <div className="glass slide-up pointer-events-auto flex h-16 items-center gap-1 p-2 shadow-2xl">
              <button
                type="button"
                disabled={thinking}
                onClick={() => setOpen(open === 'goal' ? null : 'goal')}
                aria-expanded={shown === 'goal'}
                className="group flex h-full min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-left transition duration-150 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold active:bg-white/10 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/15 text-gold ${thinking && mode === 'week' ? 'animate-pulse' : ''}`}>
                  <Target size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-4 text-ink-dim">Building toward</span>
                  <span className="block truncate text-base font-semibold leading-6">{goal}</span>
                </span>
                <ChevronUp size={18} aria-hidden className={`shrink-0 text-ink-dim transition duration-150 group-hover:text-ink group-disabled:opacity-0 ${shown === 'goal' ? 'rotate-180' : ''}`} />
              </button>
              <span aria-hidden className="mx-1 h-8 w-px shrink-0 bg-white/10" />
              <button
                type="button"
                disabled={thinking}
                onClick={() => setOpen(open === 'tonight' ? null : 'tonight')}
                aria-expanded={shown === 'tonight'}
                className={`inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border px-4 text-base font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky active:scale-95 disabled:opacity-50 ${mode === 'tonight' || shown === 'tonight' ? 'border-sky/60 bg-sky/15 text-sky' : 'border-white/10 text-ink hover:border-sky/60 hover:bg-sky/10 hover:text-sky'}`}
              >
                <Moon size={18} aria-hidden /> Tonight?
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
