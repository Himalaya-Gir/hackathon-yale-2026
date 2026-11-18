// Luma public discover feed for New Haven (PLAN.md §4.1 source 4). No key.
// The official Yale calendar adapter is separate and is not called from here.
import type { EventSourceAdapter, RawEvent } from './types';

const API = 'https://api.lu.ma/discover/get-paginated-events?latitude=41.31&longitude=-72.92&pagination_limit=50';

type LumaEvent = {
  name?: string;
  start_at?: string;
  end_at?: string | null;
  url?: string;
  location_type?: string;
  one_to_one?: boolean;
  visibility?: string;
  geo_address_info?: { full_address?: string; address?: string; city?: string; mode?: string };
  coordinate?: { latitude?: number; longitude?: number };
};

function clip(text: string, max: number) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–-]+$/, '')}…`;
}

function addressOf(ev: LumaEvent) {
  const g = ev.geo_address_info ?? {};
  return String(g.full_address || g.address || g.city || '').replace(/\s+/g, ' ').trim();
}

export const lumaAdapter: EventSourceAdapter = {
  id: 'luma',
  label: 'Luma (New Haven)',
  async fetch(days: number): Promise<RawEvent[]> {
    const res = await fetch(API, { headers: { 'User-Agent': 'campus-events-hackathon/1.0', Accept: 'application/json' } });
    if (!res.ok) throw new Error(`luma HTTP ${res.status}`);
    const json = await res.json() as { entries?: { event?: LumaEvent }[] };
    const now = Date.now();
    const until = now + days * 864e5;
    const out: RawEvent[] = [];
    for (const entry of json.entries ?? []) {
      const ev = entry.event;
      if (!ev?.name || !ev.start_at) continue;
      if (ev.visibility && ev.visibility !== 'public') continue;
      const startMs = new Date(ev.start_at).getTime();
      const endMs = ev.end_at ? new Date(ev.end_at).getTime() : null;
      const stillOn = endMs != null ? endMs > now : startMs > now - 2 * 3600e3;
      if (!stillOn || startMs > until) continue;
      const lat = Number(ev.coordinate?.latitude);
      const lng = Number(ev.coordinate?.longitude);
      const locationRaw = addressOf(ev);
      const online = ev.location_type === 'online' || /online|virtual|zoom/i.test(locationRaw);
      const slug = String(ev.url || '').replace(/^https?:\/\/(www\.)?lu\.ma\//, '').replace(/\/$/, '');
      out.push({
        source: 'luma',
        sourceUrl: slug ? `https://luma.com/${slug}` : '',
        title: clip(ev.name, 80),
        start: ev.start_at,
        end: ev.end_at ?? null,
        locationRaw: locationRaw || (online ? 'Online' : ''),
        descriptionRaw: locationRaw,
        host: null,
        photoRaw: null,
        lat: Number.isFinite(lat) ? lat : undefined,
        lng: Number.isFinite(lng) ? lng : undefined,
      });
    }
    return out;
  },
};
