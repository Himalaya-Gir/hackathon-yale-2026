'use client';
// The invite, already written: editable, then Copy / iMessage / Telegram.
import { useEffect, useState } from 'react';
import { Copy, MessageCircle, Send, X } from 'lucide-react';
import { eventLink, smsLink, telegramLink } from '@/lib/links';
import { useOrbit } from '@/lib/store';
import { fmtWhen } from '@/lib/time';
import type { Contact, Pick as OrbitPick, YaleEvent } from '@/lib/types';
import Avatar from './Avatar';
import { colorFor, firstName, initialsOf, useUi } from './util';

const ACTION = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.97]';
const GHOST = `${ACTION} border border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10 active:bg-white/15`;

function Dialog({ pick, event, contact, tonight }: { pick: OrbitPick; event: YaleEvent; contact: Contact | null; tonight: boolean }) {
  const close = useUi((s) => s.closeInvite);
  const markSent = useUi((s) => s.markSent);
  const who = contact ? firstName(contact.name) : null;
  const [message, setMessage] = useState(
    pick.invite ?? `${who ? `Hey ${who}, ` : ''}"${event.title}" is ${fmtWhen(event.start)} at ${event.locationName}. Want to go together?`,
  );
  const label = who ? `Sent to ${who} ✓` : 'Invite sent ✓';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  async function copy() {
    try { await navigator.clipboard.writeText(message); } catch { /* clipboard blocked: the message stays on screen */ }
    markSent(event.id, label);
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-[rgba(4,7,13,0.62)] p-4 backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div role="dialog" aria-modal aria-label="Invite" className="glass fade-up w-full max-w-[460px] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {contact && <Avatar initials={initialsOf(contact.name)} color={colorFor(contact.id)} size={40} />}
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold leading-tight">{contact ? `Invite ${contact.name}` : 'Invite a friend'}</h2>
              <p className={`truncate text-sm ${tonight ? 'text-sky' : 'text-gold'}`}>{event.title} · {fmtWhen(event.start)}</p>
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-dim transition duration-150 hover:bg-white/10 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-90">
            <X size={18} aria-hidden />
          </button>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={320}
          autoFocus
          aria-label="Message"
          className="orbit-scroll mt-4 w-full resize-none rounded-xl border border-white/15 bg-[rgba(7,11,20,0.7)] p-3 text-base leading-snug text-ink outline-none transition duration-150 focus:border-white/40"
        />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => void copy()} disabled={!message.trim()} className={`${ACTION} ${tonight ? 'bg-sky' : 'bg-gold'} font-semibold text-night hover:brightness-110 active:brightness-90 disabled:opacity-40`}>
            <Copy size={16} aria-hidden /> Copy
          </button>
          <a href={smsLink(message)} onClick={() => markSent(event.id, label)} className={GHOST}>
            <MessageCircle size={16} aria-hidden /> iMessage
          </a>
          <a href={telegramLink(eventLink(event), message)} target="_blank" rel="noreferrer" onClick={() => markSent(event.id, label)} className={GHOST}>
            <Send size={16} aria-hidden /> Telegram
          </a>
        </div>
      </div>
    </div>
  );
}

export default function InviteDialog() {
  const inviteFor = useUi((s) => s.inviteFor);
  const mode = useOrbit((s) => s.mode);
  const pick = useOrbit((s) => (inviteFor ? [...(s.mode === 'week' ? s.weekPicks : s.tonightPicks)].find((p) => p.eventId === inviteFor) : undefined));
  const event = useOrbit((s) => (inviteFor ? s.events.find((e) => e.id === inviteFor) : undefined));
  const contact = useOrbit((s) => (pick?.withContactId ? s.profile?.contacts.find((c) => c.id === pick.withContactId) ?? null : null));
  if (!inviteFor || !pick || !event) return null;
  return <Dialog key={inviteFor} pick={pick} event={event} contact={contact} tonight={mode === 'tonight'} />;
}
