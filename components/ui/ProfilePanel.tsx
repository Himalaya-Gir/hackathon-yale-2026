'use client';
import { useOrbit } from '@/lib/store';
import { now } from '@/lib/time';
import Avatar from './Avatar';
import FriendsRows from './FriendsRows';
import { initialsOf, nextMeeting } from './util';

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h3 className="text-base font-semibold leading-5">{children}</h3>
      {aside ? <span className="shrink-0 text-sm text-ink-dim">{aside}</span> : null}
    </div>
  );
}

export default function ProfilePanel() {
  const profile = useOrbit((s) => s.profile);

  if (!profile) {
    return (
      <aside className="glass pointer-events-auto flex min-h-0 flex-1 flex-col gap-4 p-4" aria-busy aria-label="Profile">
        <div className="flex items-center gap-4">
          <div className="skeleton h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton h-4 w-1/2 rounded" />
          </div>
        </div>
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-8 rounded-lg" />)}
      </aside>
    );
  }

  const ref = now();

  return (
    <aside aria-label="Profile" className="glass orbit-scroll pointer-events-auto min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
      <div className="flex items-center gap-4">
        <Avatar initials={initialsOf(profile.name)} color="#EEF2F8" size={48} />
        <div className="min-w-0">
          <div className="text-xl font-semibold leading-6">{profile.name}</div>
          <div className="mt-1 text-sm leading-5 text-ink-dim">{profile.classYear} · {profile.college}</div>
        </div>
      </div>
      <p className="mt-2 text-sm leading-5">{profile.majors.join(' + ')}</p>

      {profile.connected.length > 0 && (
        <section className="mt-4">
          <SectionTitle>Connected</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {profile.connected.map((c) => (
              <span key={c.name} className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-[#00356B] px-2 py-1 text-sm text-white">
                <span className="h-2 w-2 shrink-0 rounded-full bg-white" />
                {c.name}
                <span className="text-white/80">· {c.detail}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {profile.courses.length > 0 && (
        <section className="mt-4">
          <SectionTitle aside="Next class">Courses</SectionTitle>
          <ul className="divide-y divide-white/[0.08]">
            {profile.courses.map((c) => {
              const next = nextMeeting(c, ref);
              return (
                <li key={c.code} title={c.title} className="py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold leading-5">{c.code}</span>
                    <span className="shrink-0 text-sm leading-5 tabular-nums">{next ?? '—'}</span>
                  </div>
                  <p className="text-sm leading-5 text-ink-dim">{c.professor}</p>
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
