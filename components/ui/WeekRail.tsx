'use client';
// Right column: "Your week" (gold, the long-term goal) or "Tonight" (light blue).
import { useMemo } from 'react';
import { ArrowLeft, RotateCw } from 'lucide-react';
import { SAFETY_LINE, SAFETY_MOODS } from '@/lib/science';
import { currentPicks, useOrbit } from '@/lib/store';
import PickCard from './PickCard';
import { MOOD_META } from './util';

function SkeletonCard() {
  return (
    <li className="overflow-hidden rounded-2xl border border-white/10 bg-[rgba(12,19,34,0.9)]" aria-hidden>
      <div className="skeleton h-[120px]" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-5 w-2/5 rounded" />
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
      </div>
    </li>
  );
}

export default function WeekRail() {
  const mode = useOrbit((s) => s.mode);
  const mood = useOrbit((s) => s.mood);
  const phase = useOrbit((s) => s.phase);
  const goal = useOrbit((s) => s.goal);
  const stats = useOrbit((s) => s.stats);
  const profile = useOrbit((s) => s.profile);
  const events = useOrbit((s) => s.events);
  const friendCount = useOrbit((s) => s.friends.filter((f) => f.status === 'friend').length);
  const weekPicks = useOrbit((s) => s.weekPicks);
  const tonightPicks = useOrbit((s) => s.tonightPicks);
  const selectedEventId = useOrbit((s) => s.selectedEventId);
  const log = useOrbit((s) => s.log);
  const runWeek = useOrbit((s) => s.runWeek);
  const runTonight = useOrbit((s) => s.runTonight);
  const backToWeek = useOrbit((s) => s.backToWeek);

  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const tonight = mode === 'tonight';
  const picks = currentPicks({ mode, weekPicks, tonightPicks });
  const rows = picks.flatMap((p) => { const e = byId.get(p.eventId); return e ? [{ pick: p, event: e }] : []; });
  const thinking = phase === 'thinking';
  const expected = tonight ? 3 : 6;
  const skeletons = thinking ? Math.max(0, expected - rows.length) : 0;
  const idle = phase === 'idle' && !tonight && rows.length === 0;
  const total = stats?.total ?? events.length;

  if (idle) {
    return (
      <aside className="glass pointer-events-auto p-5">
        {total > 0 ? (
          <>
            <div className="text-[56px] font-semibold leading-none tracking-tight tabular-nums">{total.toLocaleString('en-US')}</div>
            <p className="mt-2 text-xl font-semibold leading-snug">events this week.</p>
            <p className="mt-1 text-base text-ink-dim">Tell Orbit where you&apos;re going.</p>
            {profile && (
              <p className="mt-4 border-t border-white/10 pt-3 text-sm text-ink-dim">
                Each one is checked against your {profile.courses.length} courses, {profile.clubs.length} clubs and {friendCount} friends.
              </p>
            )}
          </>
        ) : (
          <div className="space-y-3" aria-busy>
            <div className="skeleton h-14 w-28 rounded-lg" />
            <div className="skeleton h-5 w-3/4 rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
          </div>
        )}
      </aside>
    );
  }

  const Mood = tonight && mood ? MOOD_META[mood] : null;
  const showSafety = tonight && !thinking && rows.length > 0 && mood !== null && (SAFETY_MOODS as readonly string[]).includes(mood);
  const empty = !thinking && rows.length === 0;

  return (
    <aside className="glass pointer-events-auto flex max-h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-white/10 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2.5 text-2xl font-semibold leading-none tracking-tight">
            <span className={`h-2.5 w-2.5 rounded-full ${tonight ? 'bg-sky shadow-[0_0_12px_rgba(99,170,255,0.9)]' : 'bg-gold shadow-[0_0_12px_rgba(255,200,87,0.9)]'}`} />
            {tonight ? 'Tonight' : 'Your week'}
          </h2>
          {tonight ? (
            <button
              type="button"
              onClick={backToWeek}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 text-sm font-medium text-gold transition duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold active:opacity-70"
            >
              <ArrowLeft size={15} aria-hidden /> Back to my week
            </button>
          ) : (
            <span className="shrink-0 text-sm tabular-nums text-ink-dim">{thinking ? `${rows.length} of ${expected}` : `${rows.length} event${rows.length === 1 ? '' : 's'}`}</span>
          )}
        </div>
        {tonight ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-ink-dim">
            {Mood && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sky/40 bg-sky/10 px-2.5 py-0.5 text-sky"><Mood.Icon size={14} aria-hidden /> {Mood.label}</span>}
            <span className="truncate">Research-backed ideas for tonight</span>
          </div>
        ) : (
          <p className="mt-2 truncate text-sm text-ink-dim">Toward: <span className="text-gold">{goal}</span></p>
        )}
      </header>

      <div className="orbit-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {empty ? (
          <div className="px-1 py-6 text-center">
            <p className="text-base font-medium">Orbit could not finish this one.</p>
            <p className="mt-1 text-sm text-ink-dim">{log[log.length - 1] ?? 'Check your connection and try again.'}</p>
            <button
              type="button"
              onClick={() => { if (tonight && mood) void runTonight(mood); else void runWeek(goal); }}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-[15px] font-medium transition duration-150 hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95"
            >
              <RotateCw size={15} aria-hidden /> Try again
            </button>
          </div>
        ) : (
          <ol className="space-y-3">
            {rows.map(({ pick, event }, i) => (
              <PickCard key={`${mode}-${event.id}`} pick={pick} event={event} rank={i + 1} tonight={tonight} open={selectedEventId === event.id} />
            ))}
            {Array.from({ length: skeletons }, (_, i) => <SkeletonCard key={`sk-${i}`} />)}
          </ol>
        )}
        {showSafety && <p className="mt-3 px-1 pb-1 text-sm leading-snug text-ink-dim">{SAFETY_LINE}</p>}
      </div>
    </aside>
  );
}
