'use client';
// Contract file (PLAN.md §7.4). Map and panels only talk through this store.
import { create } from 'zustand';
import type { Friend, Mode, Mood, Pick as OrbitPick, PlanEvent, PlanRequest, Profile, Stats, YaleEvent } from './types';
import { now, redateAll } from './time';

type Store = {
  events: YaleEvent[]; profile: Profile | null; stats: Stats | null; friends: Friend[];
  loaded: boolean;
  goal: string;
  mode: Mode; mood: Mood | null;
  phase: 'idle' | 'thinking' | 'done';
  log: string[];
  weekPicks: OrbitPick[]; tonightPicks: OrbitPick[];
  trajectory: string | null;
  lastSource: 'live' | 'fallback' | null;
  going: string[];
  selectedEventId: string | null; hoveredEventId: string | null;
  load(): Promise<void>;
  setGoal(goal: string): void;
  runWeek(goal: string): Promise<void>;
  runTonight(mood: Mood): Promise<void>;
  backToWeek(): void;
  addFriend(id: string): void;
  toggleGoing(eventId: string): void;
  friendsGoing(eventId: string): Friend[];
  select(id: string | null): void; hover(id: string | null): void;
};

let controller: AbortController | null = null;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

function nowParam(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return new URLSearchParams(window.location.search).get('now') ?? undefined;
}

function demoParam(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('demo') === '1';
}

/** Reads the NDJSON stream of /api/plan and hands each PlanEvent to `onEvent`. */
async function streamPlan(body: PlanRequest, signal: AbortSignal, onEvent: (e: PlanEvent) => void) {
  const res = await fetch(`/api/plan${demoParam() ? '?demo=1' : ''}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  });
  if (!res.ok || !res.body) throw new Error(`plan: ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('{')) continue;
      try { onEvent(JSON.parse(t) as PlanEvent); } catch { /* ignore a broken line */ }
    }
  }
  const rest = buffer.trim();
  if (rest.startsWith('{')) { try { onEvent(JSON.parse(rest) as PlanEvent); } catch { /* ignore */ } }
}

export const useOrbit = create<Store>()((set, get) => {
  async function run(mode: Mode, mood: Mood | null) {
    controller?.abort();
    const mine = new AbortController();
    controller = mine;
    const key = mode === 'week' ? 'weekPicks' : 'tonightPicks';
    try {
      await streamPlan(
        { mode, goal: get().goal, mood: mood ?? undefined, now: nowParam() },
        mine.signal,
        (e) => {
          if (mine.signal.aborted) return;
          if (e.type === 'status') set((s) => ({ log: [...s.log, e.text] }));
          else if (e.type === 'pick') set((s) => ({ [key]: [...s[key], e.pick] } as Pick<Store, typeof key>));
          else if (e.type === 'trajectory') set({ trajectory: e.text });
          else if (e.type === 'done') set({ phase: 'done', lastSource: e.source });
          else if (e.type === 'error') set((s) => ({ log: [...s.log, e.message], phase: 'done' }));
        },
      );
      if (!mine.signal.aborted && get().phase !== 'done') set({ phase: 'done' });
    } catch (err) {
      if (mine.signal.aborted) return;
      set((s) => ({ phase: 'done', log: [...s.log, 'Connection lost. Try again.'] }));
      console.error(err);
    }
  }

  return {
    events: [], profile: null, stats: null, friends: [], loaded: false,
    goal: '', mode: 'week', mood: null, phase: 'idle', log: [],
    weekPicks: [], tonightPicks: [], trajectory: null, lastSource: null,
    going: [], selectedEventId: null, hoveredEventId: null,

    async load() {
      if (get().loaded) return;
      const [events, profile, stats, friends] = await Promise.all([
        getJson<YaleEvent[]>('/data/events.json'),
        getJson<Profile>('/data/profile.json'),
        getJson<Stats>('/data/stats.json'),
        getJson<Friend[]>('/data/friends.json'),
      ]);
      set({ events: redateAll(events, now()), profile, stats, friends, goal: profile.defaultGoal, loaded: true });
    },

    setGoal(goal) { set({ goal }); },

    async runWeek(goal) {
      set({ goal, mode: 'week', mood: null, phase: 'thinking', log: [], weekPicks: [], tonightPicks: [], trajectory: null, selectedEventId: null });
      await run('week', null);
    },

    async runTonight(mood) {
      set({ mode: 'tonight', mood, phase: 'thinking', log: [], tonightPicks: [], selectedEventId: null });
      await run('tonight', mood);
    },

    backToWeek() {
      controller?.abort();
      set({ mode: 'week', mood: null, selectedEventId: null, phase: get().weekPicks.length ? 'done' : 'idle' });
    },

    addFriend(id) {
      set((s) => ({ friends: s.friends.map((f) => (f.id === id ? { ...f, status: 'friend' as const, reason: null } : f)) }));
    },

    toggleGoing(eventId) {
      set((s) => ({ going: s.going.includes(eventId) ? s.going.filter((x) => x !== eventId) : [...s.going, eventId] }));
    },

    friendsGoing(eventId) {
      return get().friends.filter((f) => f.status === 'friend' && f.goingTo.includes(eventId));
    },

    select(id) { set({ selectedEventId: id }); },
    hover(id) { set({ hoveredEventId: id }); },
  };
});

/** Picks of the mode currently on screen. */
export function currentPicks(s: Pick<Store, 'mode' | 'weekPicks' | 'tonightPicks'>): OrbitPick[] {
  return s.mode === 'week' ? s.weekPicks : s.tonightPicks;
}
