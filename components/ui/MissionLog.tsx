'use client';
// While Orbit is thinking: the last three status lines, the newest one bright.
import { useOrbit } from '@/lib/store';

export default function MissionLog() {
  const log = useOrbit((s) => s.log);
  const mode = useOrbit((s) => s.mode);
  const lines = log.slice(-3);
  const shown = lines.length ? lines : ['Initializing events…'];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-full mb-3 flex flex-col items-center gap-1" role="status" aria-live="polite">
      {shown.map((line, i) => {
        const last = i === shown.length - 1;
        return (
          <div
            key={`${log.length - shown.length + i}-${line}`}
            className={`fade-up flex max-w-full items-center gap-2 rounded-full bg-[rgba(7,11,20,0.78)] px-3.5 py-1 font-mono text-sm backdrop-blur ${last ? 'text-ink' : 'text-ink-dim/70'}`}
          >
            {last && <span className={`h-1.5 w-1.5 shrink-0 animate-pulse rounded-full ${mode === 'week' ? 'bg-gold' : 'bg-sky'}`} />}
            <span className="truncate">{line}</span>
          </div>
        );
      })}
    </div>
  );
}
