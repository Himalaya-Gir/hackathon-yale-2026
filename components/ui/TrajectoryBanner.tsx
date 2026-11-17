'use client';
// Top center, once the week trajectory arrives. Shell mounts this; the rail does not.
import { Route } from 'lucide-react';
import { useOrbit } from '@/lib/store';

export default function TrajectoryBanner() {
  const trajectory = useOrbit((s) => s.trajectory);
  const mode = useOrbit((s) => s.mode);
  if (!trajectory || mode !== 'week') return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-14 z-10 -translate-x-1/2" style={{ width: 'min(560px, calc(100vw - 780px))' }}>
      <div key={trajectory} className="glass slide-down pointer-events-auto flex items-start gap-3 px-4 py-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/15 text-gold"><Route size={16} aria-hidden /></span>
        <div className="min-w-0">
          <div className="text-sm font-semibold uppercase tracking-[0.08em] text-gold">Your trajectory</div>
          <p className="text-[15px] leading-snug">{trajectory}</p>
        </div>
      </div>
    </div>
  );
}

export { TrajectoryBanner };
