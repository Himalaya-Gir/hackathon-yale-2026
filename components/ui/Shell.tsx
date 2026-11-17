'use client';
// TEMPORARY (package 0). Package D replaces this with the real interface (PLAN.md §9, package D).
// It only proves the contract end to end: goal → 6 picks, Tonight + mood → 3 picks.
import { useOrbit, currentPicks } from '@/lib/store';
import { MECHANISM_BY_ID } from '@/lib/science';
import { fmtWhen } from '@/lib/time';
import { MOODS, PRESET_GOALS } from '@/lib/types';

export default function Shell() {
  const s = useOrbit();
  const picks = currentPicks(s);
  const byId = Object.fromEntries(s.events.map((e) => [e.id, e]));

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <header className="pointer-events-auto flex items-center justify-between px-5 py-3 text-sm">
        <div className="font-semibold tracking-tight">Orbit <span className="text-ink-dim">· for Yale</span>
          <span className="ml-3 rounded-full border border-white/10 px-2 py-0.5 text-xs text-ink-dim">Preview · sample data</span>
        </div>
        <div className="text-ink-dim">{s.profile ? `${s.profile.name} · Yale NetID` : ''}</div>
      </header>

      <main className="flex min-h-0 flex-1 gap-4 px-5 pb-5">
        <section className="glass pointer-events-auto w-[420px] shrink-0 overflow-y-auto p-5">
          <h1 className="text-2xl font-semibold">What are you building toward?</h1>
          <div className="mt-4 flex flex-col gap-2">
            {PRESET_GOALS.map((g) => (
              <button key={g.slug} disabled={s.phase === 'thinking'} onClick={() => s.runWeek(g.label)}
                className="rounded-xl border border-white/10 px-4 py-2 text-left hover:border-gold hover:text-gold disabled:opacity-40">
                {g.label}
              </button>
            ))}
          </div>
          <h2 className="mt-6 text-lg font-semibold">Tonight? I feel…</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button key={m} disabled={s.phase === 'thinking'} onClick={() => s.runTonight(m)}
                className="rounded-full border border-white/10 px-3 py-1.5 capitalize hover:border-sky hover:text-sky disabled:opacity-40">
                {m}
              </button>
            ))}
          </div>
          <ul className="mt-6 space-y-1 text-sm text-ink-dim">{s.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </section>

        <section className="glass pointer-events-auto ml-auto w-[420px] shrink-0 overflow-y-auto p-5">
          <h2 className="text-xl font-semibold">{s.mode === 'week' ? 'Your week' : 'Tonight'}</h2>
          <p className="text-sm text-ink-dim">{s.mode === 'week' ? s.goal : `feeling ${s.mood}`} · {s.phase}{s.lastSource ? ` · ${s.lastSource}` : ''}</p>
          {s.trajectory && s.mode === 'week' && <p className="mt-3 text-sm text-gold">{s.trajectory}</p>}
          <ol className="mt-4 space-y-3">
            {picks.map((p, i) => {
              const e = byId[p.eventId];
              if (!e) return null;
              const mech = p.mechanismId ? MECHANISM_BY_ID[p.mechanismId] : null;
              return (
                <li key={p.eventId} className="overflow-hidden rounded-xl border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.photoUrl} alt="" width={1200} height={675} className="h-28 w-full object-cover" />
                  <div className="p-3">
                    <div className={`text-xs font-semibold ${p.lane === 'build' ? 'text-gold' : 'text-sky'}`}>{i + 1} · {fmtWhen(e.start)}</div>
                    <div className="font-semibold">{e.title}</div>
                    <div className="text-sm text-ink-dim">{e.locationName}</div>
                    <div className="mt-1 text-sm">{p.why}</div>
                    {mech && <div className="mt-1 text-sm italic text-ink-dim">{mech.line} {mech.citation}</div>}
                    <div className="mt-1 text-sm text-ink-dim">{p.fitNote}{p.friendLine ? ` · ${p.friendLine}` : ''}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </div>
  );
}
