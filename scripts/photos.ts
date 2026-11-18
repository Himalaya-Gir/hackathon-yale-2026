// Package A1 — real photographs for every sample event (PLAN.md §3).
// NASA Image Library (public domain) and Pexels (free license, credited). No AI images.
// Wikimedia Commons is implemented but this IP is rate-limited, so lifestyle photos come from Pexels.
// Originals are downloaded, then cropped to 1200×675 JPEG quality 80, under 250 KB.
import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import sharp from 'sharp';
import type { YaleEvent } from '../lib/types';

const execFileAsync = promisify(execFile);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const UA = 'campus-events-hackathon/1.0 (yale-orbit; educational hackathon; local photo archive)';
const OUT_DIR = 'public/img/events';
const CACHE = 'scripts/.cache/raw';
const BAD_TITLE = /\b(portrait|headshot|logo|icon|diagram|chart|coat of arms|flag of|screenshot|illustration|illustrated|cartoon|seal of|autograph|signature|engraving|lithograph|woodcut|etching|painting|artwork|rendering|announcement|advertisement)\b|artist'?s concept|computer[- ]generated/i;
const NAMED_PERSON = /^File:[A-Z][a-z]+ [A-Z][a-z]+ (at|in|during|posing|with)\b/;
const MINOR = /\b(teen|teenager|teenagers|child|children|kids|toddler|schoolboy|schoolgirl|elementary)\b/i;

type Slot = { slug: string; nasa?: string[]; wiki?: string[]; pexels?: string[]; reject?: RegExp; prefer?: RegExp };
type Candidate = {
  url: string;
  page: string;
  license: string;
  credit: string;
  origin: 'NASA' | 'Wikimedia Commons' | 'Pexels';
  title: string;
};

