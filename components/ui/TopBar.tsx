'use client';
import { useOrbit } from '@/lib/store';
import Avatar from './Avatar';
import { initialsOf } from './util';

export default function TopBar() {
  const profile = useOrbit((s) => s.profile);
  return (
    <header className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex h-12 items-center justify-between bg-gradient-to-b from-[rgba(7,11,20,0.92)] to-transparent px-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className="relative grid h-6 w-6 place-items-center">
          <span className="absolute inset-0 rounded-full border border-white/40" />
          <span className="h-2 w-2 rounded-full bg-ink" />
          <span className="absolute -right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-sky" />
        </span>
        <span className="text-base font-semibold tracking-tight">
          Orbit <span className="font-normal text-ink-dim">· for Yale</span>
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-sm text-ink-dim">Preview · sample data</span>
      </div>
      {profile && (
        <div className="flex items-center gap-2.5 text-sm">
          <span>
            <span className="font-medium">{profile.name}</span>
            <span className="text-ink-dim"> · Yale NetID</span>
          </span>
          <Avatar initials={initialsOf(profile.name)} color="#EEF2F8" size={28} />
        </div>
      )}
    </header>
  );
}
