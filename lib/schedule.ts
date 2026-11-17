// Schedule facts for /api/plan (PLAN.md §9 package C, steps 2 and 4). Times are America/New_York.
// Exports: HACKATHON_ID, StartPoint, Fit, nyWeekday, startMs, endMs, candidates, conflict, walkMin, startPoint, leaveBy, fit.
import { TZ, fmtTime, nyDate, nyParts, toNyIso } from './time';
import type { Course, Profile, YaleEvent } from './types';

/** The event the student is sitting in right now: never proposed as a pick. */
export const HACKATHON_ID = 'grokathon-yale-2026';

type Point = { lat: number; lng: number };
export type StartPoint = Point & { name: string; courseCode: string | null };
export type Fit = { conflict: { courseCode: string } | null; walkMin: number; leaveBy: string; fitNote: string };

const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
/** "Mon", "Tue"… as seen in New York. */
export function nyWeekday(d: Date): string {
  return weekdayFmt.format(d).slice(0, 3);
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Instant of an event timestamp. Strings that already carry Z or an offset use that offset.
 * Strings with no offset are New York wall time — never the host zone (Vercel is UTC).
 */
function parseInstant(iso: string | null | undefined): Date {
  if (!iso) return new Date(NaN);
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(iso)) {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d : new Date(NaN);
  }
  const m = iso.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?$/);
  if (!m) return new Date(NaN);
  return nyDate(+m[1], +m[2], +m[3], +m[4], +m[5]);
}

export function startMs(event: YaleEvent): number {
  return parseInstant(event.start).getTime();
}

export function endMs(event: YaleEvent): number {
  const s = startMs(event);
  if (event.end) {
    const e = parseInstant(event.end).getTime();
    if (Number.isFinite(e) && e > s) return e;
  }
  return s + (event.durationMin ?? 60) * 60000;
}

/**
 * Events starting between now (15 min grace) and now + hours, soonest first.
 * If fewer than `minCount` remain and `widenHours` is given, the window is widened once.
 */
export function candidates(events: YaleEvent[], now: Date, hours: number, opts: { minCount?: number; widenHours?: number } = {}): YaleEvent[] {
  const from = now.getTime() - 15 * 60000;
  const pick = (h: number) =>
    events
      .filter((e) => {
        const s = startMs(e);
        return e.id !== HACKATHON_ID && Number.isFinite(s) && s >= from && s <= now.getTime() + h * 3600000;
      })
      .sort((a, b) => startMs(a) - startMs(b));
  const first = pick(hours);
  if (opts.widenHours && opts.minCount && first.length < opts.minCount) return pick(opts.widenHours);
  return first;
}

/** The class this event overlaps, if any. */
export function conflict(event: YaleEvent, courses: Course[]): { courseCode: string } | null {
  const s = parseInstant(event.start);
  if (!Number.isFinite(s.getTime())) return null;
  const p = nyParts(s);
  const day = nyWeekday(s);
  const a = p.hh * 60 + p.mm;
  const b = a + Math.max(1, Math.round((endMs(event) - s.getTime()) / 60000));
  for (const c of courses) {
    for (const m of c.meetings) {
      if (m.day === day && a < toMin(m.end) && b > toMin(m.start)) return { courseCode: c.code };
    }
  }
  return null;
}

/** Walking minutes: straight line × 1.3 ÷ 80 m/min, rounded up (at least 1). */
export function walkMin(a: Point, b: Point): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const meters = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  if (!Number.isFinite(meters)) return 1;
  return Math.max(1, Math.ceil((meters * 1.3) / 80));
}

/** Where the student leaves from: the last class ending within 90 min before the event, else home. */
export function startPoint(event: YaleEvent, profile: Pick<Profile, 'courses' | 'home'>): StartPoint {
  const s = parseInstant(event.start);
  if (!Number.isFinite(s.getTime())) {
    return { name: profile.home.name, lat: profile.home.lat, lng: profile.home.lng, courseCode: null };
  }
  const p = nyParts(s);
  const day = nyWeekday(s);
  const at = p.hh * 60 + p.mm;
  let best: { end: number; course: Course } | null = null;
  for (const c of profile.courses) {
    for (const m of c.meetings) {
      const end = toMin(m.end);
      if (m.day === day && end <= at && at - end <= 90 && (!best || end > best.end)) best = { end, course: c };
    }
  }
  if (best) return { name: best.course.building, lat: best.course.lat, lng: best.course.lng, courseCode: best.course.code };
  return { name: profile.home.name, lat: profile.home.lat, lng: profile.home.lng, courseCode: null };
}

/** Start − walk − 5 minutes, ISO with the New York offset. */
export function leaveBy(event: YaleEvent, walk: number): string {
  return toNyIso(new Date(startMs(event) - (walk + 5) * 60000));
}

/** Everything code adds to a pick. */
export function fit(event: YaleEvent, profile: Pick<Profile, 'courses' | 'home'>): Fit {
  const from = startPoint(event, profile);
  const walk = walkMin(from, event);
  const leave = leaveBy(event, walk);
  const clash = conflict(event, profile.courses);
  const head = clash ? `Overlaps ${clash.courseCode}` : from.courseCode ? `After ${from.courseCode}` : 'No class conflict';
  return { conflict: clash, walkMin: walk, leaveBy: leave, fitNote: `${head} · leave by ${fmtTime(leave)} · ${walk} min walk` };
}
