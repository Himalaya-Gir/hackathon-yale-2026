// Measures both Grok models on the real week prompt: time to first token, first valid pick, total; valid picks.
// Run: ./node_modules/.bin/tsx scripts/bench.ts [runs]
import eventsJson from '../public/data/events.json';
import friendsJson from '../public/data/friends.json';
import profileJson from '../public/data/profile.json';
import { grokLines, parseGrokLine } from '../lib/grok';
import { friendsGoing, preselect } from '../lib/match';
import { systemPrompt, userPrompt } from '../lib/prompts';
import { redateAll } from '../lib/time';
import type { Friend, Mode, Mood, Profile, YaleEvent } from '../lib/types';

process.loadEnvFile('.env.local');

async function run(model: string, mode: Mode, goal: string, mood?: Mood) {
  const ref = new Date();
  const profile = profileJson as unknown as Profile;
  const events = redateAll(eventsJson as unknown as YaleEvent[], ref);
  const going = friendsGoing(friendsJson as unknown as Friend[]);
  const pool = preselect(mode, events, ref, profile, mood);
  const ids = new Set(pool.map((e) => e.id));
  const t0 = Date.now();
  let ttft = 0, firstPick = 0, valid = 0, trajectory = false;
  try {
    for await (const line of grokLines({ model, system: systemPrompt(mode, profile), user: userPrompt({ mode, goal, mood, ref, pool, going }), onFirstToken: () => { ttft = Date.now() - t0; } })) {
      const p = parseGrokLine(line);
      if (p?.kind === 'pick' && ids.has(p.pick.eventId)) { valid++; if (!firstPick) firstPick = Date.now() - t0; }
      if (p?.kind === 'trajectory') trajectory = true;
    }
  } catch (e) {
    console.log(`  ${model} ${mode}: ERROR ${(e as Error).message}`);
    return;
  }
  console.log(`  ${model} ${mode}: pool ${pool.length} · first token ${ttft} ms · first pick ${firstPick} ms · total ${Date.now() - t0} ms · valid picks ${valid}${mode === 'week' ? ` · trajectory ${trajectory}` : ''}`);
}

async function main() {
  const runs = Number(process.argv[2] ?? 3);
  const models = [process.env.XAI_MODEL_FAST, process.env.XAI_MODEL_SMART].filter(Boolean) as string[];
  for (const model of models) {
    for (let i = 0; i < runs; i++) await run(model, 'week', 'Break into the space industry');
    await run(model, 'tonight', 'Break into the space industry', 'stressed');
  }
}
main();
