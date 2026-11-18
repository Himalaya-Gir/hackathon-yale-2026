// Newsletters already delivered to the personal mailbox (mail-tool on capServ, read-only).
// A public event is emitted only when one paragraph has a date, a clock time, and a public URL,
// and the paragraph is not an application deadline. Message bodies stay on the server.
import { spawn } from 'child_process';
import type { EventSourceAdapter, RawEvent } from './types';

const REMOTE = String.raw`
import json, re, subprocess
def run(args):
    return subprocess.check_output(args, text=True, errors="replace")

search = run(["mail-tool", "search", "perso", "newer_than:21d subject:newsletter", "12"])
uids = []
for line in search.splitlines():
    m = re.search(r"\[(\d+)\]", line)
    if not m:
        continue
    low = line.lower()
    if "makehaven" in low:
        continue
    if not any(k in low for k in ("yale", "tsai", "new haven", "luma", "city newsletter")):
        continue
    uids.append(m.group(1))

months = {name: i for i, name in enumerate(["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"], 1)}
date_re = re.compile(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?", re.I)
time_re = re.compile(r"\b(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)\b", re.I)
url_re = re.compile(r"https?://[^\s<>()]+", re.I)
skip_re = re.compile(r"\b(apply|deadline|affiliation|closes|expire|unsubscribe)\b", re.I)
events = []
seen = set()
read = uids[:6]
for uid in read:
    body = run(["mail-tool", "read", "perso", uid])
    subj = ""
    for line in body.splitlines():
        if line.lower().startswith("sujet:") or line.lower().startswith("subject:"):
            subj = line.split(":", 1)[1].strip()
            break
    for para in re.split(r"\n\s*\n", body):
        if skip_re.search(para):
            continue
        dm = date_re.search(para)
        tm = time_re.search(para)
        um = url_re.search(para)
        if not (dm and tm and um):
            continue
        url = um.group(0).rstrip(").,]}>\"'")
        if any(b in url for b in ("kit-mail", "safelinks", "unsubscribe", "list-manage", "click.")):
            continue
        month = months[dm.group(1)[:3].lower()]
        day = int(dm.group(2))
        year = int(dm.group(3) or 2026)
        hour = int(tm.group(1))
        minute = int(tm.group(2) or 0)
        ap = tm.group(3).lower().replace(".", "")
        if ap == "pm" and hour < 12:
            hour += 12
        if ap == "am" and hour == 12:
            hour = 0
        title = re.sub(r"\s+", " ", subj)[:80] or "Newsletter event"
        key = (title.lower(), year, month, day, hour, minute)
        if key in seen:
            continue
        seen.add(key)
        events.append({
            "title": title,
            "start": f"{year:04d}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:00-05:00",
            "url": url,
            "location": "New Haven",
        })
print(json.dumps({"messages": len(read), "events": events}))
`;

function remoteExtract(): Promise<{ messages: number; events: { title: string; start: string; url: string; location: string }[] }> {
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', ['-o', 'ConnectTimeout=12', '-o', 'BatchMode=yes', 'cap-server', 'python3', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('newsletter ssh timed out'));
    }, 70000);
    child.stdout.on('data', (b) => { out += b.toString(); });
    child.stderr.on('data', (b) => { err += b.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(err.trim().slice(0, 200) || `ssh exit ${code}`));
        return;
      }
      try { resolve(JSON.parse(out)); }
      catch { reject(new Error('newsletter parser returned no JSON')); }
    });
    child.stdin.end(REMOTE);
  });
}

export const newslettersAdapter: EventSourceAdapter = {
  id: 'newsletter',
  label: 'Newsletters Yale (boîte perso, lecture seule)',
  async fetch(days: number): Promise<RawEvent[]> {
    const parsed = await remoteExtract();
    console.log(`newsletter: ${parsed.messages} messages lus, ${parsed.events.length} séances datées`);
    const now = Date.now();
    const until = now + days * 864e5;
    return parsed.events
      .filter((e) => {
        const t = new Date(e.start).getTime();
        return t > now && t <= until;
      })
      .map((e) => ({
        source: 'newsletter',
        sourceUrl: e.url,
        title: e.title,
        start: e.start,
        end: null,
        locationRaw: e.location,
        descriptionRaw: '',
        host: null,
        photoRaw: null,
      }));
  },
};
