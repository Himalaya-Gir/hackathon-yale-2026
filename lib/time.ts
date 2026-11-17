// Time helpers. Everything is America/New_York (PLAN.md §2, principle 3).
import type { YaleEvent } from './types';

export const TZ = 'America/New_York';

/** "Now": `?now=2026-11-17T18:30` in the browser freezes it; otherwise real time. */
export function now(): Date {
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('now');
    if (q) return parseNow(q);
  }
  return new Date();
}

/** Parses a `now` override. A value without offset is read as New York local time. */
export function parseNow(value: string | undefined | null): Date {
  if (!value) return new Date();
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(value)) return new Date(value);
  const m = value.match(/^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/);
  if (!m) return new Date();
  return nyDate(+m[1], +m[2], +m[3], +(m[4] ?? 12), +(m[5] ?? 0));
}

/** Calendar parts of a date as seen in New York. */
export function nyParts(d: Date) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, weekday: p.weekday as string };
}

/** UTC offset of New York at a given instant, in minutes (e.g. -300). */
function nyOffsetMin(at: Date): number {
  const p = nyParts(at);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

/** Builds the instant for a New York wall-clock time. */
export function nyDate(y: number, m: number, d: number, hh: number, mm: number): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const off = nyOffsetMin(guess);
  return new Date(guess.getTime() - off * 60000);
}

/** ISO string with the New York offset, e.g. 2026-11-19T17:30:00-05:00. */
export function toNyIso(date: Date): string {
  const p = nyParts(date);
  const off = nyOffsetMin(date);
  const sign = off <= 0 ? '-' : '+';
  const a = Math.abs(off);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.hh)}:${pad(p.mm)}:00${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** Sample events store dayOffset + time; this computes their real start relative to `ref`. */
export function redate(event: YaleEvent, ref: Date): YaleEvent {
  if (!event.sample || event.dayOffset === null || !event.time) return event;
  const p = nyParts(ref);
  const [hh, mm] = event.time.split(':').map(Number);
  let start = nyDate(p.y, p.m, p.d + event.dayOffset, hh, mm);
  // A sample event whose time today is already over moves to tomorrow (the hackathon pin stays today).
  const endToday = start.getTime() + (event.durationMin ?? 60) * 60000;
  if (event.dayOffset === 0 && endToday < ref.getTime() && event.id !== 'grokathon-yale-2026') {
    start = nyDate(p.y, p.m, p.d + 1, hh, mm);
  }
  const end = event.durationMin ? new Date(start.getTime() + event.durationMin * 60000) : null;
  return { ...event, start: toNyIso(start), end: end ? toNyIso(end) : null };
}

export function redateAll(events: YaleEvent[], ref: Date): YaleEvent[] {
  return events.map((e) => redate(e, ref)).sort((a, b) => a.start.localeCompare(b.start));
}

function dayDiff(iso: string, ref: Date): number {
  const a = nyParts(new Date(iso));
  const b = nyParts(ref);
  return Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86400000);
}

/** "5:30 PM" → "5:30" style short time with am/pm. */
export function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(iso)).replace(':00', '').replace(' ', ' ');
}

/** "Tonight" / "Today" / "Tomorrow" / "Thu". */
export function fmtDay(iso: string, ref: Date = now()): string {
  const diff = dayDiff(iso, ref);
  const hour = nyParts(new Date(iso)).hh;
  if (diff === 0) return hour >= 17 ? 'Tonight' : 'Today';
  if (diff === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date(iso));
}

/** "Tonight 7:30 PM", "Thu 5:30 PM". */
export function fmtWhen(iso: string, ref: Date = now()): string {
  return `${fmtDay(iso, ref)} ${fmtTime(iso)}`;
}
