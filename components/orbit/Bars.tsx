'use client';
// The two bars of the screen: the thin status line on top, and the dock at the bottom (round buttons, mission arrows like the climate control).
import { ChevronLeft, ChevronRight, Moon, Rocket, Sparkles, UserRound, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/system/button';
import { useOrbit } from '@/lib/store';
import { fmtTime, now } from '@/lib/time';
import { PRESET_GOALS } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { Section } from './Sheet';
import { LABEL } from './model';

function useClock() {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setT(fmtTime(now().toISOString()));
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);
  return t;
}

export function StatusBar() {
  const profile = useOrbit((s) => s.profile);
  const sample = useOrbit((s) => s.events.some((e) => e.sample));
  const clock = useClock();
  return (
    <div className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex h-11 items-center justify-between px-6 text-[13px] font-semibold text-foreground">
      <div className="flex items-center gap-3">
        <span className="text-[15px] font-bold">Orbit</span>
        <span suppressHydrationWarning className="text-[13px] font-medium text-muted-foreground">{now().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' })}</span>
      </div>
      <div className="flex items-center gap-5">
        {sample && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[12px] font-medium text-muted-foreground">Sample data</span>}
        {profile && <span className="flex items-center gap-1.5"><UserRound className="size-4" /> {profile.name.split(' ')[0]}</span>}
        <span className="tabular-nums">{clock}</span>
      </div>
    </div>
  );
}

const SHORT: Record<string, string> = {
  'Break into the space industry': 'Space industry',
  'Start a company before I graduate': 'Start a company',
  'Find a research lab in AI': 'AI research lab',
  'Meet people outside my major': 'New people',
};

export function Dock({ section, open, onSection }: { section: Section; open: boolean; onSection(s: Section): void }) {
  const goal = useOrbit((s) => s.goal);
  const { runWeek, select } = useOrbit.getState();
  const idx = Math.max(0, PRESET_GOALS.findIndex((g) => g.label === goal));
  function step(d: number) {
    const g = PRESET_GOALS[(idx + d + PRESET_GOALS.length) % PRESET_GOALS.length];
    select(null);
    void runWeek(g.label);
    onSection('foryou');
  }
  const items: { id: Section; Icon: typeof Sparkles; label: string }[] = [
    { id: 'foryou', Icon: Sparkles, label: 'For you' },
    { id: 'tonight', Icon: Moon, label: 'Tonight' },
    { id: 'friends', Icon: Users, label: 'Friends' },
    { id: 'mission', Icon: Rocket, label: 'Mission' },
  ];
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex h-[76px] items-center justify-between bg-[#f4f4f4]/95 px-8 shadow-[0_-1px_0_rgba(23,26,32,0.06)] backdrop-blur">
      <div className="flex items-center gap-2">
        {items.map(({ id, Icon, label }) => (
          <Button key={id} variant="ghost" size="icon-lg" aria-label={label} title={label} onClick={() => onSection(id)}
            className={cn('size-12 rounded-full text-foreground/70 [&_svg]:size-[22px]', open && section === id && 'bg-white text-primary shadow-sm')}>
            <Icon />
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Previous mission" onClick={() => step(-1)} className="rounded-full text-foreground/60"><ChevronLeft /></Button>
        <button type="button" onClick={() => onSection('mission')} className="flex min-w-[210px] flex-col items-center leading-tight">
          <span className={cn(LABEL, 'text-[10px] text-muted-foreground')}>Mission</span>
          <span className="text-[19px] font-bold text-foreground">{SHORT[goal] ?? goal}</span>
        </button>
        <Button variant="ghost" size="icon" aria-label="Next mission" onClick={() => step(1)} className="rounded-full text-foreground/60"><ChevronRight /></Button>
      </div>

      <div className="w-[208px]" aria-hidden />
    </div>
  );
}
