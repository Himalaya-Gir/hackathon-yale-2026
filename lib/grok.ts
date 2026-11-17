// Grok client (xAI, OpenAI-compatible chat/completions, SSE streaming) and the parser of its JSON lines.
// Server only: the key is read from process.env and never leaves this file.
import { z } from 'zod';

const BASE = 'https://api.x.ai/v1';

export type GrokCall = {
  model: string; system: string; user: string;
  signal?: AbortSignal; maxTokens?: number; temperature?: number;
  onFirstToken?: () => void;
};

export function fastModel(): string {
  return process.env.XAI_MODEL_FAST || process.env.XAI_MODEL_SMART || 'grok-4.20-0309-non-reasoning';
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
  });

/** Streams the answer and yields it one complete text line at a time. Throws on failure. */
export async function* grokLines(call: GrokCall): AsyncGenerator<string> {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error('XAI_API_KEY missing');
  const body = JSON.stringify({
    model: call.model,
    stream: true,
    temperature: call.temperature ?? 0.5,
    max_tokens: call.maxTokens ?? 1600,
    messages: [{ role: 'system', content: call.system }, { role: 'user', content: call.user }],
  });
  let res: Response | null = null;
  for (const wait of [0, 1000, 2000, 4000]) {
    if (wait) await sleep(wait, call.signal);
    res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body,
      signal: call.signal,
    });
    if (res.status !== 429) break;
  }
  if (!res || !res.ok || !res.body) throw new Error(`Grok HTTP ${res?.status ?? 'no response'}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sse = '';
  let text = '';
  let first = true;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      sse += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = sse.indexOf('\n')) >= 0) {
        const raw = sse.slice(0, nl).trim();
        sse = sse.slice(nl + 1);
        if (!raw.startsWith('data:')) continue;
        const data = raw.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let delta = '';
        try { delta = JSON.parse(data)?.choices?.[0]?.delta?.content ?? ''; } catch { continue; }
        if (!delta) continue;
        if (first) { first = false; call.onFirstToken?.(); }
        text += delta;
        let tn: number;
        while ((tn = text.indexOf('\n')) >= 0) {
          const line = text.slice(0, tn).trim();
          text = text.slice(tn + 1);
          if (line) yield line;
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  if (text.trim()) yield text.trim();
}

// ---------- line parser (trap 5: chatty Grok) ----------

const nullableText = z.union([z.string(), z.null()]).optional().transform((v) => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t && t.toLowerCase() !== 'null' ? t : null;
});

const pickSchema = z.object({
  eventId: z.string().min(1),
  score: z.coerce.number().catch(80),
  lane: z.string().optional(),
  mechanismId: nullableText,
  why: z.string().min(3),
  withContactId: nullableText,
  withWhy: nullableText,
  invite: nullableText,
});
const trajectorySchema = z.object({ trajectory: z.string().min(3) });

export type RawPick = z.infer<typeof pickSchema>;
export type ParsedLine = { kind: 'pick'; pick: RawPick } | { kind: 'trajectory'; text: string } | null;

/** Keeps only lines that start with `{` and pass zod. Everything else is ignored. */
export function parseGrokLine(line: string): ParsedLine {
  const t = line.trim().replace(/,$/, '');
  if (!t.startsWith('{')) return null;
  let obj: unknown;
  try { obj = JSON.parse(t); } catch { return null; }
  const tr = trajectorySchema.safeParse(obj);
  if (tr.success) return { kind: 'trajectory', text: tr.data.trajectory.trim() };
  const pk = pickSchema.safeParse(obj);
  if (pk.success) return { kind: 'pick', pick: pk.data };
  return null;
}
