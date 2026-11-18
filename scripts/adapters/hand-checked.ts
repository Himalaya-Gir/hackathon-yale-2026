// Hand-checked New Haven / Yale events already verified in the local radar log.
// Source: ~/second-cerveau/Organisation/Événements proposés.md
// Table rows only. Official events.yale.edu rows are left to the Yale calendar adapter.
import fs from 'fs';
import type { EventSourceAdapter, RawEvent } from './types';

const FILE = `${process.env.HOME}/second-cerveau/Organisation/Événements proposés.md`;

const DATE_RE = /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})$/;

function stripEmoji(text: string) {
  return text.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim();
}

function clip(text: string, max: number) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–-]+$/, '')}…`;
}

function nyOffset(year: number, month: number, day: number) {
  const probe = new Date(Date.UTC(year, month - 1, day, 16, 0, 0));
  const tz = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).format(probe);
  return tz.includes('EDT') ? '-04:00' : '-05:00';
}

function hostFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const named: Record<string, string> = {
      'luma.com': 'Luma',
      'jazzhaven.org': 'Jazz Haven',
      'nhfpl.libcal.com': 'New Haven Free Public Library',
      'schwarzman.yale.edu': 'Yale Schwarzman Center',
      'www.institutelibrary.org': 'Institute Library',
      'institutelibrary.org': 'Institute Library',
      'britishart.yale.edu': 'Yale Center for British Art',
      'peabody.yale.edu': 'Yale Peabody Museum',
      'yalebulldogs.com': 'Yale Athletics',
      'firehouse12.com': 'Firehouse 12',
      'www.shubert.com': 'Shubert Theatre',
      'shubert.com': 'Shubert Theatre',
    };
    return named[host] ?? null;
  } catch {
    return null;
  }
}

function skippedOfficial(url: string) {
  return /events\.yale\.edu|makehaven\.org/i.test(url);
}

type Section = { year: number; month: number; day: number };

function resolveYear(section: Section, month: number, day: number) {
  const same = Date.UTC(section.year, month - 1, day);
  const anchor = Date.UTC(section.year, section.month - 1, section.day);
  if (same < anchor - 60 * 864e5) return section.year + 1;
  return section.year;
}

export const handCheckedAdapter: EventSourceAdapter = {
  id: 'hand-checked',
  label: 'Événements proposés (vérifiés)',
  async fetch(days: number): Promise<RawEvent[]> {
    const text = fs.readFileSync(FILE, 'utf8');
    const now = Date.now();
    const until = now + days * 864e5;
    const out: RawEvent[] = [];
    let section: Section = { year: 2026, month: 11, day: 1 };
    let skippedYale = 0;

    for (const line of text.split('\n')) {
      const heading = line.match(/^###\s+(\d{4})-(\d{2})-(\d{2})\b/);
      if (heading) {
        section = { year: Number(heading[1]), month: Number(heading[2]), day: Number(heading[3]) };
        continue;
      }
      if (!line.startsWith('|')) continue;
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length < 2 || cells.every((c) => /^:?-+:?$/.test(c))) continue;

      let title = '';
      let url = '';
      let when = '';
      let price = '';
      const linkIn = (cell: string) => cell.match(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/);

      if (DATE_RE.test(cells[0])) {
        when = cells[0];
        const link = linkIn(cells[1] || '');
        if (!link) continue;
        title = stripEmoji(link[1] || cells[1]);
        url = link[2];
        price = cells[2] || '';
      } else if (cells[1] && DATE_RE.test(cells[1])) {
        when = cells[1];
        title = stripEmoji(cells[0].replace(/\[[^\]]*\]\([^)]*\)/g, ''));
        const link = linkIn(cells[2] || '') || linkIn(line);
        if (!link) continue;
        url = link[2];
        price = cells[3] || '';
      } else {
        continue;
      }

      if (!title || !url) continue;
      if (skippedOfficial(url) || /makehaven/i.test(title)) { skippedYale++; continue; }

      const m = when.match(DATE_RE);
      if (!m) continue;
      const month = Number(m[2]);
      const day = Number(m[1]);
      const year = resolveYear(section, month, day);
      const off = nyOffset(year, month, day);
      let start = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${m[3]}:00${off}`;
      let end = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${m[4]}:00${off}`;
      if (new Date(end).getTime() <= new Date(start).getTime()) {
        const next = new Date(new Date(end).getTime() + 864e5);
        const nOff = nyOffset(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
        end = `${next.toISOString().slice(0, 10)}T${m[4]}:00${nOff}`;
      }
      const startMs = new Date(start).getTime();
      const endMs = new Date(end).getTime();
      if (!(endMs > now && startMs <= until)) continue;

      const priceClean = price.replace(/`[^`]*`/g, '').replace(/\s+/g, ' ').trim();
      out.push({
        source: 'hand-checked',
        sourceUrl: url,
        title: clip(title, 80),
        start,
        end,
        locationRaw: title,
        descriptionRaw: priceClean,
        host: hostFromUrl(url),
        photoRaw: null,
      });
    }

    if (skippedYale) console.log(`hand-checked: ${skippedYale} official Yale calendar or MakeHaven rows left to their own adapters`);
    return out;
  },
};
