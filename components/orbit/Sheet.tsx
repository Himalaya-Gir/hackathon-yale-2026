'use client';
// The controls sheet, like the Tesla "Quick Controls" panel: a menu on the left, the section on the right.
import { Moon, Rocket, Sparkles, UserPlus, Users, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/system/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/system/toggle-group';
import { MOOD_META } from '@/components/ui/util';
import { useOrbit } from '@/lib/store';
import { fmtTime } from '@/lib/time';
import { MOODS, PRESET_GOALS } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { Planet } from './OrbitDiagram';
import Person from './Person';
import Proposal from './Proposal';
import { LABEL, RINGS, TONIGHT, WEEK } from './model';

export type Section = 'foryou' | 'tonight' | 'friends' | 'mission';

const MENU: { id: Section; label: string; Icon: typeof Sparkles }[] = [
  { id: 'foryou', label: 'For you', Icon: Sparkles },
  { id: 'tonight', label: 'Tonight', Icon: Moon },
  { id: 'friends', label: 'Friends', Icon: Users },
  { id: 'mission', label: 'Mission', Icon: Rocket },
];

function Heading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <p className="flex items-center gap-2 text-[14px] font-semibold text-foreground [&_svg]:size-4">{icon}{children}</p>;
}

type Props = {
  section: Section;
  onSection(s: Section): void;
  onClose(): void;
  planets: Planet[];
  focused: Planet | undefined;
  thinking: boolean;
  onFocus(id: string): void;
  onSkip(): void;
};

