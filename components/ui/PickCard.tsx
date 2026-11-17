'use client';
import { useEffect, useRef } from 'react';
import { CalendarPlus, Check, ChevronDown, ExternalLink, MapPin, Send, Sparkles, Target } from 'lucide-react';
import { calendarLink } from '@/lib/links';
import { MECHANISM_BY_ID } from '@/lib/science';
import { useOrbit } from '@/lib/store';
import { fmtDay, fmtTime } from '@/lib/time';
import type { Pick as OrbitPick, YaleEvent } from '@/lib/types';
import Avatar, { AvatarStack } from './Avatar';
import { TRACK_META, colorFor, firstName, goingSentence, initialsOf, useUi } from './util';

const ACCENT = {
  gold: { text: 'text-gold', badge: 'bg-gold text-night', border: 'border-gold/60', glow: 'shadow-[0_0_0_1px_rgba(255,200,87,0.35),0_12px_32px_rgba(0,0,0,0.45)]', solid: 'bg-gold text-night hover:brightness-110 active:brightness-90', done: 'border-gold/50 bg-gold/10 text-gold hover:bg-gold/20', ring: 'focus-visible:ring-gold' },
  sky: { text: 'text-sky', badge: 'bg-sky text-night', border: 'border-sky/60', glow: 'shadow-[0_0_0_1px_rgba(99,170,255,0.35),0_12px_32px_rgba(0,0,0,0.45)]', solid: 'bg-sky text-night hover:brightness-110 active:brightness-90', done: 'border-sky/50 bg-sky/10 text-sky hover:bg-sky/20', ring: 'focus-visible:ring-sky' },
} as const;

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-dim">{label}</div>
      <div className="mt-0.5 text-[15px] leading-snug">{children}</div>
    </div>
  );
}

type Props = { pick: OrbitPick; event: YaleEvent; rank: number; tonight: boolean; open: boolean };

