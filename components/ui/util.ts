// Small pure helpers shared by the panels.
import { Activity, BatteryLow, Briefcase, CloudRain, Coffee, Cpu, Factory, FlaskConical, HeartPulse, Landmark, Leaf, Lightbulb, Moon, Palette, Rocket, Sun, TrendingUp, UserRound, Users, Wind, type LucideIcon } from 'lucide-react';
import { create } from 'zustand';
import type { Course, Mood, Track } from '@/lib/types';
import { fmtWhen, nyDate, nyParts, toNyIso } from '@/lib/time';

export const TRACK_META: Record<Track, { label: string; Icon: LucideIcon }> = {
  space: { label: 'Space', Icon: Rocket },
  ai: { label: 'AI', Icon: Cpu },
  startup: { label: 'Startups', Icon: Lightbulb },
  industry: { label: 'Industry', Icon: Factory },
  research: { label: 'Research', Icon: FlaskConical },
  finance: { label: 'Finance', Icon: TrendingUp },
  policy: { label: 'Policy', Icon: Landmark },
  health: { label: 'Health', Icon: HeartPulse },
  climate: { label: 'Climate', Icon: Leaf },
  arts: { label: 'Arts', Icon: Palette },
  social: { label: 'Social', Icon: Users },
  career: { label: 'Career', Icon: Briefcase },
};

export const MOOD_META: Record<Mood, { label: string; Icon: LucideIcon }> = {
  sad: { label: 'Sad', Icon: CloudRain },
  lonely: { label: 'Lonely', Icon: UserRound },
  stressed: { label: 'Stressed', Icon: Activity },
  anxious: { label: 'Anxious', Icon: Wind },
  bored: { label: 'Bored', Icon: Coffee },
  tired: { label: 'Tired', Icon: Moon },
  unmotivated: { label: 'Unmotivated', Icon: BatteryLow },
  great: { label: 'Great', Icon: Sun },
};

const PALETTE = ['#63AAFF', '#8FB8DE', '#5B7FA6', '#A9B8CC', '#3E6FB0', '#7C8DA6'];

/** Stable circle color for a person who has none in the data (contacts). */
export function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initialsOf(name: string): string {
  const parts = name.replace(/^(Prof\.|Dr\.)\s+/i, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')).toUpperCase();
}

export function firstName(name: string): string {
  return name.replace(/^(Prof\.|Dr\.)\s+/i, '').trim().split(/\s+/)[0] ?? name;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Today 1:05 PM" / "Wed 1:05 PM": the next time this course meets, or null. */
export function nextMeeting(course: Course, ref: Date): string | null {
  const p = nyParts(ref);
  let best: Date | null = null;
  for (let add = 0; add < 8; add++) {
    const noon = nyDate(p.y, p.m, p.d + add, 12, 0);
    const wd = DAYS[new Date(Date.UTC(p.y, p.m - 1, p.d + add)).getUTCDay()];
    const q = nyParts(noon);
    for (const m of course.meetings) {
      if (m.day !== wd) continue;
      const [hh, mm] = m.start.split(':').map(Number);
      if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
      const at = nyDate(q.y, q.m, q.d, hh, mm);
      if (at.getTime() <= ref.getTime()) continue;
      if (!best || at.getTime() < best.getTime()) best = at;
    }
    if (best) break;
  }
  return best ? fmtWhen(toNyIso(best), ref) : null;
}

/** "Lena + 2 friends are going", "You and Lena are going", … or null when nobody is. */
export function goingSentence(friendFirstNames: string[], you: boolean): string | null {
  const n = friendFirstNames.length;
  if (!n) return you ? "You're going" : null;
  const first = friendFirstNames[0];
  const rest = n - 1;
  const others = rest > 0 ? ` + ${rest} friend${rest > 1 ? 's' : ''}` : '';
  if (you) return rest > 0 ? `You, ${first}${others} are going` : `You and ${first} are going`;
  return rest > 0 ? `${first}${others} are going` : `${first} is going`;
}

/** Interface-only state (never read by the map): the invite dialog and sent invites. */
type Ui = {
  inviteFor: string | null;
  sent: Record<string, string>;
  openInvite(eventId: string): void;
  closeInvite(): void;
  markSent(eventId: string, label: string): void;
};
export const useUi = create<Ui>()((set) => ({
  inviteFor: null,
  sent: {},
  openInvite(eventId) { set({ inviteFor: eventId }); },
  closeInvite() { set({ inviteFor: null }); },
  markSent(eventId, label) { set((s) => ({ sent: { ...s.sent, [eventId]: label }, inviteFor: null })); },
}));
