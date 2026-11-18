'use client';
// Onboarding (two screens over the dimmed map, then the existing goal question):
// 1. the problem and the NetID sign-in, 2. "Reading your Yale": each source checks in with its real count.
// Shown on every load for the demo; ?skip=1 hides it.
import { BookOpen, CalendarDays, Check, Mail, Sparkles, Users, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useOrbit } from '@/lib/store';

type Row = { icon: typeof BookOpen; name: string; detail: string };

// Counted on 2026-11-17 for the next 8 days: 212 events on events.yale.edu + 213 on Yale Connect's public feed.
const POSTED_THIS_WEEK = '400+';

export default function Onboarding() {
  const profile = useOrbit((s) => s.profile);
  const stats = useOrbit((s) => s.stats);
  const friends = useOrbit((s) => s.friends);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    try { if (new URLSearchParams(window.location.search).get('skip') === '1') setStep(2); } catch { /* no window */ }
  }, []);

  const rows: Row[] = useMemo(() => {
    const count = (name: string) => stats?.sources.find((s) => s.name === name)?.count ?? 0;
    const lists = profile?.connected.find((c) => c.name === 'Mailing lists')?.detail ?? 'Your college and club lists';
    return [
      { icon: BookOpen, name: 'Canvas', detail: `${profile?.courses.length ?? 0} courses and when they meet` },
      { icon: CalendarDays, name: 'Yale calendar', detail: `${count('yale-calendar')} events this week` },
      { icon: UsersRound, name: 'Yale Connect', detail: `${count('yaleconnect')} club events` },
      { icon: Mail, name: 'Mailing lists', detail: lists },
      { icon: Users, name: 'Friends', detail: `${friends.filter((f) => f.status === 'friend').length} friends already on Orbit` },
    ];
  }, [profile, stats, friends]);

  useEffect(() => {
    if (step !== 1) return;
    setShown(0);
    const id = setInterval(() => setShown((n) => (n >= rows.length ? n : n + 1)), 520);
    return () => clearInterval(id);
  }, [step, rows.length]);

  if (step === 2) return null;
  const done = shown >= rows.length;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[7000] grid place-items-center bg-[rgba(7,11,20,0.62)] backdrop-blur-[6px]">
      <div key={step} className="glass slide-up w-[min(560px,calc(100vw-32px))] px-10 py-9">
        <div className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-ink-dim">
          <Sparkles size={16} className="text-gold" aria-hidden /> Orbit <span className="font-normal normal-case tracking-normal">for Yale</span>
        </div>

        {step === 0 ? (
          <>
            <h1 className="text-[32px] font-semibold leading-[1.2]">
              Yale posts <span className="text-gold">{POSTED_THIS_WEEK} events</span> this week.
              <span className="block text-ink-dim">You will hear about almost none.</span>
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-dim">
              Orbit reads every one of them, checks them against your classes, and shows the few that move you toward what you are building, and the friends to go with.
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-8 flex h-12 w-full items-center justify-center rounded-xl bg-yale text-[16px] font-semibold text-white ring-1 ring-white/15 transition hover:brightness-125 active:scale-[0.99]"
            >
              Continue with Yale NetID
            </button>
            <p className="mt-3 text-center text-sm text-ink-dim">No install. No sign-up. Every student is already on it.</p>
          </>
        ) : (
          <>
            <h1 className="text-[30px] font-semibold leading-tight">{done ? 'Orbit knows your Yale.' : 'Reading your Yale…'}</h1>
            <ul className="mt-6 space-y-3">
              {rows.map((r, i) => {
                const on = i < shown;
                const Icon = r.icon;
                return (
                  <li key={r.name} className={`flex items-center gap-4 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 transition-all duration-300 ${on ? 'opacity-100' : 'translate-y-1 opacity-25'}`}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky/15 text-sky"><Icon size={18} aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-semibold leading-5">{r.name}</span>
                      <span className="block truncate text-sm text-ink-dim">{r.detail}</span>
                    </span>
                    <span className={`grid h-6 w-6 place-items-center rounded-full transition ${on ? 'bg-gold text-night' : 'bg-white/10 text-transparent'}`}><Check size={14} strokeWidth={3} aria-hidden /></span>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              disabled={!done}
              onClick={() => setStep(2)}
              className="mt-7 flex h-12 w-full items-center justify-center rounded-xl bg-gold text-[16px] font-semibold text-night transition hover:brightness-110 active:scale-[0.99] disabled:opacity-30"
            >
              Show me my week
            </button>
          </>
        )}
      </div>
    </div>
  );
}
