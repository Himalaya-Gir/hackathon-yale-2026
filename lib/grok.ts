// Grok client (xAI via the OpenAI SDK, chat/completions, SSE) and the parser of its JSON lines.
// Server only: the key is read from process.env inside the call and never leaves this file.
// Model ids come only from XAI_MODEL_FAST and XAI_MODEL_SMART. Nothing is hard-coded.
import OpenAI from 'openai';
import { z } from 'zod';

const BASE_URL = 'https://api.x.ai/v1';

export type GrokCall = {
  model: string; system: string; user: string;
  signal?: AbortSignal; maxTokens?: number; temperature?: number;
  onFirstToken?: () => void;
};

export function fastModel(): string | null {
  const m = process.env.XAI_MODEL_FAST?.trim();
  return m || null;
}

export function smartModel(): string | null {
  const m = process.env.XAI_MODEL_SMART?.trim();
  return m || null;
}

function client(): OpenAI {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('XAI_API_KEY missing');
  return new OpenAI({ apiKey, baseURL: BASE_URL });
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('aborted')); return; }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
  });

function statusOf(e: unknown): number {
  if (e instanceof OpenAI.APIError) return e.status ?? 0;
  if (typeof e === 'object' && e && 'status' in e && typeof (e as { status: unknown }).status === 'number') {
    return (e as { status: number }).status;
  }
  return 0;
}

/** Streams the answer and yields it one complete text line at a time. Throws on failure. Retries HTTP 429. */
export async function* grokLines(call: GrokCall): AsyncGenerator<string> {
  if (!call.model) throw new Error('model missing');
  const openai = client();
  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> | null = null;
  let lastStatus = 0;
  for (const wait of [0, 1000, 2000, 4000]) {
    if (wait) await sleep(wait, call.signal);
    try {
      stream = await openai.chat.completions.create({
        model: call.model,
        stream: true,
        temperature: call.temperature ?? 0.4,
        max_tokens: call.maxTokens ?? 1800,
        messages: [
          { role: 'system', content: call.system },
          { role: 'user', content: call.user },
        ],
      }, { signal: call.signal });
      break;
    } catch (e) {
      lastStatus = statusOf(e);
      if (lastStatus === 429) continue;
      throw e;
    }
  }
  if (!stream) throw new Error(`Grok HTTP ${lastStatus || 429}`);

  let text = '';
  let first = true;
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    const delta = typeof content === 'string' ? content : '';
    if (!delta) continue;
    if (first) { first = false; call.onFirstToken?.(); }
    text += delta;
    let nl: number;
    while ((nl = text.indexOf('\n')) >= 0) {
      const line = text.slice(0, nl).trim();
      text = text.slice(nl + 1);
      if (line) yield line;
    }
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
  friendLine: nullableText,
  withContactId: nullableText,
  withWhy: nullableText,
  invite: nullableText,
});
const trajectorySchema = z.object({ trajectory: z.string().min(3) });

export type RawPick = z.infer<typeof pickSchema>;
export type ParsedLine = { kind: 'pick'; pick: RawPick } | { kind: 'trajectory'; text: string } | null;

/** Keeps only lines that start with `{` and pass zod. Everything else is ignored. */
export function parseGrokLine(line: string): ParsedLine {
  let t = line.trim().replace(/^\uFEFF/, '');
  if (t.startsWith('```')) return null;
  t = t.replace(/,$/, '').replace(/`+$/, '').trim();
  if (!t.startsWith('{')) return null;
  let obj: unknown;
  try { obj = JSON.parse(t); } catch { return null; }
  if (obj && typeof obj === 'object' && 'eventId' in obj) {
    const pk = pickSchema.safeParse(obj);
    if (pk.success) return { kind: 'pick', pick: pk.data };
    return null;
  }
  const tr = trajectorySchema.safeParse(obj);
  if (tr.success) return { kind: 'trajectory', text: tr.data.trajectory.trim() };
  return null;
}