export default function Sheet({ section, onSection, onClose, planets, focused, thinking, onFocus, onSkip }: Props) {
  const mode = useOrbit((s) => s.mode);
  const mood = useOrbit((s) => s.mood);
  const goal = useOrbit((s) => s.goal);
  const friends = useOrbit((s) => s.friends);
  const events = useOrbit((s) => s.events);
  const { runWeek, runTonight, addFriend, select } = useOrbit.getState();
  const rings = RINGS[mode];
  const accent = mode === 'tonight' ? TONIGHT : WEEK;

  const ringPicker = planets.length > 0 && (
    <ToggleGroup type="single" value={focused ? String(focused.ring) : ''} spacing={0}
      onValueChange={(v) => { if (!v) return; const best = planets.filter((p) => p.ring === Number(v)).sort((a, b) => b.pick.score - a.pick.score)[0]; if (best) onFocus(best.event.id); }}
      className="w-full rounded-full bg-secondary p-1">
      {rings.map((r, i) => {
        const has = planets.some((p) => p.ring === i);
        return (
          <ToggleGroupItem key={r.label} value={String(i)} disabled={!has}
            className={cn(LABEL, 'h-9 flex-1 rounded-full text-[11px] text-muted-foreground data-[state=on]:bg-white data-[state=on]:text-foreground data-[state=on]:shadow-sm')}>
            {r.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );

  const others = focused ? planets.filter((p) => p.ring === focused.ring && p.event.id !== focused.event.id) : [];
  const strip = others.length > 0 && (
    <div className="flex gap-2">
      {others.map((p) => (
        <button key={p.event.id} type="button" onClick={() => onFocus(p.event.id)}
          className="group flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-secondary/70 p-1.5 pr-3 text-left transition hover:bg-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.event.photoUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">{p.event.title}</span>
            <span className="block text-[12px] text-muted-foreground">{fmtTime(p.event.start)}</span>
          </span>
        </button>
      ))}
    </div>
  );

  const proposal = thinking && !focused
    ? <div className="flex flex-col gap-3"><div className="h-[126px] animate-pulse rounded-xl bg-secondary" /><div className="h-4 w-3/4 animate-pulse rounded bg-secondary" /><div className="h-12 animate-pulse rounded-full bg-secondary" /></div>
    : focused ? <Proposal pick={focused.pick} event={focused.event} onSkip={onSkip} /> : null;

  return (
    <div className="flex h-full overflow-hidden rounded-2xl bg-card shadow-[0_20px_60px_rgba(23,26,32,0.18)] ring-1 ring-foreground/5">
      <nav className="flex w-[176px] shrink-0 flex-col gap-1 px-3 pb-3 pt-12">
        {MENU.map(({ id, label, Icon }) => (
          <Button key={id} variant="ghost" onClick={() => onSection(id)}
            className={cn('h-11 justify-start gap-3 rounded-xl px-3 text-[15px] font-medium text-muted-foreground [&_svg]:size-[18px]', section === id && 'bg-secondary font-semibold text-foreground')}>
            <Icon /> {label}
          </Button>
        ))}
      </nav>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="absolute left-2 top-2 z-10 rounded-full text-muted-foreground"><X /></Button>
        <div className="orbit-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6 pt-12 [@media(max-height:780px)]:gap-3 [@media(max-height:780px)]:pb-4">
          {section === 'foryou' && (
            <>
              <Heading icon={<Sparkles style={{ color: accent }} />}>{mode === 'tonight' ? `For tonight · ${mood ? MOOD_META[mood].label : ''}` : 'Orbit suggests'}</Heading>
              {ringPicker}
              {proposal}
              {strip}
            </>
          )}

          {section === 'tonight' && (
            <>
              <Heading icon={<Moon style={{ color: TONIGHT }} />}>How are you tonight?</Heading>
              <div className="grid grid-cols-4 gap-x-2 gap-y-4">
                {MOODS.map((m) => {
                  const { Icon, label } = MOOD_META[m];
                  const on = mode === 'tonight' && mood === m;
                  return (
                    <button key={m} type="button" onClick={() => { select(null); void runTonight(m); onSection('foryou'); }} className="group flex flex-col items-center gap-2">
                      <span className={cn('grid size-14 place-items-center rounded-full transition', on ? 'text-white' : 'bg-secondary text-foreground group-hover:bg-[#dfe0e3]')} style={on ? { background: TONIGHT } : undefined}>
                        <Icon className="size-5" />
                      </span>
                      <span className="text-[13px] font-medium text-foreground">{label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[15px] leading-relaxed text-muted-foreground">Tell me how you feel, and I will find one thing tonight that helps. Every suggestion is backed by research.</p>
            </>
          )}

          {section === 'friends' && (
            <>
              <Heading icon={<Users style={{ color: WEEK }} />}>Your people this week</Heading>
              <div className="flex flex-col gap-1">
                {friends.map((f) => {
                  const ev = events.find((e) => f.goingTo.includes(e.id));
                  return (
                    <div key={f.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-secondary/60">
                      <Person initials={f.initials} color={f.color} name={f.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">{f.name}</p>
                        <p className="truncate text-[13px] text-muted-foreground">{f.status === 'suggested' ? f.reason ?? `${f.college} · ${f.classYear}` : ev ? `Going to ${ev.title}` : `${f.college} · ${f.classYear}`}</p>
                      </div>
                      {f.status === 'suggested'
                        ? <Button size="sm" onClick={() => addFriend(f.id)} className="rounded-full px-4"><UserPlus /> Add</Button>
                        : ev && <Button size="sm" variant="secondary" onClick={() => { onFocus(ev.id); }} className="rounded-full px-4">See</Button>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {section === 'mission' && (
            <>
              <Heading icon={<Rocket style={{ color: WEEK }} />}>Your mission</Heading>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_GOALS.map((g) => {
                  const on = g.label === goal;
                  return (
                    <motion.button key={g.slug} type="button" whileTap={{ scale: 0.97 }}
                      onClick={() => { if (!on) { select(null); void runWeek(g.label); } onSection('foryou'); }}
                      className={cn('flex min-h-[88px] flex-col justify-end rounded-xl p-4 text-left text-[16px] font-semibold leading-snug transition', on ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-[#dfe0e3]')}>
                      {g.label}
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-[15px] leading-relaxed text-muted-foreground">Everything Orbit proposes is chosen to move you toward this.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