const SLOTS: Slot[] = [
  { slug: 'hackathon', wiki: ['hackathon laptops', 'students working on laptops'] },
  { slug: 'teststand', nasa: ['rocket engine test stand', 'rocket engine firing test'] },
  { slug: 'boardgames', wiki: ['people playing board game table', 'board game night friends'] },
  { slug: 'improv', wiki: ['improv comedy theater stage', 'theatre improvisation performance stage'] },
  { slug: 'evening-run', wiki: ['group of people running park path', 'runners on a city path evening'] },
  { slug: 'meditation', wiki: ['group meditation class sitting', 'yoga nidra meditation circle'] },
  { slug: 'acappella', wiki: ['choir singing rehearsal indoors', 'a cappella group singing on stage'] },
  { slug: 'packing', wiki: ['food bank volunteers sorting groceries', 'volunteers packing food boxes'] },
  { slug: 'launch-lunch', wiki: ['university lecture hall students', 'students listening to a lecture classroom'] },
  { slug: 'landing-page', wiki: ['students coding on laptops workshop', 'hackathon laptops close'] },
  { slug: 'yoga', wiki: ['group yoga class studio', 'outdoor yoga class park'] },
  { slug: 'east-rock', wiki: ['East Rock Park New Haven cliff', 'traprock ridge hiking trail'] },
  { slug: 'founder-dinner', wiki: ['dinner conversation around a table', 'people talking over dinner restaurant'] },
  { slug: 'chamber', wiki: ['string quartet concert performance', 'chamber music ensemble on stage'] },
  { slug: 'rl-journal', wiki: ['university seminar students discussion', 'small classroom discussion circle'] },
  { slug: 'pottery', wiki: ['pottery wheel clay hands studio', 'ceramics studio wheel throwing'] },
  { slug: 'jazz', wiki: ['jazz quartet small club performance', 'jazz band playing indoors'] },
  { slug: 'climbing', wiki: ['indoor climbing wall gym', 'bouldering gym people climbing'] },
  { slug: 'grove-walk', wiki: ['tree lined campus walk path', 'elm trees along a street'] },
  { slug: 'poster-tea', wiki: ['scientific conference poster session people', 'students presenting research posters'] },
  { slug: 'wright', nasa: ['particle physics detector laboratory', 'neutrino detector'], wiki: ['physics laboratory equipment'], reject: /ISS|space station|expedition/i },
  { slug: 'stargazing', nasa: ['observatory telescope dome', 'astronomer telescope'], wiki: ['observatory telescope at night', 'people stargazing telescope'], reject: /TRAPPIST|exoplanet|concept|surface of/i },
  { slug: 'ml-reading', wiki: ['students reading together library table', 'study group library wooden table'] },
  { slug: 'pitch', pexels: ['startup founder pitch audience', 'business conference speaker audience'] },
  { slug: 'customers', wiki: ['workshop sticky notes team wall', 'design workshop people sticky notes'] },
  { slug: 'incorporate', wiki: ['small group meeting around documents', 'students in a meeting room discussion'] },
  { slug: 'cubesat', nasa: ['cubesat satellite assembly', 'small satellite cleanroom engineers'] },
  { slug: 'cv-open', pexels: ['scientists working at computers in a laboratory', 'adult engineers in a robotics lab'], prefer: /scientist|engineer|laboratory|researcher/i, reject: /teen|school|kid/i },
  { slug: 'hardware-oh', wiki: ['electronics workbench soldering', 'students electronics lab bench'] },
  { slug: 'terms', wiki: ['seminar room people taking notes', 'classroom workshop discussion adults'] },
  { slug: 'ballroom', wiki: ['ballroom dance class couples', 'waltz dance lesson studio'] },
  { slug: 'nlp-tea', wiki: ['people having tea and conversation', 'seminar coffee break conversation'] },
  { slug: 'orbit', wiki: ['students at a whiteboard physics', 'chalkboard equations classroom people'] },
  { slug: 'robots', nasa: ['student robotics competition', 'robotics laboratory arm'] },
  { slug: 'cofounders', wiki: ['friends breakfast cafe table', 'people talking over coffee breakfast'] },
  { slug: 'usertest', wiki: ['usability testing laptop interview', 'person testing a website on a laptop'] },
  { slug: 'lab-match', pexels: ['scientific poster session conference', 'research conference poster presentation'], prefer: /poster|conference|symposium/i },
  { slug: 'responsible', wiki: ['university auditorium lecture audience', 'seminar audience in a lecture hall'] },
  { slug: 'medimg', wiki: ['MRI scanner room equipment', 'medical imaging laboratory scanner'] },
  { slug: 'policy-lunch', wiki: ['panel discussion at a university', 'panelists at a table with microphones'] },
  { slug: 'research-match', wiki: ['research poster session crowded hall', 'graduate students poster presentation'] },
  { slug: 'yes', wiki: ['brainstorm sticky notes on a wall', 'team ideation workshop whiteboard'] },
  { slug: 'pricing', wiki: ['small workshop classroom adults', 'people in a bright classroom workshop'] },
  { slug: 'trajectory', nasa: ['mission control computer screens', 'flight dynamics console'] },
  { slug: 'cleanroom', nasa: ['cleanroom satellite engineers', 'spacecraft clean room bunny suit'] },
  { slug: 'mirrors', nasa: ['telescope mirror polishing', 'large telescope mirror'] },
  { slug: 'showcase', wiki: ['audience at a startup pitch event', 'demo day audience auditorium'] },
  { slug: 'hai', wiki: ['human computer interaction laboratory', 'usability lab computer users'] },
  { slug: 'gpu', nasa: ['supercomputer machine room', 'data center server racks'], wiki: ['server room computer racks'] },
  { slug: 'safety', nasa: ['student rocket launch', 'model rocket launch pad'] },
  { slug: 'energy', nasa: ['battery laboratory testing', 'lithium battery research lab'], wiki: ['battery research laboratory'] },
  { slug: 'longrun', wiki: ['trail running in the woods', 'people jogging on a forest trail'] },
  { slug: 'organ', wiki: ['pipe organ in a chapel', 'church pipe organ console hall'] },
  { slug: 'sketch', wiki: ['art museum gallery visitors', 'people looking at paintings in a gallery'] },
  { slug: 'biotech', wiki: ['biology laboratory pipettes bench', 'wet lab researchers at a bench'] },
  { slug: 'critique', wiki: ['design studio critique students', 'art school studio review'] },
  { slug: 'language', wiki: ['long communal dinner table friends', 'community dinner long table'] },
  { slug: 'climate-dinner', wiki: ['green building atrium interior', 'sustainable architecture wood interior people'] },
  { slug: 'openmic', wiki: ['open mic acoustic guitar small stage', 'small venue live music audience'] },
  { slug: 'library', wiki: ['grand library reading room students', 'university library reading room tables'] },
];

