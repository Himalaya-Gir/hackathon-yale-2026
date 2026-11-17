'use client';
// Secondary mode: "What should I do tonight?" A small popover above the goal bar.
import { ArrowLeft } from 'lucide-react';
import { useOrbit } from '@/lib/store';
import { MOODS } from '@/lib/types';
import { MOOD_META } from './util';

export default function TonightPanel({ onClose }: { onClose: () => void }) {
  const mode = useOrbit((s) => s.mode);
  const mood = useOrbit((s) => s.mood);
  const runTonight = useOrbit((s) => s.runTonight);
  const backToWeek = useOrbit((s) => s.backToWeek);

  return (
    <div className="glass fade-up pointer-events-auto absolute inset-x-0 bottom-full mb-3 p-4 shadow-2xl" role="dialog" aria-label="Tonight">
      <div className="text-lg font-semibold">What should I do tonight?</div>
      <div className="mt-0.5 text-sm text-ink-dim">I feel…</div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {MOODS.map((m) => {
          const meta = MOOD_META[m];
          const active = mode === 'tonight' && mood === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => { onClose(); void runTonight(m); }}
              className={`flex h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl border text-sm transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky active:scale-95 ${active ? 'border-sky/70 bg-sky/15 text-sky' : 'border-white/10 bg-white/[0.03] text-ink hover:border-sky/60 hover:bg-sky/10 hover:text-sky active:bg-sky/20'}`}
            >
              <meta.Icon size={20} aria-hidden />
              {meta.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-ink-dim">
        <span>Three research-backed ideas, close to you.</span>
        {mode === 'tonight' && (
          <button
            type="button"
            onClick={() => { onClose(); backToWeek(); }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 text-gold transition duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold active:opacity-70"
          >
            <ArrowLeft size={14} aria-hidden /> Back to my week
          </button>
        )}
      </div>
    </div>
  );
}