export default function PickCard({ pick, event, rank, tonight, open }: Props) {
  const friends = useOrbit((s) => s.friends);
  const going = useOrbit((s) => s.going.includes(event.id));
  const hovered = useOrbit((s) => s.hoveredEventId === event.id);
  const profile = useOrbit((s) => s.profile);
  const select = useOrbit((s) => s.select);
  const hover = useOrbit((s) => s.hover);
  const toggleGoing = useOrbit((s) => s.toggleGoing);
  const sentTo = useUi((s) => s.sent[event.id]);
  const openInvite = useUi((s) => s.openInvite);
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
    return () => window.clearTimeout(t);
  }, [open]);

  const a = ACCENT[tonight ? 'sky' : 'gold'];
  const friendsHere = friends.filter((f) => f.status === 'friend' && f.goingTo.includes(event.id));
  const people = [
    ...(going && profile ? [{ key: 'me', initials: initialsOf(profile.name), color: '#EEF2F8', name: 'You' }] : []),
    ...friendsHere.map((f) => ({ key: f.id, initials: f.initials, color: f.color, name: f.name })),
  ];
  const sentence = goingSentence(friendsHere.map((f) => firstName(f.name)), going);
  const contact = pick.withContactId ? profile?.contacts.find((c) => c.id === pick.withContactId) ?? null : null;
  const mech = tonight && pick.mechanismId ? MECHANISM_BY_ID[pick.mechanismId] ?? null : null;
  const track = event.tracks.map((t) => TRACK_META[t]).find(Boolean) ?? null;
  const goingLabel = going ? "You're going" : friendsHere.length ? 'Join them' : "I'm going";

  return (
    <li
      ref={ref}
      onMouseEnter={() => hover(event.id)}
      onMouseLeave={() => hover(null)}
      className={`slide-in scroll-my-2 overflow-hidden rounded-2xl border bg-[rgba(12,19,34,0.9)] transition-[border-color,box-shadow] duration-200 ${open ? `${a.border} ${a.glow}` : hovered ? 'border-white/30' : 'border-white/10'}`}
    >
      <button
        type="button"
        onClick={() => select(open ? null : event.id)}
        aria-expanded={open}
        className={`group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${a.ring} active:opacity-90`}
      >
        <div className="relative h-[120px] w-full overflow-hidden bg-[#0f1830]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.photoUrl} alt="" width={1200} height={675} loading="eager" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(7,11,20,0.95)] via-[rgba(7,11,20,0.25)] to-transparent" />
          <span className={`absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-full text-sm font-bold shadow-lg ${a.badge}`}>{rank}</span>
          <div className="absolute right-3 top-3 flex gap-1.5">
            {tonight && pick.lane === 'both' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(7,11,20,0.8)] px-2.5 py-0.5 text-sm font-medium text-gold backdrop-blur"><Target size={13} aria-hidden /> Your goal too</span>
            )}
            {event.future && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(7,11,20,0.8)] px-2.5 py-0.5 text-sm font-medium text-ink backdrop-blur"><Sparkles size={13} aria-hidden /> Future</span>
            )}
          </div>
          <h3 className="absolute inset-x-3 bottom-2 line-clamp-2 text-lg font-semibold leading-tight drop-shadow">{event.title}</h3>
        </div>
        <div className="px-3 pb-3 pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className={`text-xl font-semibold leading-none tracking-tight ${a.text}`}>
              {fmtDay(event.start)} <span className="tabular-nums">{fmtTime(event.start)}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm text-ink-dim">
              {track && <span className="inline-flex items-center gap-1"><track.Icon size={15} aria-hidden /> {track.label}</span>}
              <ChevronDown size={18} aria-hidden className={`transition-transform duration-200 group-hover:text-ink ${open ? 'rotate-180' : ''}`} />
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-dim">
            <MapPin size={14} className="shrink-0" aria-hidden />
            <span className="truncate">{event.locationName}</span>
          </div>
          <div className="mt-2 flex min-h-7 items-center gap-2 text-sm">
            <AvatarStack people={people} />
            <span className={`truncate ${sentence ? 'text-ink' : 'text-ink-dim'}`}>{sentence ?? 'Be the first of your friends to go'}</span>
          </div>
        </div>
      </button>

      {open && (
        <div className="fade-up space-y-3 border-t border-white/10 px-3 pb-3 pt-3">
          <Section label="Why you">{pick.why.charAt(0).toUpperCase() + pick.why.slice(1)}</Section>
          {mech && (
            <Section label="Why it works">
              {mech.line}
              <span className="mt-0.5 block text-sm italic text-ink-dim">{mech.citation}</span>
            </Section>
          )}
          <Section label="It fits">{pick.conflict ? `Overlaps ${pick.conflict.courseCode} · ${pick.fitNote}` : pick.fitNote}</Section>
          {contact && (
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-dim">Go with</div>
              <div className="mt-1.5 flex items-center gap-3">
                <Avatar initials={initialsOf(contact.name)} color={colorFor(contact.id)} size={36} />
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium">{contact.name}</div>
                  <div className="line-clamp-2 text-sm text-ink-dim">{pick.withWhy ?? `Met ${contact.metWhen}`}</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => toggleGoing(event.id)}
              aria-pressed={going}
              className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-[15px] font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.97] ${going ? `border ${a.done}` : a.solid}`}
            >
              {going && <Check size={16} strokeWidth={2.5} aria-hidden />} {goingLabel}
            </button>
            {sentTo ? (
              <button
                type="button"
                onClick={() => openInvite(event.id)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-400/10 text-[15px] font-medium text-emerald-300 transition duration-150 hover:bg-emerald-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 active:scale-[0.97]"
              >
                <span className="truncate">{sentTo}</span> <Check size={16} strokeWidth={2.5} aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openInvite(event.id)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 text-[15px] font-medium transition duration-150 hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.97] active:bg-white/15"
              >
                <Send size={15} aria-hidden /> <span className="truncate">{contact ? `Invite ${firstName(contact.name)}` : 'Invite a friend'}</span>
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <a
              href={calendarLink(event)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md text-ink-dim transition duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:opacity-70"
            >
              <CalendarPlus size={15} aria-hidden /> Add to calendar
            </a>
            {event.sourceUrl ? (
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md text-ink-dim transition duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:opacity-70"
              >
                Source <ExternalLink size={14} aria-hidden />
              </a>
            ) : event.host ? (
              <span className="truncate text-ink-dim">{event.host}</span>
            ) : null}
          </div>
        </div>
      )}
    </li>
  );
}