// Chosen after looking at search results: distinct, adult, and on the activity.
const FORCE: Record<string, Candidate> = {
  'poster-tea': {
    url: 'https://images.pexels.com/photos/2399033/pexels-photo-2399033.jpeg?auto=compress&cs=tinysrgb&w=1800',
    page: 'https://www.pexels.com/photo/2399033/',
    license: 'Pexels License',
    credit: 'Martin Lopez',
    origin: 'Pexels',
    title: 'A researcher presenting findings on a poster at a conference',
  },
  'lab-match': {
    url: 'https://images.pexels.com/photos/1709003/pexels-photo-1709003.jpeg?auto=compress&cs=tinysrgb&w=1800',
    page: 'https://www.pexels.com/photo/1709003/',
    license: 'Pexels License',
    credit: 'ICSA',
    origin: 'Pexels',
    title: 'A full auditorium at a research conference',
  },
};

let wikiChain: Promise<void> = Promise.resolve();
function wikiTurn<T>(fn: () => Promise<T>): Promise<T> {
  const run = wikiChain.then(fn, fn);
  wikiChain = run.then(
    () => sleep(WIKI_GAP_MS),
    () => sleep(WIKI_GAP_MS),
  );
  return run;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const WIKI_GAP_MS = 4500;

function cacheFile(url: string): string {
  return path.join(CACHE, crypto.createHash('sha1').update(url).digest('hex').slice(0, 20));
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

async function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  let wait = 5000;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(40000) });
    if (res.status === 429) {
      console.log(`  429, waiting ${wait}ms`);
      await sleep(wait);
      wait *= 2;
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url.slice(0, 90)}`);
    return res.json();
  }
  throw new Error(`HTTP 429 ${url.slice(0, 90)}`);
}

async function nasaCandidates(query: string): Promise<Candidate[]> {
  const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&year_start=2012`;
  const data = (await getJson(url, { 'User-Agent': UA, Accept: 'application/json' })) as {
    collection?: { items?: { data?: { title?: string; nasa_id?: string; description?: string }[] }[] };
  };
  const out: Candidate[] = [];
  for (const item of data.collection?.items ?? []) {
    const meta = item.data?.[0];
    if (!meta?.nasa_id || !meta.title || BAD_TITLE.test(`${meta.title} ${meta.description ?? ''}`)) continue;
    out.push({
      url: `nasa:${meta.nasa_id}`,
      page: `https://images.nasa.gov/details/${meta.nasa_id}`,
      license: 'public domain',
      credit: 'NASA',
      origin: 'NASA',
      title: meta.title,
    });
    if (out.length >= 8) break;
  }
  return out;
}

async function nasaJpegUrl(nasaId: string): Promise<string | null> {
  const data = (await getJson(`https://images-api.nasa.gov/asset/${encodeURIComponent(nasaId)}`, {
    'User-Agent': UA,
    Accept: 'application/json',
  })) as { collection?: { items?: { href?: string }[] } };
  const hrefs = (data.collection?.items ?? []).map((i) => i.href ?? '').filter((h) => /\.jpe?g($|\?)/i.test(h));
  for (const mark of ['~large', '~orig', '~medium']) {
    const hit = hrefs.find((h) => h.includes(mark));
    if (hit) return hit;
  }
  return hrefs[0] ?? null;
}

