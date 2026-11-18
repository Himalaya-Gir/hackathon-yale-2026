'use client';
// One proposal, Tesla-screen style: photo, when and where, why, who is going; a blue pill to say yes and grey tiles for the rest.
import { CalendarPlus, Check, Send, SkipForward } from 'lucide-react';
import { motion } from 'motion/react';
import { AvatarGroup } from '@/components/system/avatar';
import { Button } from '@/components/system/button';
import { colorFor, firstName, goingSentence, initialsOf, useUi } from '@/components/ui/util';
import { calendarLink } from '@/lib/links';
import { MECHANISM_BY_ID, SAFETY_LINE, SAFETY_MOODS } from '@/lib/science';
import { useOrbit } from '@/lib/store';
import { fmtDay, fmtTime } from '@/lib/time';
import type { Pick as OrbitPick, YaleEvent } from '@/lib/types';
import { cn } from '@/lib/utils';
import Person from './Person';
import { LABEL, TONIGHT, WEEK, placeShort } from './model';

/** Grey rounded tile with an icon over an uppercase label, like MIRRORS / STEERING WHEEL. */
export function Tile({ icon, label, onClick, href, active }: { icon: React.ReactNode; label: string; onClick?: () => void; href?: string; active?: boolean }) {
  const cls = cn('h-[68px] [@media(max-height:780px)]:h-14 flex-1 flex-col gap-1.5 rounded-xl px-2 [&_svg]:size-[18px]', LABEL, 'text-[11px] tracking-[0.14em]',
    active ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-secondary text-foreground hover:bg-[#dfe0e3]');
  if (href) {
    return <Button variant="secondary" asChild className={cls}><a href={href} target="_blank" rel="noreferrer">{icon}<span className="truncate">{label}</span></a></Button>;
  }
  return <Button variant="secondary" onClick={onClick} className={cls}>{icon}<span className="truncate">{label}</span></Button>;
}

export default function Proposal({ pick, event, onSkip }: { pick: OrbitPick; event: YaleEvent; onSkip?: () => void }) {
  const mode = useOrbit((s) => s.mode);
  const mood = useOrbit((s) => s.mood);
  const allFriends = useOrbit((s) => s.friends);
  const isGoing = useOrbit((s) => s.going.includes(event.id));
  const toggleGoing = useOrbit((s) => s.toggleGoing);
  const contact = useOrbit((s) => (pick.withContactId ? s.profile?.contacts.find((c) => c.id === pick.withContactId) ?? null : null));
  const openInvite = useUi((s) => s.openInvite);
  const sent = useUi((s) => s.sent[event.id]);

  const tonight = mode === 'tonight';
  const accent = tonight ? TONIGHT : WEEK;
  const friends = allFriends.filter((f) => f.status === 'friend' && f.goingTo.includes(event.id));
  const goingLine = goingSentence(friends.map((f) => firstName(f.name)), isGoing);
  const mechanism = tonight && pick.mechanismId ? MECHANISM_BY_ID[pick.mechanismId] : undefined;
  const safety = tonight && !!mood && (SAFETY_MOODS as readonly string[]).includes(mood);
  const who = contact ? firstName(contact.name) : null;

  return (
    <motion.div key={event.id} className="flex flex-col gap-4 [@media(max-height:780px)]:gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}>
      <div className="flex gap-4">
        <div className="relative aspect-[4/3] w-[168px] shrink-0 [@media(max-height:780px)]:w-[124px] overflow-hidden rounded-xl bg-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.photoUrl} alt="" className="size-full object-cover" />
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-1.5">
          <p className={LABEL} style={{ color: accent }}>{[fmtDay(event.start), fmtTime(event.start)].join(' · ')}</p>
          <h3 className="text-[22px] font-bold leading-[1.12] text-foreground">{event.title}</h3>
          <p className="text-[14px] text-muted-foreground">{placeShort(event)}</p>
        </div>
      </div>

      <p className="text-[15px] leading-relaxed text-foreground/85">{pick.why}</p>

      {mechanism && (
        <div className="rounded-xl bg-[#fdf3e7] px-4 py-3">
          <p className={LABEL} style={{ color: TONIGHT }}>Why it works</p>
          <p className="mt-1 text-[15px] leading-relaxed text-foreground">{mechanism.line}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{mechanism.citation}</p>
        </div>
      )}

      {(friends.length > 0 || isGoing) && (
        <div className="flex items-center gap-3">
          <AvatarGroup>{friends.slice(0, 4).map((f) => <Person key={f.id} initials={f.initials} color={f.color} name={f.name} />)}</AvatarGroup>
          <p className="text-[14px] text-foreground">{goingLine}</p>
        </div>
      )}

      {contact && (
        <div className="flex items-center gap-3 rounded-xl bg-secondary/70 px-3 py-2.5">
          <Person initials={initialsOf(contact.name)} color={colorFor(contact.id)} name={contact.name} />
          <p className="min-w-0 flex-1 text-[14px] leading-snug">
            <span className="font-semibold">{sent ?? `Go with ${who}`}</span>
            {pick.withWhy && <span className="block truncate text-muted-foreground">{pick.withWhy}</span>}
          </p>
        </div>
      )}

      <Button size="lg" onClick={() => toggleGoing(event.id)} aria-pressed={isGoing}
        className={cn(LABEL, 'h-12 w-full rounded-full text-[13px] tracking-[0.2em] [@media(max-height:780px)]:h-10', isGoing ? 'bg-[#00356B] hover:bg-[#00356B]/90' : '')}>
        {isGoing ? <><Check /> You&apos;re in</> : "I'm in"}
      </Button>
      <div className="flex gap-2">
        <Tile icon={sent ? <Check /> : <Send />} label={sent ? 'Sent' : who ? `Invite ${who}` : 'Invite'} onClick={() => openInvite(event.id)} />
        <Tile icon={<CalendarPlus />} label="Calendar" href={calendarLink(event)} />
        {onSkip && <Tile icon={<SkipForward />} label="Not this one" onClick={onSkip} />}
      </div>

      {pick.conflict && <p className={cn(LABEL, 'text-muted-foreground')}>Overlaps {pick.conflict.courseCode}</p>}
      {safety && <p className="rounded-xl bg-secondary px-4 py-3 text-[13px] leading-snug text-muted-foreground">{SAFETY_LINE}</p>}
    </motion.div>
  );
}
