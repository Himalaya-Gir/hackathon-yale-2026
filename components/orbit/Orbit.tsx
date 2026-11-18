'use client';
// Orbit's interface, laid out like a car screen: you and your orbit on the left, the map in the middle,
// the controls sheet on the right, a dock at the bottom. Orbit speaks first: it reads your week and proposes.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Avatar, AvatarFallback } from '@/components/system/avatar';
import { TooltipProvider } from '@/components/system/tooltip';
import { useAutoStart } from '@/components/designs/useAutoStart';
import { MOOD_META, initialsOf } from '@/components/ui/util';
import { currentPicks, useOrbit } from '@/lib/store';
import { nyParts, now } from '@/lib/time';
import type { Pick as OrbitPick, YaleEvent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dock, StatusBar } from './Bars';
import InviteDialog from './InviteDialog';
import OrbitDiagram, { type Planet } from './OrbitDiagram';
import Sheet, { type Section } from './Sheet';
import { LABEL, RINGS, TONIGHT, WEEK, YALE, YALE_TINT, dayIndex, planetSize, ringOf, voiceLine } from './model';

const EASE = [0.2, 0.7, 0.2, 1] as const;

function greeting(): string {
  const h = nyParts(now()).hh;
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Orbit() {
  useAutoStart();
  const profile = useOrbit((s) => s.profile);
  const events = useOrbit((s) => s.events);
  const goal = useOrbit((s) => s.goal);
  const mode = useOrbit((s) => s.mode);
  const mood = useOrbit((s) => s.mood);
  const phase = useOrbit((s) => s.phase);
  const log = useOrbit((s) => s.log);
  const trajectory = useOrbit((s) => s.trajectory);
  const picks = useOrbit(currentPicks);
  const friends = useOrbit((s) => s.friends);
  const going = useOrbit((s) => s.going);
  const selected = useOrbit((s) => s.selectedEventId);
  const mapHover = useOrbit((s) => s.hoveredEventId);
  const { select, hover } = useOrbit.getState();

  const [localHover, setLocalHover] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('foryou');
  const [open, setOpen] = useState(true);

  const tonight = mode === 'tonight';
  const rings = RINGS[mode];
  const thinking = phase === 'thinking' || (phase === 'idle' && !picks.length);
  const runKey = `${mode}|${goal}|${mood ?? ''}`;
  const later = tonight && picks.some((pk) => { const ev = events.find((e) => e.id === pk.eventId); return !!ev && dayIndex(ev.start) > 1; });
  const ringLabel = (i: number) => (later && i === 1 ? 'NEXT 48 HOURS' : rings[i].label);

  const planets = useMemo<Planet[]>(() => {
    const list = picks
      .map((pick) => ({ pick, event: events.find((e) => e.id === pick.eventId) }))
      .filter((x): x is { pick: OrbitPick; event: YaleEvent } => !!x.event);
    const seen: Record<number, number> = {};
    const counts: Record<number, number> = {};
    for (const x of list) { const k = ringOf(x.event, mode); counts[k] = (counts[k] ?? 0) + 1; }
    const base = [-150, -35, 70];
    return list.map(({ pick, event }) => {
      const ring = ringOf(event, mode);
      const i = seen[ring] ?? 0;
      seen[ring] = i + 1;
      const n = Math.max(counts[ring] ?? 1, ring === 0 ? 3 : 4);
      return { pick, event, ring, angle: base[ring] + (i * 360) / n, size: Math.round(planetSize(pick.score) * 0.82) };
    });
  }, [picks, events, mode]);

  const ranked = useMemo(() => [...planets].sort((a, b) => b.pick.score - a.pick.score), [planets]);
  const top = ranked[0];

  // Orbit proposes: when a run completes, its best pick is the one on screen.
  const autoFor = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== 'done' || !top || autoFor.current === runKey) return;
    autoFor.current = runKey;
    if (!useOrbit.getState().selectedEventId) select(top.event.id);
  }, [phase, top, runKey, select]);

  // A click on a map marker selects an event: bring the sheet up on it.
  useEffect(() => useOrbit.subscribe((s, prev) => {
    if (s.selectedEventId && s.selectedEventId !== prev.selectedEventId) { setOpen(true); setSection('foryou'); }
  }), []);

  const lit = localHover ?? mapHover;
  const focused = planets.find((x) => x.event.id === selected) ?? top;
  const voiceFor = planets.find((x) => x.event.id === localHover) ?? focused;

  const voice = (() => {
    if (thinking && !planets.length) return tonight ? 'Let me look at what tonight holds for you.' : 'Give me a second. I am reading your week.';
    if (!voiceFor) return trajectory ?? 'A quiet week. I will keep watching.';
    const fr = friends.filter((f) => f.status === 'friend' && f.goingTo.includes(voiceFor.event.id));
    const contact = voiceFor.pick.withContactId ? profile?.contacts.find((c) => c.id === voiceFor.pick.withContactId) ?? null : null;
    return voiceLine(voiceFor.pick, voiceFor.event, fr, contact, voiceFor.ring, going.includes(voiceFor.event.id));
  })();
  const status = thinking ? log[log.length - 1] : null;

  function focus(id: string) { select(id); setOpen(true); setSection('foryou'); }
  function skip() {
    if (!focused || ranked.length < 2) return;
    const i = ranked.findIndex((p) => p.event.id === focused.event.id);
    select(ranked[(i + 1) % ranked.length].event.id);
  }
  function openSection(s: Section) {
    if (open && section === s) { setOpen(false); return; }
    setSection(s);
    setOpen(true);
  }

  const center = (
    <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
      <motion.div className="rounded-full" animate={{ boxShadow: ['0 0 0 6px rgba(40,109,192,.10)', '0 0 0 14px rgba(40,109,192,.06)', '0 0 0 6px rgba(40,109,192,.10)'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
        <Avatar className="size-[54px] shadow-[0_8px_20px_rgba(0,53,107,0.35)]" title={profile?.name}>
          <AvatarFallback className="text-[17px] font-bold text-white" style={{ background: `radial-gradient(circle at 35% 30%, ${YALE_TINT}, ${YALE} 75%)` }}>
            {profile ? initialsOf(profile.name) : ''}
          </AvatarFallback>
        </Avatar>
      </motion.div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div className="pointer-events-none absolute inset-0 z-10 select-none [--S:min(calc(100vh-340px),352px)]">
        <StatusBar />

        {/* Left column: you, your orbit, and Orbit talking to you */}
        <aside className="pointer-events-auto absolute bottom-[76px] left-0 top-0 flex w-[420px] flex-col bg-[#f4f4f4] px-8 pb-6 pt-16 shadow-[1px_0_0_rgba(23,26,32,0.06)]">
          <p suppressHydrationWarning className="text-[32px] font-semibold leading-none tracking-[-0.02em] text-foreground">
            {greeting()}, {profile ? profile.name.split(' ')[0] : ''}.
          </p>
          <p className="mt-2 flex items-center gap-2 text-[15px] font-medium text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: tonight ? TONIGHT : WEEK }} />
            {tonight && mood ? `Tonight · ${MOOD_META[mood].label}` : `${planets.length || 'Your'} ${planets.length ? 'picks this week' : 'week'}`}
          </p>

          <div className="flex flex-1 items-center justify-center">
            <OrbitDiagram mode={mode} goal={goal} planets={planets} friends={friends} going={going} selected={focused?.event.id ?? null} lit={lit}
              focusRing={focused ? focused.ring : null} thinking={thinking} runKey={runKey} ringLabel={ringLabel}
              onEnter={(id) => { setLocalHover(id); hover(id); }} onLeave={() => { setLocalHover(null); hover(null); }}
              onSelect={focus} onMission={() => openSection('mission')} center={center} />
          </div>

          <div className="min-h-[96px] rounded-2xl bg-white px-5 py-4 shadow-[0_4px_16px_rgba(23,26,32,0.06)]">
            <p className={cn(LABEL, 'text-[10px] text-muted-foreground')}>Orbit</p>
            <AnimatePresence mode="wait">
              <motion.p key={voice} className="mt-1.5 text-[16px] font-medium leading-[1.4] text-foreground"
                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.28, ease: EASE }}>
                {voice}
              </motion.p>
            </AnimatePresence>
            {status && <motion.p key={status} className={cn(LABEL, 'mt-2 truncate text-[10px] text-muted-foreground')} animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.2, repeat: Infinity }}>{status}</motion.p>}
          </div>
        </aside>

        {/* Right: the controls sheet over the map */}
        <AnimatePresence>
          {open && (
            <motion.div className="pointer-events-auto absolute bottom-[92px] right-4 top-14 w-[620px]"
              initial={{ opacity: 0, y: 16, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.985 }} transition={{ duration: 0.28, ease: EASE }}>
              <Sheet section={section} onSection={setSection} onClose={() => setOpen(false)} planets={planets} focused={focused}
                thinking={thinking} onFocus={focus} onSkip={skip} />
            </motion.div>
          )}
        </AnimatePresence>

        <Dock section={section} open={open} onSection={openSection} />
      </div>
      <InviteDialog />
    </TooltipProvider>
  );
}