async function wikiCandidates(query: string): Promise<Candidate[]> {
  const searchParams = new URLSearchParams({
    action: 'query',
    format: 'json',
    list: 'search',
    srnamespace: '6',
    srlimit: '20',
    srsearch: query,
  });
  const found = (await wikiTurn(() =>
    getJson(`https://commons.wikimedia.org/w/api.php?${searchParams}`, { 'User-Agent': UA, Accept: 'application/json' }),
  )) as { query?: { search?: { title?: string }[] } };
  const titles = (found.query?.search ?? [])
    .map((row) => row.title ?? '')
    .filter((title) => /\.(jpe?g|png)$/i.test(title) && !BAD_TITLE.test(title) && !NAMED_PERSON.test(title))
    .slice(0, 8);
  if (!titles.length) return [];
  const infoParams = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: titles.join('|'),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
  });
  const data = (await wikiTurn(() =>
    getJson(`https://commons.wikimedia.org/w/api.php?${infoParams}`, { 'User-Agent': UA, Accept: 'application/json' }),
  )) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          imageinfo?: {
            url?: string;
            mime?: string;
            width?: number;
            height?: number;
            extmetadata?: Record<string, { value?: string }>;
          }[];
        }
      >;
    };
  };
  const out: Candidate[] = [];
  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    const title = page.title ?? '';
    if (!info?.url || !info.width || !info.height) continue;
    if (info.mime !== 'image/jpeg' && info.mime !== 'image/png') continue;
    if (info.width < 1400 || info.width < info.height * 1.2) continue;
    if (BAD_TITLE.test(title) || NAMED_PERSON.test(title)) continue;
    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value || 'see Commons page') || 'see Commons page';
    const artist = stripHtml(meta.Artist?.value || 'see page') || 'see page';
    const fileTitle = title.replace(/ /g, '_');
    out.push({
      url: info.url,
      page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(fileTitle)}`,
      license,
      credit: artist.slice(0, 180),
      origin: 'Wikimedia Commons',
      title: title.replace(/^File:/, ''),
    });
    if (out.length >= 6) break;
  }
  return out;
}

async function pexelsCandidates(query: string): Promise<Candidate[]> {
  const safe = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
  const cache = path.join('scripts/.cache/pexels', `${safe}.html`);
  let html = '';
  if (fs.existsSync(cache) && fs.statSync(cache).size > 40000) html = fs.readFileSync(cache, 'utf8');
  if (!html.includes('__NEXT_DATA__')) {
    const url = `https://www.pexels.com/search/${encodeURIComponent(query)}/`;
    const { stdout } = await execFileAsync(CHROME, [
      '--headless=new', '--disable-gpu', '--no-first-run',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      '--virtual-time-budget=12000', '--dump-dom', url,
    ], { timeout: 45000, maxBuffer: 25_000_000 });
    html = stdout;
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, html);
  }
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/);
  if (!match) return [];
  const data = JSON.parse(match[1]) as {
    props?: { pageProps?: { initialData?: { data?: { attributes?: Record<string, unknown> }[] } } };
  };
  const photos = data.props?.pageProps?.initialData?.data ?? [];
  const out: Candidate[] = [];
  for (const photo of photos) {
    const a = photo.attributes ?? {};
    const id = a.id;
    const width = Number(a.width);
    const height = Number(a.height);
    if (!id || !width || !height || width < 1400 || width < height * 1.2) continue;
    const title = String(a.alt || a.title || query);
    if (BAD_TITLE.test(title) || MINOR.test(title)) continue;
    const user = (a.user ?? {}) as { first_name?: string; last_name?: string; username?: string };
    const credit = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'the photographer';
    out.push({
      url: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1800`,
      page: `https://www.pexels.com/photo/${id}/`,
      license: 'Pexels License',
      credit,
      origin: 'Pexels',
      title,
    });
    if (out.length >= 5) break;
  }
  return out;
}

let cooldownUntil = 0;

