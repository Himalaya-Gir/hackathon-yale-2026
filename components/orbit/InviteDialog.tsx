'use client';
// The invite, already written by Orbit: edit it, then copy it or send it by iMessage or Telegram.
import { useState } from 'react';
import { Copy, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/system/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/system/dialog';
import { Textarea } from '@/components/system/textarea';
import { colorFor, firstName, initialsOf, useUi } from '@/components/ui/util';
import { eventLink, smsLink, telegramLink } from '@/lib/links';
import { useOrbit } from '@/lib/store';
import { fmtWhen } from '@/lib/time';
import type { Contact, Pick as OrbitPick, YaleEvent } from '@/lib/types';
import { cn } from '@/lib/utils';
import Person from './Person';
import { LABEL, TONIGHT, WEEK } from './model';

const ACTION = cn(LABEL, 'h-11 text-[12px] tracking-[0.16em]');

function Body({ pick, event, contact, tonight }: { pick: OrbitPick; event: YaleEvent; contact: Contact | null; tonight: boolean }) {
  const markSent = useUi((s) => s.markSent);
  const who = contact ? firstName(contact.name) : null;
  const [message, setMessage] = useState(
    pick.invite ?? `${who ? `Hey ${who}, ` : ''}"${event.title}" is ${fmtWhen(event.start)} at ${event.locationName}. Want to go together?`,
  );
  const label = who ? `Sent to ${who}` : 'Invite sent';

  async function copy() {
    try { await navigator.clipboard.writeText(message); } catch { /* clipboard blocked: the message stays on screen */ }
    markSent(event.id, label);
  }

  return (
    <>
      <DialogHeader className="flex-row items-center gap-3 text-left">
        {contact && <Person initials={initialsOf(contact.name)} color={colorFor(contact.id)} name={contact.name} size="lg" />}
        <div className="min-w-0">
          <DialogTitle className="text-[22px] font-semibold leading-tight">{contact ? `Invite ${contact.name}` : 'Invite a friend'}</DialogTitle>
          <DialogDescription className={cn(LABEL, 'mt-1 truncate')} style={{ color: tonight ? TONIGHT : WEEK }}>
            {event.title} · {fmtWhen(event.start)}
          </DialogDescription>
        </div>
      </DialogHeader>
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={320} aria-label="Message" className="min-h-28 resize-none text-[16px] leading-relaxed" />
      <DialogFooter className="grid grid-cols-3 gap-2 sm:grid-cols-3">
        <Button onClick={() => void copy()} disabled={!message.trim()} className={ACTION}><Copy /> Copy</Button>
        <Button variant="outline" asChild className={ACTION}>
          <a href={smsLink(message)} onClick={() => markSent(event.id, label)}><MessageCircle /> iMessage</a>
        </Button>
        <Button variant="outline" asChild className={ACTION}>
          <a href={telegramLink(eventLink(event), message)} target="_blank" rel="noreferrer" onClick={() => markSent(event.id, label)}><Send /> Telegram</a>
        </Button>
      </DialogFooter>
    </>
  );
}

export default function InviteDialog() {
  const inviteFor = useUi((s) => s.inviteFor);
  const close = useUi((s) => s.closeInvite);
  const mode = useOrbit((s) => s.mode);
  const pick = useOrbit((s) => (inviteFor ? (s.mode === 'week' ? s.weekPicks : s.tonightPicks).find((p) => p.eventId === inviteFor) : undefined));
  const event = useOrbit((s) => (inviteFor ? s.events.find((e) => e.id === inviteFor) : undefined));
  const contact = useOrbit((s) => (pick?.withContactId ? s.profile?.contacts.find((c) => c.id === pick.withContactId) ?? null : null));
  const open = !!(inviteFor && pick && event);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-[480px] gap-5 rounded-2xl bg-popover p-6 sm:max-w-[480px]">
        {open && <Body key={inviteFor} pick={pick} event={event} contact={contact} tonight={mode === 'tonight'} />}
      </DialogContent>
    </Dialog>
  );
}
