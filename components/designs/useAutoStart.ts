'use client';
// Shared by the three design proposals: load data, then Orbit proposes on its own (no input needed).
import { useEffect, useRef } from 'react';
import { useOrbit } from '@/lib/store';

export function useAutoStart(delayMs = 900) {
  const load = useOrbit((s) => s.load);
  const loaded = useOrbit((s) => s.loaded);
  const started = useRef(false);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!loaded || started.current) return;
    started.current = true;
    const t = setTimeout(() => {
      const s = useOrbit.getState();
      if (s.phase === 'idle') void s.runWeek(s.profile?.defaultGoal ?? s.goal);
    }, delayMs);
    return () => clearTimeout(t);
  }, [loaded, delayMs]);
}
