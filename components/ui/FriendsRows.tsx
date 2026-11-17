'use client';
import { useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useOrbit } from '@/lib/store';
import { fmtWhen, now } from '@/lib/time';
import type { Contact, Friend, YaleEvent } from '@/lib/types';
import Avatar from './Avatar';
import { SectionTitle } from './ProfilePanel';
import { colorFor, initialsOf } from './util';

const VIA: Record<Contact['via'], string> = { x: 'X', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', email: 'email', 'in person': 'in person' };

function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?:\s|$)/);
  return (match ? match[0] : text).trim();
}

/** The next upcoming event a person is going to, if it still exists in the data. */
function nextEvent(f: Friend, byId: Map<string, YaleEvent>, ref: number): YaleEvent | null {
  let best: YaleEvent | null = null;
  for (const id of f.goingTo) {
    const e = byId.get(id);
    if (!e || !e.start) continue;
    const t = new Date(e.start).getTime();
    if (Number.isNaN(t) || t < ref - 3600000) continue;
    if (!best || t < new Date(best.start).getTime()) best = e;
  }
  return best;
}

export default function FriendsRows() {
  const friends = useOrbit((s) => s.friends);
  const events = useOrbit((s) => s.events);
  const contacts = useOrbit((s) => s.profile?.contacts);
  const addFriend = useOrbit((s) => s.addFriend);
  const hover = useOrbit((s) => s.hover);
  const select = useOrbit((s) => s.select);
  const [focusId, setFocusId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const ref = now();
  const mine = friends.filter((f) => f.status === 'friend');
  const suggested = friends.filter((f) => f.status === 'suggested');
  const fresh = (contacts ?? []).filter((c) => c.relation === 'new').slice(0, 3);
  const focus = mine.find((f) => f.id === focusId) ?? null;
  const focusEvent = focus ? nextEvent(focus, byId, ref.getTime()) : null;

  return (
    <>
      <section className="mt-4">
        <SectionTitle aside={mine.length ? String(mine.length) : undefined}>Friends</SectionTitle>
        {mine.length === 0 ? (
          <p className="text-sm leading-5 text-ink-dim">Add people below to see where they are going.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" onMouseLeave={() => { setFocusId(null); hover(null); }}>
              {mine.map((f) => {
                const e = nextEvent(f, byId, ref.getTime());
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-label={f.name}
                    onMouseEnter={() => { setFocusId(f.id); hover(e ? e.id : null); }}
                    onFocus={() => setFocusId(f.id)}
                    onBlur={() => setFocusId((id) => (id === f.id ? null : id))}
                    onClick={() => { if (e) select(e.id); }}
                    className={`btn-press rounded-full ${focusId && focusId !== f.id ? 'opacity-50' : ''}`}
                  >
                    <Avatar initials={f.initials} color={f.color} size={32} />
                  </button>
                );
              })}
            </div>
            <div className="mt-2 min-h-12 text-sm leading-5">
              {focus ? (
                <>
                  <div className="font-medium">{focus.name} <span className="font-normal text-ink-dim">· {focus.college} {focus.classYear}</span></div>
                  <div className="text-ink-dim">
                    {focusEvent ? <>Going to <span className="text-ink">{focusEvent.title}</span> · {fmtWhen(focusEvent.start, ref)}</> : 'Nothing planned this week yet'}
                  </div>
                </>
              ) : (
                <div className="text-ink-dim">Point at a friend to see where they are going next.</div>
              )}
            </div>
          </>
        )}
      </section>

      {fresh.length > 0 && (
        <section className="mt-4">
          <SectionTitle>New this week</SectionTitle>
          <ul className="space-y-4">
            {fresh.map((c) => (
              <li key={c.id} className="flex gap-2">
                <Avatar initials={initialsOf(c.name)} color={colorFor(c.id)} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-5">{c.name}</div>
                  <div className="text-sm leading-5 text-ink-dim">via {VIA[c.via] ?? c.via} · {c.metWhen}</div>
                  <p className="mt-1 text-sm leading-5 text-ink-dim">{firstSentence(c.persona)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {suggested.length > 0 && (
        <section className="mt-4">
          <SectionTitle>People you may know</SectionTitle>
          <ul className="space-y-2">
            {suggested.slice(0, 6).map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <Avatar initials={f.initials} color={f.color} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-5">{f.name}</div>
                  <div className="text-sm leading-5 text-ink-dim">{f.reason ?? `${f.college} ${f.classYear}`}</div>
                </div>
                <button
                  type="button"
                  onClick={() => addFriend(f.id)}
                  className="btn-yale inline-flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium"
                >
                  <UserPlus size={16} aria-hidden /> Add
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
