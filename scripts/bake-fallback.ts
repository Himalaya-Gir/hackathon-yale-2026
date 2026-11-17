// Records Grok's answers for the 4 preset goals and the 8 moods by calling the real /api/plan route.
// Picks store event ids (and the text Grok wrote), not walking times, so they stay valid when sample events are re-dated.
// A failed live call does not overwrite a file that already has picks.
// Run: ./node_modules/.bin/tsx scripts/bake-fallback.ts
import fs from 'node:fs';
import { POST } from '../app/api/plan/route';
import type { GrokPick, Mood, PlanEvent } from '../lib/types';

try { process.loadEnvFile('.env.local'); } catch { /* missing file: treated as no key */ }

const GOALS: [string, string][] = [
  ['space', 'Break into the space industry'],
  ['startup', 'Start a company before I graduate'],
  ['research', 'Find a research lab in AI'],
  ['people', 'Meet people outside my major'],
];
const MOODS: Mood[] = ['sad', 'lonely', 'stressed', 'anxious', 'bored', 'tired', 'unmotivated', 'great'];
const TONIGHT_GOAL = 'Break into the space industry';

function slim(pick: Extract<PlanEvent, { type: 'pick' }>['pick']): GrokPick {
  return {
    eventId: pick.eventId,
    score: pick.score,
    lane: pick.lane,
    mechanismId: pick.mechanismId,
    why: pick.why,
    friendLine: pick.friendLine,
    withContactId: pick.withContactId,
    withWhy: pick.withWhy,
    invite: pick.invite,
  };
}

async function call(body: unknown): Promise<{ source: string; picks: GrokPick[]; trajectory: string | null }> {
  const req = new Request('http://localhost/api/plan?live=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  const text = await res.text();
  const picks: GrokPick[] = [];
  let trajectory: string | null = null;
  let source = 'fallback';
  for (const line of text.split('\n')) {
    if (!line.startsWith('{')) continue;
    let ev: PlanEvent;
    try { ev = JSON.parse(line) as PlanEvent; } catch { continue; }
    if (ev.type === 'pick') picks.push(slim(ev));
    else if (ev.type === 'trajectory') trajectory = ev.text;
    else if (ev.type === 'done') source = ev.source;
  }
  return { source, picks, trajectory };
}

function writeIfLive(file: string, result: { source: string; picks: GrokPick[]; trajectory: string | null }, min: number, needTrajectory: boolean) {
  const good = result.source === 'live' && result.picks.length >= min && (!needTrajectory || Boolean(result.trajectory));
  if (!good) {
    console.log(`kept ${file} · source ${result.source} · picks ${result.picks.length}`);
    return;
  }
  const body = { picks: result.picks, trajectory: needTrajectory ? result.trajectory : null, bakedAt: new Date().toISOString() };
  fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
  console.log(`wrote ${file} · ${result.picks.length} picks · live`);
}

async function main() {
  if (!process.env.XAI_API_KEY) {
    console.log('XAI_API_KEY missing — bake skipped, recorded fallback files left untouched');
    return;
  }
  const events = JSON.parse(fs.readFileSync('public/data/events.json', 'utf8')) as unknown;
  if (!Array.isArray(events) || events.length === 0) {
    console.log('no events — bake skipped');
    return;
  }
  for (const [slug, goal] of GOALS) {
    const result = await call({ mode: 'week', goal });
    writeIfLive(`public/data/fallback/week-${slug}.json`, result, 4, true);
  }
  for (const mood of MOODS) {
    const result = await call({ mode: 'tonight', goal: TONIGHT_GOAL, mood });
    writeIfLive(`public/data/fallback/tonight-${mood}.json`, result, 2, false);
  }
}

main();
