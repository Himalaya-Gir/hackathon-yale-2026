'use client';
import { useOrbit } from '@/lib/store';
import Avatar from './Avatar';
import { initialsOf } from './util';

export default function TopBar() {
  const name = useOrbit((s) => s.profile?.name) ?? 'Maya Chen';
  return (
    <header className="glass pointer-events-auto flex h-12 items-center justify-between gap-4 px-4">
      <div className="flex min-w-0 items-center gap-4">
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#00356B]">
          <span className="h-2 w-2 rounded-full bg-white" />
        </span>
        <span className="whitespace-nowrap text-base font-semibold tracking-tight">
          Orbit <span className="font-normal text-ink-dim">· for Yale</span>
        </span>
        <span className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border border-white/15 bg-[#00356B] px-4 text-sm font-medium text-white">
          Preview · sample data
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm">
        <span className="whitespace-nowrap">
          <span className="font-medium">{name}</span>
          <span className="text-ink-dim"> · Yale NetID</span>
        </span>
        <Avatar initials={initialsOf(name)} color="#EEF2F8" size={40} />
      </div>
    </header>
  );
}
