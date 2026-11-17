// Measures grok-4.7 vs grok-4.20-0309-non-reasoning on the real week prompt.
// 3 runs each: time to first token, first valid pick, total. Writes the winner to .env.local as XAI_MODEL_FAST only.
// Run: ./node_modules/.bin/tsx scripts/bench.ts
import fs from 'node:fs';
import eventsJson from '../public/data/events.json';
import friendsJson from '../public/data/friends.json';
import profileJson from '../public/data/profile.json';
import { grokLines, parseGrokLine } from '../lib/grok';
import { friendsGoing, preselect } from '../lib/match';
import { systemPrompt, userPrompt } from '../lib/prompts';
import { redateAll } from '../lib/time';
import type { Friend, Profile, YaleEvent } from '../lib/types';

const MODELS = ['grok-4.7', 'grok-4.20-0309-non-reasoning'] as const;
const GOAL = 'Break into the space industry';
const RUNS = 3;

try { process.loadEnvFile('.env.local'); } catch { /* missing file: treated as no key */ }

type Run = { model: string; ttft: number; firstPick: number; total: number; valid: number; trajectory: boolean; error?: string };

function median(xs: number[]): number {
  if (xs.length === 0) return Number.POSITIVE_INFINITY;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}

async function once(model: string): Promise<Run> {
  const ref = new Date();
  const profile = profileJson as unknown as Profile;
  const events = redateAll(eventsJson as unknown as YaleEvent[], ref);
  const going = friendsGoing(friendsJson as unknown as Friend[]);
  const pool = preselect('week', events, ref, profile);
  const ids = new Set(pool.map((e) => e.id));
  const t0 = Date.now();
  let ttft = 0;
  let firstPick = 0;
  let valid = 0;
  let trajectory = false;
  try {
    for await (const line of grokLines({
      model,
      system: systemPrompt('week', profile),
      user: userPrompt({ mode: 'week', goal: GOAL, ref, pool, going }),
      onFirstToken: () => { if (!ttft) ttft = Date.now() - t0; },
    })) {
      const p = parseGrokLine(line);
      if (p?.kind === 'pick' && ids.has(p.pick.eventId)) {
        valid++;
        if (!firstPick) firstPick = Date.now() - t0;
      }
      if (p?.kind === 'trajectory') trajectory = true;
    }
  } catch (e) {
    const status = typeof e === 'object' && e && 'status' in e ? String((e as { status: unknown }).status) : '';
    return { model, ttft, firstPick, total: Date.now() - t0, valid, trajectory, error: `${(e as Error).name || 'Error'}${status ? ` ${status}` : ''}` };
  }
  return { model, ttft, firstPick, total: Date.now() - t0, valid, trajectory };
}

/** Replaces only the XAI_MODEL_FAST line. Leaves the key and every other variable untouched. */
function writeFast(model: string) {
  const path = '.env.local';
  let text = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
  if (/^XAI_MODEL_FAST=.*$/m.test(text)) text = text.replace(/^XAI_MODEL_FAST=.*$/m, `XAI_MODEL_FAST=${model}`);
  else text = `${text.replace(/\s*$/, '')}\nXAI_MODEL_FAST=${model}\n`;
  if (!text.endsWith('\n')) text += '\n';
  fs.writeFileSync(path, text);
}

async function main() {
  if (!process.env.XAI_API_KEY) {
    console.log('XAI_API_KEY missing — live bench skipped');
    return;
  }
  const runs: Run[] = [];
  for (const model of MODELS) {
    for (let i = 0; i < RUNS; i++) {
      const r = await once(model);
      runs.push(r);
      if (r.error) console.log(`  ${model} run ${i + 1}: ERROR ${r.error}`);
      else console.log(`  ${model} run ${i + 1}: first token ${r.ttft} ms · first pick ${r.firstPick} ms · total ${r.total} ms · valid ${r.valid} · trajectory ${r.trajectory}`);
    }
  }
  const scored = MODELS.map((model) => {
    const ok = runs.filter((r) => r.model === model && !r.error && r.valid >= 4 && r.trajectory && r.ttft > 0);
    return { model, ok: ok.length, ttft: median(ok.map((r) => r.ttft)), total: median(ok.map((r) => r.total)) };
  }).filter((s) => s.ok > 0);
  if (scored.length === 0) {
    console.log('No model returned 4 valid picks and a trajectory. XAI_MODEL_FAST left unchanged.');
    return;
  }
  scored.sort((a, b) => a.ttft - b.ttft || a.total - b.total);
  const winner = scored[0].model;
  writeFast(winner);
  console.log(`winner ${winner} · median first token ${Math.round(scored[0].ttft)} ms · correct runs ${scored[0].ok}/${RUNS}`);
  console.log(`XAI_MODEL_FAST=${winner}`);
}

main();
