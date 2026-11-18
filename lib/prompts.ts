// Prompts for /api/plan (PLAN.md §9 package C, step 5). Grok chooses and explains; code asserts every fact.
import { allowedMechanisms } from './match';
import { nyWeekday } from './schedule';
import { TZ, fmtDay, fmtTime } from './time';
import type { Mode, Mood, Profile, YaleEvent } from './types';

const MOOD_NOTE: Record<Mood, string> = {
  sad: 'feels low tonight',
  lonely: 'feels a bit alone tonight',
  stressed: 'is under a lot of pressure',
  anxious: 'feels on edge tonight',
  bored: 'is bored and wants something different',
  tired: 'is low on energy',
  unmotivated: 'cannot get started on anything',
  great: 'feels great and has energy to share',
};

function profileJson(profile: Profile): string {
  return JSON.stringify({
    name: profile.name, classYear: profile.classYear, college: profile.college, majors: profile.majors,
    courses: profile.courses.map((c) => ({ code: c.code, title: c.title })),
    clubs: profile.clubs, interests: profile.interests,
    contacts: profile.contacts.map((c) => ({ id: c.id, name: c.name, relation: c.relation, via: c.via, metWhen: c.metWhen, persona: c.persona, interests: c.interests })),
  });
}

function when(e: YaleEvent, ref: Date): string {
  const d = fmtDay(e.start, ref);
  const wd = nyWeekday(new Date(e.start));
  const date = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' }).format(new Date(e.start));
  return `${d === wd ? `${wd} ${date}` : d.toLowerCase()} ${fmtTime(e.start)}`;
}

const clean = (s: string) => s.replace(/[|\n\r]+/g, ' ').trim();

export function eventLine(e: YaleEvent, ref: Date, going: Map<string, string[]>, mood?: Mood): string {
  const cols = [
    e.id, when(e, ref), clean(e.title), clean(e.locationName),
    `${e.tracks.join(',')}${e.future ? ' FUTURE' : ''}`, e.kinds.join(','),
    going.get(e.id)?.join(', ') || '-', clean(e.summary),
  ];
  if (mood) cols.push(allowedMechanisms(e, mood).join(','));
  return cols.join(' | ');
}

const COMMON = `- eventId: copied exactly from the EVENTS list. Never invent one. Never use the same event twice.
- why (max 110 characters): ONE natural sentence that starts with a capital letter and speaks to the student as "you" (example of form only: "Your CPSC 3230 systems work is exactly what this team needs on its flight computer."). Name ONE precise element of the profile (a course code such as CPSC 3230, a club, or a contact's first name)%WHY%. Forbidden phrases: "great opportunity", "aligns with your interests", "perfect for".
- friendLine (max 60 characters): only first names that appear in that event's "friends going" column, or null. Never name anyone who is not on that line.
- withContactId: the contact for whom this event is a good reason to meet again; prefer contacts with relation "new". The same contact at most twice. withWhy (max 80 characters): one short sentence, capitalized, on why this person, from their persona. invite (max 220 characters): a short natural text the student would send, first person, student tone, names the event, the day (written naturally: "tonight", "tomorrow", "on Thursday"; no parentheses) and the exact time as listed. No emoji, no emoji runs, no sales tone. If nobody fits, all three are null.`;

export function systemPrompt(mode: Mode, profile: Profile): string {
  const head = `You are Orbit's planning engine for one Yale student. You are not a chat assistant: you output JSON lines only. No prose, no markdown, no code fences, no blank lines.

STUDENT (JSON):
${profileJson(profile)}
`;
  if (mode === 'week') {
    return `${head}
TASK: from the EVENTS list, choose the 6 events that best move this student toward their long-term GOAL this week, best first.

OUTPUT: exactly 6 lines, each one compact JSON object on a single line, best first:
{"eventId":"<id>","score":<0-100>,"lane":"build","mechanismId":null,"why":"...","friendLine":"..."|null,"withContactId":"<contact id>"|null,"withWhy":"..."|null,"invite":"..."|null}
then one last line: {"trajectory":"..."}

RULES
${COMMON.replace('%WHY%', ' and tie it to the GOAL')}
- The six together read as a path toward the GOAL: mix learning, building and meeting people; at most 2 events on the same day; at least 1 unexpected pick outside the student's majors that still serves the GOAL; at least 2 events marked FUTURE when they exist.
- Different goals must give visibly different plans: rank by the GOAL first, the profile second.
- lane is always "build". mechanismId is always null.
- trajectory: one line, STRICTLY at most 160 characters, in this form: "This week: … This semester: … After Yale: …". What this week sets up for the semester and after Yale. Short concrete phrases, no event list.`;
  }
  return `${head}
TASK: "What should I do tonight?" From the EVENTS list, choose 3 things this student could do tonight (or tomorrow if tonight is thin), best first. Each one works through a research-backed mechanism for how the student feels.

OUTPUT: exactly 3 lines, each one compact JSON object on a single line. No trajectory line. No other text.
{"eventId":"<id>","score":<0-100>,"lane":"feel"|"both","mechanismId":"<id>","why":"...","friendLine":"..."|null,"withContactId":"<contact id>"|null,"withWhy":"..."|null,"invite":"..."|null}

RULES
${COMMON.replace('%WHY%', ' when it fits naturally, and say concretely what the evening will be like')}
- mechanismId: copy an id from the "allowed mechanisms" column of THAT event. Never invent one and never use a kind name (build, learn, move) unless that exact id is in the column. The 3 lines must use 3 different ids. If the events that best match the GOAL all share one id, swap one of them for an event whose column lists a different id.
- lane: "both" when the event also serves the long-term GOAL (prefer those), otherwise "feel".
- Prefer events happening tonight, then tomorrow.
- Tact: never name the mood, never write "since you are sad" or "since you are…", "to cheer you up", "depression", or anything clinical or dramatic. Sound like a thoughtful friend proposing a plan.
- If the student feels low or alone: events with friends going come first, and every pick has a withContactId and an invite.
- If the student feels on edge: prefer small groups over big crowds.
- If the student feels great: propose things to bring someone along to, or that push the GOAL.`;
}

export function userPrompt(args: { mode: Mode; goal: string; mood?: Mood; ref: Date; pool: YaleEvent[]; going: Map<string, string[]> }): string {
  const { mode, goal, mood, ref, pool, going } = args;
  const nowText = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(ref);
  const tonight = mode === 'tonight' && mood;
  const header = `id | when | title | place | tracks | kinds | friends going | summary${tonight ? ' | allowed mechanisms' : ''}`;
  return `GOAL: ${goal}
${tonight ? `TONIGHT: the student ${MOOD_NOTE[mood]}.\n` : ''}NOW: ${nowText} (New York)

EVENTS (${header}):
${pool.map((e) => eventLine(e, ref, going, tonight ? mood : undefined)).join('\n')}`;
}
