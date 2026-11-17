// Recorded Grok answers (PLAN.md §2 principle 2). Imported statically so they ship with the server bundle on Vercel.
// Written by `./node_modules/.bin/tsx scripts/bake-fallback.ts`. Picks store event ids only.
import type { GrokPick } from '@/lib/types';
import weekSpace from './week-space.json';
import weekStartup from './week-startup.json';
import weekResearch from './week-research.json';
import weekPeople from './week-people.json';
import tonightSad from './tonight-sad.json';
import tonightLonely from './tonight-lonely.json';
import tonightStressed from './tonight-stressed.json';
import tonightAnxious from './tonight-anxious.json';
import tonightBored from './tonight-bored.json';
import tonightTired from './tonight-tired.json';
import tonightUnmotivated from './tonight-unmotivated.json';
import tonightGreat from './tonight-great.json';

export type Recorded = { picks: GrokPick[]; trajectory: string | null; bakedAt: string | null };

export const FALLBACKS: Record<string, Recorded> = {
  'week-space': weekSpace,
  'week-startup': weekStartup,
  'week-research': weekResearch,
  'week-people': weekPeople,
  'tonight-sad': tonightSad,
  'tonight-lonely': tonightLonely,
  'tonight-stressed': tonightStressed,
  'tonight-anxious': tonightAnxious,
  'tonight-bored': tonightBored,
  'tonight-tired': tonightTired,
  'tonight-unmotivated': tonightUnmotivated,
  'tonight-great': tonightGreat,
} as unknown as Record<string, Recorded>;