async function download(url: string): Promise<Buffer> {
  const cached = cacheFile(url);
  if (fs.existsSync(cached) && fs.statSync(cached).size > 5000) return fs.readFileSync(cached);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const waitFor = cooldownUntil - Date.now();
    if (waitFor > 0) {
      console.log(`  cooling down ${Math.ceil(waitFor / 1000)}s`);
      await sleep(waitFor);
    }
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'image/jpeg,image/png,image/*;q=0.8' },
      signal: AbortSignal.timeout(90000),
      redirect: 'follow',
    });
    if (res.status === 429) {
      const retryAfter = Math.min(Number(res.headers.get('retry-after') || 90), 240);
      console.log(`  image 429, pausing ${retryAfter}s once`);
      if (attempt > 1) throw new Error('Wikimedia still rate-limiting; stop rather than extend the ban');
      await sleep(retryAfter * 1000 + 3000);
      continue;
    }
    if (!res.ok) throw new Error(`download HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 8000 || buf.length > 40_000_000) throw new Error(`download size ${buf.length}`);
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(cached, buf);
    return buf;
  }
  throw new Error('download HTTP 429');
}

async function toCard(buf: Buffer): Promise<Buffer | null> {
  try {
    const meta = await sharp(buf, { failOn: 'none' }).rotate().metadata();
    if (!meta.width || !meta.height) return null;
    if (meta.width < 1200 || meta.height < 700) return null;
    if (meta.width < meta.height * 1.15) return null;
    let quality = 80;
    let out = await sharp(buf, { failOn: 'none' })
      .rotate()
      .resize(1200, 675, { fit: 'cover', position: 'attention' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    while (out.length > 250 * 1024 && quality > 46) {
      quality -= 8;
      out = await sharp(buf, { failOn: 'none' })
        .rotate()
        .resize(1200, 675, { fit: 'cover', position: 'attention' })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
    }
    if (out.length >= 250 * 1024 || out.length < 8000) return null;
    const check = await sharp(out).metadata();
    if ((check.width ?? 0) < 1200 || (check.height ?? 0) < 675 || check.format !== 'jpeg') return null;
    return out;
  } catch {
    return null;
  }
}

async function candidatesFor(slot: Slot): Promise<Candidate[]> {
  const found: Candidate[] = [];
  for (const q of slot.nasa ?? []) {
    if (found.length >= 4) break;
    try {
      found.push(...(await nasaCandidates(q)));
    } catch (err) {
      console.log(`  nasa search failed (${slot.slug}):`, err instanceof Error ? err.message : err);
    }
  }
  for (const q of slot.pexels ?? slot.wiki ?? []) {
    if (found.length >= 4) break;
    try {
      found.push(...(await pexelsCandidates(q)));
    } catch (err) {
      console.log(`  pexels search failed (${slot.slug}):`, err instanceof Error ? err.message : err);
    }
  }
  return found.slice(0, 8);
}

async function materialize(c: Candidate): Promise<{ buf: Buffer; resolved: Candidate } | null> {
  try {
    let url = c.url;
    const resolved = { ...c };
    if (url.startsWith('nasa:')) {
      const jpeg = await nasaJpegUrl(url.slice(5));
      if (!jpeg) return null;
      url = jpeg;
      resolved.url = jpeg;
    }
    const buf = c.origin === 'Wikimedia Commons' ? await wikiTurn(() => download(url)) : await download(url);
    const card = await toCard(buf);
    if (!card) console.log(`  unusable ${c.title.slice(0, 60)}`);
    return card ? { buf: card, resolved } : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('rate-limiting')) throw err;
    console.log(`  skip ${c.title.slice(0, 50)}: ${msg.slice(0, 80)}`);
    return null;
  }
}

function xml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function contactSheet(items: { file: string; slug: string; title: string }[]) {
  const cols = 6;
  const cw = 280;
  const ch = 196;
  const cells: Buffer[] = [];
  for (const item of items) {
    const photo = await sharp(item.file).resize(280, 158, { fit: 'cover' }).jpeg().toBuffer();
    const label = Buffer.from(
      `<svg width="280" height="38" xmlns="http://www.w3.org/2000/svg"><rect width="280" height="38" fill="#111"/><text x="6" y="16" fill="#fff" font-size="11" font-family="sans-serif">${xml(item.title.slice(0, 40))}</text><text x="6" y="32" fill="#9ab" font-size="10" font-family="sans-serif">${xml(item.slug)}</text></svg>`,
    );
    cells.push(
      await sharp({ create: { width: cw, height: ch, channels: 3, background: '#111111' } })
        .composite([
          { input: photo, top: 0, left: 0 },
          { input: label, top: 158, left: 0 },
        ])
        .jpeg()
        .toBuffer(),
    );
  }
  const rows = Math.ceil(cells.length / cols);
  await sharp({
    create: { width: cols * cw, height: rows * ch, channels: 3, background: '#111111' },
  })
    .composite(cells.map((input, i) => ({ input, left: (i % cols) * cw, top: Math.floor(i / cols) * ch })))
    .jpeg({ quality: 72 })
    .toFile('scripts/.cache/contact-sheet.jpg');
  console.log('contact sheet scripts/.cache/contact-sheet.jpg');
}

async function main() {
  const events = JSON.parse(fs.readFileSync('public/data/events.json', 'utf8')) as YaleEvent[];
  const bySlug = new Map(SLOTS.map((s) => [s.slug, s]));
  const needed = events.map((e) => ({
    slug: e.photoUrl.replace('/img/events/', '').replace(/\.jpg$/, ''),
    title: e.title,
  }));
  for (const n of needed) {
    if (!bySlug.has(n.slug)) throw new Error(`no photo slot for ${n.slug}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync('scripts/.cache', { recursive: true });
  const only = new Set((process.env.ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  if (!only.size) {
    for (const f of fs.readdirSync(OUT_DIR)) {
      if (f.endsWith('.jpg')) fs.unlinkSync(path.join(OUT_DIR, f));
    }
  }

  const credits = ['# Photo credits', '', 'Every image in `public/img/events/` is a real photograph, stored locally. No AI-generated images.', ''];
  const hashes = new Set<string>();
  const usedUrls = new Set<string>();
  const sheet: { file: string; slug: string; title: string }[] = [];
  const picks: { slug: string; title: string; sourceTitle: string; page: string; url: string }[] = [];

  // Resolve a few slots at a time so a stall does not freeze the whole run.
  const queue = needed.filter((n) => !only.size || only.has(n.slug));
  const workers = 1;
  async function worker() {
    for (;;) {
      const job = queue.shift();
      if (!job) return;
      const slot = bySlug.get(job.slug)!;
      process.stdout.write(`photo ${job.slug}\n`);
      const options = [...(FORCE[job.slug] ? [FORCE[job.slug]] : []), ...(await candidatesFor(slot))];
      if (!options.length) console.log(`  no candidates for ${job.slug}`);
      let saved = false;
      for (const c of options) {
        if (usedUrls.has(c.url)) continue;
        if (slot.reject?.test(`${c.title} ${c.url}`)) continue;
        if (slot.prefer && !slot.prefer.test(c.title)) continue;
        const made = await materialize(c);
        if (!made) continue;
        const hash = crypto.createHash('sha256').update(made.buf).digest('hex');
        if (hashes.has(hash) || usedUrls.has(made.resolved.url)) continue;
        hashes.add(hash);
        usedUrls.add(c.url);
        usedUrls.add(made.resolved.url);
        const file = path.join(OUT_DIR, `${job.slug}.jpg`);
        fs.writeFileSync(file, made.buf);
        const kb = Math.round(made.buf.length / 1024);
        console.log(`  ok ${job.slug} ${kb}KB — ${made.resolved.title.slice(0, 70)}`);
        const safeTitle = made.resolved.title.replace(/"/g, "'").replace(/\|/g, '/');
        const who = made.resolved.origin === 'NASA'
          ? `NASA, "${safeTitle}" (${c.url.replace('nasa:', '')}), public domain`
          : made.resolved.origin === 'Pexels'
            ? `Pexels, "${safeTitle}", ${made.resolved.license}, by ${made.resolved.credit}`
            : `Wikimedia Commons, ${safeTitle}, ${made.resolved.license}, by ${made.resolved.credit}`;
        credits.push(`- \`${job.slug}.jpg\` — ${who}. ${made.resolved.page}`);
        sheet.push({ file, slug: job.slug, title: job.title });
        picks.push({ slug: job.slug, title: job.title, sourceTitle: made.resolved.title, page: made.resolved.page, url: made.resolved.url });
        saved = true;
        break;
      }
      if (!saved) console.log(`  MISS ${job.slug}`);
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()));

  const missing = needed.filter((n) => !fs.existsSync(path.join(OUT_DIR, `${n.slug}.jpg`)));
  if (only.size && fs.existsSync('public/img/CREDITS.md')) {
    const kept = fs.readFileSync('public/img/CREDITS.md', 'utf8').split('\n').filter((line) => ![...only].some((slug) => line.startsWith(`- \`${slug}.jpg\``)));
    const added = credits.filter((line) => line.startsWith('- `'));
    fs.writeFileSync('public/img/CREDITS.md', [...kept.filter((line, i, arr) => line !== '' || arr[i - 1] !== ''), ...added, ''].join('\n'));
  } else {
    fs.writeFileSync('public/img/CREDITS.md', credits.join('\n') + '\n');
  }
  fs.writeFileSync('scripts/.cache/photo-picks.json', JSON.stringify(picks, null, 2));
  const fullSheet = needed
    .filter((n) => fs.existsSync(path.join(OUT_DIR, `${n.slug}.jpg`)))
    .map((n) => ({ file: path.join(OUT_DIR, `${n.slug}.jpg`), slug: n.slug, title: n.title }));
  if (fullSheet.length) await contactSheet(fullSheet);
  if (missing.length) {
    throw new Error(`missing photos: ${missing.map((m) => m.slug).join(', ')}`);
  }
  console.log(`photos ${needed.length}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
