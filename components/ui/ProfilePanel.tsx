'use client';
import { useOrbit } from '@/lib/store';
import { now } from '@/lib/time';
import Avatar from './Avatar';
import FriendsRows from './FriendsRows';
import { initialsOf, nextMeeting } from './util';

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-dim">{children}</h3>
      {aside ? <span className="text-sm text-ink-dim">{aside}</span> : null}
    </div>
  );
}

export default function ProfilePanel() {
  const profile = useOrbit((s) => s.profile);

  if (!profile) {
    return (
      <aside className="glass pointer-events-auto flex h-full flex-col gap-4 p-4" aria-busy>
        <div className="flex items-center gap-3">
          <div className="skeleton h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton h-4 w-1/2 rounded" />
          </div>
        </div>
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
      </aside>
    );
  }

  const ref = now();
  const summary = profile.connected.slice(0, 3).map((c) => c.detail).join(' · ');

  return (
    <aside className="glass orbit-scroll pointer-events-auto h-full overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <Avatar initials={initialsOf(profile.name)} color="#EEF2F8" size={48} />
        <div className="min-w-0">
          <div className="truncate text-xl font-semibold leading-tight">{profile.name}</div>
          <div className="truncate text-sm text-ink-dim">{profile.classYear} · {profile.college}</div>
        </div>
      </div>
      <div className="mt-2 text-sm">{profile.majors.join(' + ')}</div>

      {profile.connected.length > 0 && (
        <section className="mt-5">
          <SectionTitle>Connected</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {profile.connected.map((c) => (
              <span key={c.name} title={`${c.name} · ${c.detail}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {c.name}
              </span>
            ))}
          </div>
          {summary && <p className="mt-2 text-sm text-ink-dim">{summary}</p>}
        </section>
      )}

      {profile.courses.length > 0 && (
        <section className="mt-5">
          <SectionTitle aside="Next class">Courses</SectionTitle>
          <ul className="divide-y divide-white/5">
            {profile.courses.map((c) => {
              const next = nextMeeting(c, ref);
              return (
                <li key={c.code} title={c.title} className="py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{c.code}</span>
                    <span className="shrink-0 text-sm tabular-nums text-ink">{next ?? '—'}</span>
                  </div>
                  <div className="truncate text-sm text-ink-dim">{c.professor}</div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <FriendsRows />
    </aside>
  );
}
