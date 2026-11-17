// Contract file (PLAN.md §7.2). Do not change without telling the lead.

export type Track = 'space'|'ai'|'startup'|'industry'|'research'|'finance'|'policy'|'health'|'climate'|'arts'|'social'|'career';
export type ActivityKind = 'move'|'move-together'|'nature'|'social-small'|'social-big'|'food-together'|'create'|'music-live'|'arts-watch'|'awe'|'learn'|'help'|'calm'|'laugh'|'build';
export type Mood = 'sad'|'lonely'|'stressed'|'anxious'|'bored'|'tired'|'unmotivated'|'great';
export type Mode = 'week'|'tonight';
export type Mechanism = { id: string; line: string; citation: string; kinds: ActivityKind[] | 'all'; moods: Mood[] };

export type YaleEvent = {
  id: string;               // stable: `${source}-${shortHash}`
  title: string;            // cleaned, ≤ 80 chars
  start: string;            // ISO with offset (for sample events: computed at load from dayOffset + time)
  end: string | null;
  dayOffset: number | null; // sample events only: 0 = today, 1 = tomorrow, …
  time: string | null;      // sample events only: "17:30"
  locationName: string;     // as displayed
  building: string | null;  // exact name from buildings.json
  lat: number; lng: number;
  source: string;           // 'sample' | 'yale-calendar' | 'yaleconnect' | 'luma'
  sourceUrl: string;        // origin page; '' for sample events
  host: string | null;
  summary: string;          // ≤ 140 chars, factual
  tracks: Track[];          // 1 to 3
  kinds: ActivityKind[];    // 1 to 3 (closed vocabulary)
  future: boolean;          // "builds the future": space, AI, energy, hardware, biotech
  free: boolean | null; food: boolean | null;
  rsvpUrl: string | null;
  photoUrl: string;         // always a local path under /img/events/
  sample: boolean;          // true = fictional event
  online: boolean; solo: boolean; durationMin: number | null;
};

export type Meeting = { day: 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'; start: string; end: string }; // "13:05"
export type Course  = { code: string; title: string; professor: string; building: string; lat: number; lng: number; meetings: Meeting[] };
export type Contact = {       // people met outside Orbit this week ("New this week")
  id: string; name: string; handle: string | null;
  via: 'x'|'linkedin'|'whatsapp'|'email'|'in person'; metWhen: string; metWhere: string | null;
  relation: 'new'|'friend'|'professor'|'mentor';
  persona: string;            // 2 sentences
  interests: string[];
};
export type Friend = {        // Orbit's social graph
  id: string; name: string; initials: string; color: string;
  classYear: string; college: string;
  status: 'friend'|'suggested';
  reason: string | null;      // for 'suggested': "also in CPSC 3230"
  goingTo: string[];          // event ids from events.json
};
export type Profile = {
  name: string; classYear: string; college: string; majors: string[];
  courses: Course[]; clubs: string[]; interests: string[];
  defaultGoal: string;
  home: { name: string; lat: number; lng: number };
  contacts: Contact[];
  connected: { name: string; detail: string }[];
};
export type Stats = { total: number; sources: { name: string; count: number }[]; bakedAt: string };

export type GrokPick = {      // what Grok returns, one JSON line per pick
  eventId: string; score: number;            // 0-100
  lane: 'build'|'feel'|'both';
  mechanismId: string | null;                // required in tonight mode, null in week mode
  why: string;                               // ≤ 110 chars
  friendLine: string | null;                 // ≤ 60 chars
  withContactId: string | null; withWhy: string | null;
  invite: string | null;                     // ≤ 220 chars
};
export type Pick = GrokPick & {  // added by OUR code
  conflict: { courseCode: string } | null;
  walkMin: number; leaveBy: string;          // ISO
  fitNote: string;
};
export type PlanEvent =
  | { type: 'status'; text: string }
  | { type: 'pick'; pick: Pick }
  | { type: 'trajectory'; text: string }
  | { type: 'done'; source: 'live'|'fallback' }
  | { type: 'error'; message: string };

export type PlanRequest = { mode: Mode; goal: string; mood?: Mood; now?: string };

export const PRESET_GOALS: { slug: string; label: string }[] = [
  { slug: 'space', label: 'Break into the space industry' },
  { slug: 'startup', label: 'Start a company before I graduate' },
  { slug: 'research', label: 'Find a research lab in AI' },
  { slug: 'people', label: 'Meet people outside my major' },
];
export const MOODS: Mood[] = ['sad', 'lonely', 'stressed', 'anxious', 'bored', 'tired', 'unmotivated', 'great'];
