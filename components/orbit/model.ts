// Orbit's model for the interface: rings, geometry, labels and Orbit's spoken line.
import { fmtDay, nyParts, now } from '@/lib/time';
import type { Contact, Friend, Mode, Pick as OrbitPick, YaleEvent } from '@/lib/types';
import { firstName } from '@/components/ui/util';

/** Small uppercase telemetry label, the one label style of the interface. */
export const LABEL = 'text-[11px] font-medium uppercase tracking-[0.22em]';

export const YALE = '#00356B';
export const YALE_TINT = '#286DC0';
/** Accent of week picks (the mission) and of tonight picks. Same values as the map beams in components/map/scene.ts. */
export const WEEK = '#286DC0';
export const TONIGHT = '#E8932A';
export const INK = '#171A20';

/** Ring radii as a fraction of the diagram radius. Week has three rings, tonight collapses to two. */
export const RINGS: Record<Mode, { label: string; f: number; speed: number }[]> = {
  week: [
    { label: 'TONIGHT', f: 0.34, speed: 1.6 },
    { label: 'TOMORROW', f: 0.585, speed: 1.1 },
    { label: 'THIS WEEK', f: 0.83, speed: 0.75 },
  ],
  tonight: [
    { label: 'TONIGHT', f: 0.44, speed: 1.5 },
    { label: 'TOMORROW', f: 0.76, speed: 0.95 },
  ],
};
export const MISSION_F = 0.955;

/** 0 = today, 1 = tomorrow, 2 = later, in New York days. */
export function dayIndex(iso: string, ref: Date = now()): number {
  const a = nyParts(new Date(iso));
  const b = nyParts(ref);
  const diff = Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86400000);
  return Math.max(0, Math.min(2, diff));
}

export function ringOf(event: YaleEvent, mode: Mode): number {
  const d = dayIndex(event.start);
  return mode === 'tonight' ? Math.min(d, 1) : d;
}

const SHORT_GOAL: Record<string, string> = {
  'Break into the space industry': 'The space industry',
  'Start a company before I graduate': 'A company before I graduate',
  'Find a research lab in AI': 'A research lab in AI',
  'Meet people outside my major': 'People outside my major',
};
export function missionLabel(goal: string): string {
  return `MISSION · ${(SHORT_GOAL[goal] ?? goal).toUpperCase()}`;
}

/** Planet diameter in px from the pick score. */
export function planetSize(score: number): number {
  const s = Math.max(0, Math.min(100, score));
  return Math.round(34 + s * 0.32);
}

/** "MASON LAB" from "Mason Laboratory, 9 Hillhouse Ave". */
export function placeShort(event: YaleEvent): string {
  const name = (event.building ?? event.locationName).split(',')[0].trim();
  if (name.length <= 22) return name;
  return name.split(/\s+/).slice(0, 2).join(' ').replace(/\s+(and|of|the)$/i, '');
}

const RING_WORDS = ['one ring away', 'two rings away', 'three rings away'];
function dayWords(iso: string): string {
  const d = fmtDay(iso);
  return d === 'Tonight' || d === 'Today' || d === 'Tomorrow' ? d.toLowerCase() : `on ${d}`;
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

/** Orbit's line about the focused pick, written from the data like a person would say it. */
export function voiceLine(pick: OrbitPick, event: YaleEvent, friends: Friend[], contact: Contact | null, ring: number, going: boolean): string {
  const names = friends.map((f) => firstName(f.name));
  const place = placeShort(event);
  const parts: string[] = [];
  if (going && names.length) parts.push(`You're in, and so ${names.length > 1 ? 'are' : 'is'} ${listNames(names)}.`);
  else if (going) parts.push(`You're in for ${place} ${dayWords(event.start)}.`);
  else if (names.length) parts.push(`${listNames(names)} ${names.length > 1 ? 'are' : 'is'} ${RING_WORDS[ring]}, at ${place} ${dayWords(event.start)}.`);
  else parts.push(`Nobody you know is going to ${place} yet. You could be the first.`);
  if (contact) {
    const who = firstName(contact.name);
    if (contact.relation === 'new') parts.push(`You met ${who} ${contact.metWhen}${contact.metWhere ? ` at ${contact.metWhere}` : ''}. Bring ${who} along.`);
    else if (contact.relation === 'friend') parts.push(`${who} would love this one.`);
    else parts.push(`${who} should hear you were there.`);
  }
  return parts.join(' ');
}

const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function roman(n: number): string {
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}

/** "TUE · XVII · XI · MMXXVI", the date as a book page would print it. */
export function romanDate(ref: Date = now()): string {
  const p = nyParts(ref);
  const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/New_York' }).format(ref).toUpperCase();
  return [wd, roman(p.d), roman(p.m), roman(p.y)].join(' · ');
}
