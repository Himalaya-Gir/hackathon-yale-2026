// The imperative MapLibre scene (PLAN.md §9, package B). One map, created once; the store drives it.
import { Map as MlMap, MercatorCoordinate, setWorkerUrl, type CustomLayerInterface, type GeoJSONSource } from 'maplibre-gl';
import circle from '@turf/circle';
import { startPoint } from '@/lib/schedule';
import { useOrbit } from '@/lib/store';
import { fmtWhen, now } from '@/lib/time';
import type { Pick as OrbitPick, YaleEvent } from '@/lib/types';
import { MarkerLayer, type MarkerFriend } from './markers';

type State = ReturnType<typeof useOrbit.getState>;
type GeoData = Parameters<GeoJSONSource['setData']>[0];

const GOLD = '#FFC857', GOLD_HOT = '#FFDA8C';
const SKY = '#63AAFF', SKY_HOT = '#B4D6FF';
const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const HOME_VIEW = { center: [-72.9265, 41.3115] as [number, number], zoom: 15.6, pitch: 60, bearing: -20 };
const OVERVIEW: [number, number] = [-72.9262, 41.3146];
const PAD = { left: 340, right: 400, top: 60, bottom: 120 };
const PAD_WIDE = { left: 340, right: 400, top: 170, bottom: 90 }; // overview: tall beams must clear the trajectory banner
const HERE_ID = 'grokathon-yale-2026';

type Beam = {
  key: string; eventId: string; kind: 'week' | 'tonight';
  lng: number; lat: number; color: string; hot: string; halo: string;
  from: number; to: number; cur: number; t0: number; dur: number; full: number;
  state: 0 | 1 | 2; // 0 normal, 1 hovered, 2 selected
};

let workerSet = false;
function ensureWorker() {
  if (workerSet) return;
  workerSet = true;
  try {
    // MapLibre 6 is ESM-only and derives its worker URL from import.meta.url, which a bundler breaks.
    setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);
  } catch (err) { console.warn('orbit map: worker url', err); }
}

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

/** Closed ring of a disc of `r` meters (turf, 24 steps). */
function disc(lng: number, lat: number, r: number): number[][] {
  return circle([lng, lat], r, { steps: 24, units: 'meters' }).geometry.coordinates[0];
}

/** "Thu 5:30" / "Tonight 7:30" — the marker keeps the day word and drops AM/PM. */
function shortWhen(iso: string): string {
  return fmtWhen(iso).replace(/\s?(AM|PM)$/i, '');
}

const fc = (features: unknown[]) => ({ type: 'FeatureCollection', features }) as unknown as GeoData;
const okPos = (e: { lat: number; lng: number } | undefined | null): e is { lat: number; lng: number } =>
  !!e && Number.isFinite(e.lat) && Number.isFinite(e.lng);

function initialsOf(name: string | undefined): string {
  return (name ?? 'Me').split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

export function createScene(container: HTMLDivElement): () => void {
  ensureWorker();
  const map = new MlMap({
    container, style: STYLE_URL, ...HOME_VIEW,
    maxPitch: 70, minZoom: 12.5, maxZoom: 19,
    canvasContextAttributes: { antialias: true },
    attributionControl: { compact: true },
    fadeDuration: 0,
  });
  const store = useOrbit;
  const markers = new MarkerLayer(container, (id) => { if (id) store.getState().select(id); }, (id) => store.getState().hover(id));
  const beams = new Map<string, Beam>();
  let ready = false, dead = false, raf = 0;
  let matrix: ArrayLike<number> | null = null;
  let here: [number, number] | null = null;
  let trajPts: number[][] = [], trajShown = 0, trajLast = 0;
  let eventsRef: YaleEvent[] | null = null;
  let byId = new Map<string, YaleEvent>();
  // A new runWeek / runTonight bumps the generation so the previous beams are not reused (no ghosts).
  let weekRun = 0, tonightRun = 0, tonightOn = false;

  // ---------- idle rotation (2° per second, stops at the first input) ----------
  let idle = true, idleRaf = 0, idleLast = 0;
  const spin = (t: number) => {
    if (!idle || dead) return;
    if (idleLast && ready && !map.isMoving()) map.setBearing(map.getBearing() + (2 * Math.min(100, t - idleLast)) / 1000);
    idleLast = t;
    idleRaf = requestAnimationFrame(spin);
  };
  const stopIdle = () => {
    if (!idle) return;
    idle = false;
    cancelAnimationFrame(idleRaf);
    for (const n of ['mousedown', 'wheel', 'touchstart', 'keydown'] as const) window.removeEventListener(n, stopIdle, true);
  };
  for (const n of ['mousedown', 'wheel', 'touchstart', 'keydown'] as const) window.addEventListener(n, stopIdle, { capture: true, passive: true });

  // ---------- projection of a 3D point to the screen ----------
  function project(lng: number, lat: number, alt: number): { x: number; y: number; ok: boolean } {
    const m = matrix;
    if (!m) return { x: 0, y: 0, ok: false };
    const c = MercatorCoordinate.fromLngLat({ lng, lat }, alt);
    const x = m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12];
    const y = m[1] * c.x + m[5] * c.y + m[9] * c.z + m[13];
    const w = m[3] * c.x + m[7] * c.y + m[11] * c.z + m[15];
    if (!(w > 0)) return { x: 0, y: 0, ok: false };
    return { x: ((x / w + 1) / 2) * container.clientWidth, y: ((1 - y / w) / 2) * container.clientHeight, ok: true };
  }

  function placeMarkers() {
    for (const b of beams.values()) {
      const p = project(b.lng, b.lat, b.cur);
      // Close-up: the top of a tall beam leaves the screen, so the marker slides down the beam to stay visible.
      const minY = 190;
      if (p.ok && p.y < minY) {
        const g = project(b.lng, b.lat, 0);
        if (g.ok && g.y > minY + 40) { const k = (minY - p.y) / (g.y - p.y); p.x += (g.x - p.x) * k; p.y = minY; }
      }
      const o = b.to === 0 ? Math.min(1, b.cur / Math.max(1, b.from)) : Math.min(1, (b.cur / Math.max(1, b.to)) * 1.6);
      markers.place(b.key, p.x, p.y, o, p.ok);
    }
    if (here) { const p = project(here[0], here[1], 0); markers.placeHere(p.x, p.y, p.ok); } else markers.hideHere();
  }

  const probe: CustomLayerInterface = {
    id: 'orbit-probe', type: 'custom', renderingMode: '2d',
    render: (_gl, opts) => { matrix = opts.defaultProjectionData.mainMatrix as ArrayLike<number>; placeMarkers(); },
  };

  // ---------- drawing ----------
  const src = (id: string) => map.getSource(id) as GeoJSONSource | undefined;

  function draw() {
    if (!ready || dead) return;
    const polys: unknown[] = [], halos: unknown[] = [];
    for (const b of beams.values()) {
      if (b.cur < 0.4) continue;
      const r = b.state === 2 ? 14 : b.state === 1 ? 11.5 : 9;
      polys.push({
        type: 'Feature', properties: { kind: b.kind, h: b.cur, c: b.state ? b.hot : b.color },
        geometry: { type: 'Polygon', coordinates: [disc(b.lng, b.lat, r)] },
      });
      const risen = Math.min(1, b.cur / Math.max(1, b.full));
      const glow = b.state === 2 ? 1 : b.state === 1 ? 0.85 : 0.6;
      const dimHalo = tonightOn && b.kind === 'week' ? 0.35 : 1;
      halos.push({
        type: 'Feature', properties: { kind: b.kind, c: b.halo, o: risen * glow * dimHalo, s: b.state === 2 ? 1.6 : 1 },
        geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
      });
    }
    void src('orbit-beams')?.setData(fc(polys));
    void src('orbit-halos')?.setData(fc(halos));

    const line: number[][] = [];
    if (trajPts.length >= 2 && trajShown > 0) {
      const n = Math.min(trajPts.length - 1, Math.floor(trajShown));
      for (let i = 0; i <= n; i++) line.push(trajPts[i]);
      const frac = trajShown - n;
      if (frac > 0.001 && n < trajPts.length - 1) {
        const a = trajPts[n], c = trajPts[n + 1];
        line.push([a[0] + (c[0] - a[0]) * frac, a[1] + (c[1] - a[1]) * frac]);
      }
    }
    void src('orbit-traj')?.setData(fc(line.length >= 2 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } }] : []));
    map.triggerRepaint();
  }

  function frame(t: number) {
    raf = 0;
    if (dead) return;
    let busy = false;
    for (const b of [...beams.values()]) {
      const k = Math.min(1, Math.max(0, (t - b.t0) / b.dur));
      b.cur = b.from + (b.to - b.from) * easeOut(k);
      if (k < 1) busy = true;
      else if (b.to === 0) { beams.delete(b.key); markers.remove(b.key); }
    }
    const target = Math.max(0, trajPts.length - 1);
    const dt = trajLast ? Math.min(100, t - trajLast) : 16;
    trajLast = t;
    if (trajShown < target) { trajShown = Math.min(target, trajShown + dt / 320); busy = true; }
    else if (trajShown > target) trajShown = target;
    draw();
    if (busy) raf = requestAnimationFrame(frame); else trajLast = 0;
  }
  const kick = () => { if (!raf && !dead) raf = requestAnimationFrame(frame); };

  // ---------- store → scene ----------
  function sync(s: State) {
    if (!ready || dead) return;
    if (s.events !== eventsRef) { eventsRef = s.events; byId = new Map(s.events.map((e) => [e.id, e])); }
    const t = performance.now();
    const tonight = s.mode === 'tonight';
    tonightOn = tonight;
    const tonightIds = new Set(tonight ? s.tonightPicks.map((p) => p.eventId) : []);
    const me: MarkerFriend | null = s.profile ? { initials: initialsOf(s.profile.name), color: 'me' } : { initials: 'ME', color: 'me' };
    const friendsOf = (id: string): MarkerFriend[] => {
      const list: MarkerFriend[] = s.going.includes(id) && me ? [me] : [];
      for (const f of s.friends) if (f.status === 'friend' && f.goingTo?.includes(id)) list.push({ initials: f.initials, color: f.color });
      return list;
    };
    const wanted = new Set<string>();
    const beamed = new Set<string>();
    const want = (p: OrbitPick, i: number, kind: 'week' | 'tonight') => {
      const ev = byId.get(p.eventId);
      if (!okPos(ev)) return; // a pick whose event is unknown is simply not drawn
      const run = kind === 'week' ? weekRun : tonightRun;
      const key = `${kind}:${run}:${ev.id}`;
      if (wanted.has(key)) return;
      wanted.add(key);
      beamed.add(ev.id);
      const score = Number.isFinite(p.score) ? Math.max(0, Math.min(100, p.score)) : 60;
      const full = 40 + score * 1.6;
      const dim = kind === 'week' && tonight;
      const to = dim ? full / 2 : full;
      const state: Beam['state'] = s.selectedEventId === ev.id ? 2 : s.hoveredEventId === ev.id ? 1 : 0;
      const both = p.lane === 'both';
      const color = both || kind === 'tonight' ? SKY : GOLD;
      const hot = both || kind === 'tonight' ? SKY_HOT : GOLD_HOT;
      const halo = both ? GOLD : color;
      let b = beams.get(key);
      if (!b) {
        b = { key, eventId: ev.id, kind, lng: ev.lng, lat: ev.lat, color, hot, halo, from: 0, to, cur: 0, t0: t, dur: 600, full, state };
        beams.set(key, b);
      } else if (b.to !== to) { b.from = b.cur; b.to = to; b.t0 = t; b.dur = to === 0 ? 250 : 600; }
      b.lng = ev.lng; b.lat = ev.lat; b.full = full; b.state = state;
      b.color = color; b.hot = hot; b.halo = halo;
      markers.upsert(key, {
        eventId: ev.id, kind, color, rank: i + 1, label: shortWhen(ev.start), photoUrl: ev.photoUrl ?? '', title: ev.title,
        friends: friendsOf(ev.id), dim, selected: state === 2, hot: state === 1,
      });
    };
    if (tonight) s.tonightPicks.forEach((p, i) => want(p, i, 'tonight'));
    s.weekPicks.forEach((p, i) => { if (!tonightIds.has(p.eventId)) want(p, i, 'week'); });
    for (const b of beams.values()) {
      if (!wanted.has(b.key) && b.to !== 0) { b.from = b.cur; b.to = 0; b.t0 = t; b.dur = 250; b.state = 0; }
    }

    // trajectory: the week's picks in time order
    const pts = s.weekPicks.map((p) => byId.get(p.eventId)).filter(okPos) as YaleEvent[];
    const seen = new Set<string>();
    trajPts = pts.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
      .sort((a, b) => a.start.localeCompare(b.start)).map((e) => [e.lng, e.lat]);
    if (trajPts.length < 2) trajShown = 0;

    // all events of the next 7 days, minus the ones that already have a beam
    const t0 = now().getTime() - 3 * 3600_000, t1 = t0 + 7 * 86400_000 + 3 * 3600_000;
    const dots: unknown[] = [];
    for (const e of s.events) {
      if (!okPos(e) || beamed.has(e.id)) continue;
      const at = new Date(e.start).getTime();
      if (!(at >= t0 && at <= t1)) continue;
      const n = s.friends.filter((f) => f.status === 'friend' && f.goingTo?.includes(e.id)).length;
      dots.push({ type: 'Feature', properties: { id: e.id, n }, geometry: { type: 'Point', coordinates: [e.lng, e.lat] } });
    }
    void src('all-events')?.setData(fc(dots));

    // route: last class ending within 90 min, else home (same rule as the "It fits" line)
    const sel = s.selectedEventId ? byId.get(s.selectedEventId) : undefined;
    const sp = okPos(sel) && s.profile ? startPoint(sel, s.profile) : null;
    const from = okPos(sp) ? [sp.lng, sp.lat] as [number, number] : null;
    void src('orbit-route')?.setData(fc(from && okPos(sel) ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [from, [sel.lng, sel.lat]] } }] : []));

    // "You are here"
    const venue = byId.get(HERE_ID);
    here = okPos(venue) ? [venue.lng, venue.lat] : okPos(s.profile?.home) ? [s.profile!.home.lng, s.profile!.home.lat] : null;

    // week layers step back in tonight mode
    try {
      map.setPaintProperty('orbit-beams-week', 'fill-extrusion-opacity', tonight ? 0.3 : 0.85);
      map.setPaintProperty('orbit-traj-glow', 'line-opacity', tonight ? 0.1 : 0.35);
      map.setPaintProperty('orbit-traj', 'line-opacity', tonight ? 0.25 : 0.95);
    } catch { /* style not ready */ }
    kick();
  }

  function camera(s: State, p: State) {
    if (!ready) return;
    if (s.phase === 'thinking' && p.phase !== 'thinking') {
      stopIdle();
      map.easeTo({ center: OVERVIEW, zoom: 14.6, pitch: 60, duration: 900, padding: PAD_WIDE, essential: true });
    }
    if (s.selectedEventId && s.selectedEventId !== p.selectedEventId) {
      const ev = byId.get(s.selectedEventId) ?? s.events.find((e) => e.id === s.selectedEventId);
      if (okPos(ev)) {
        stopIdle();
        map.flyTo({ center: [ev.lng, ev.lat], zoom: 17.2, pitch: 65, duration: 1800, padding: PAD, essential: true });
      }
    }
  }

  const unsub = store.subscribe((s, p) => {
    if (dead) return;
    // New run clears its picks in the same update: bump the generation first so old beams cannot be reused.
    if (s.mode === 'week' && s.phase === 'thinking' && s.weekPicks.length === 0 && (p.mode !== 'week' || p.phase !== 'thinking' || p.weekPicks.length > 0)) weekRun += 1;
    if (s.mode === 'tonight' && s.phase === 'thinking' && s.tonightPicks.length === 0 && (p.mode !== 'tonight' || p.phase !== 'thinking' || p.tonightPicks.length > 0)) tonightRun += 1;
    if (s.events !== p.events || s.weekPicks !== p.weekPicks || s.tonightPicks !== p.tonightPicks || s.mode !== p.mode
      || s.selectedEventId !== p.selectedEventId || s.hoveredEventId !== p.hoveredEventId || s.friends !== p.friends
      || s.going !== p.going || s.profile !== p.profile || s.phase !== p.phase) sync(s);
    camera(s, p);
  });

  // ---------- style ----------
  function paint(layer: string, prop: string, value: unknown) {
    try { if (map.getLayer(layer)) map.setPaintProperty(layer, prop as never, value as never); } catch { /* layer differs in this style version */ }
  }

  function night() {
    for (const l of map.getStyle().layers ?? []) {
      const id = l.id;
      if (l.type === 'background') paint(id, 'background-color', '#070b14');
      else if (id === 'water') paint(id, 'fill-color', '#0a1526');
      else if (id === 'waterway') paint(id, 'line-color', '#0a1526');
      else if (l.type === 'fill' && /park|wood|landcover|landuse/.test(id)) paint(id, 'fill-color', '#0a141d');
      else if (id === 'building') { paint(id, 'fill-color', '#111c31'); paint(id, 'fill-outline-color', '#18263f'); }
      else if (l.type === 'line' && /casing/.test(id)) paint(id, 'line-color', 'rgba(52,74,116,0.55)');
      else if (l.type === 'line' && /highway_path/.test(id)) paint(id, 'line-color', '#16233a');
      else if (l.type === 'line' && /highway|road/.test(id)) paint(id, 'line-color', '#131d31');
      else if (l.type === 'line' && /rail/.test(id)) paint(id, 'line-color', '#141d2e');
      else if (l.type === 'symbol' && /highway_name/.test(id)) { paint(id, 'text-color', '#5d7096'); paint(id, 'text-halo-color', 'rgba(7,11,20,0.9)'); }
      else if (l.type === 'symbol' && /place|water_name/.test(id)) { paint(id, 'text-color', '#7286ad'); paint(id, 'text-halo-color', 'rgba(7,11,20,0.9)'); }
    }
    try { map.setLight({ anchor: 'viewport', color: '#a9c1ff', intensity: 0.4, position: [1.3, 215, 38] }); } catch { /* optional */ }
    try {
      map.setSky({ 'sky-color': '#070b14', 'horizon-color': '#101d38', 'fog-color': '#070b14', 'sky-horizon-blend': 0.8, 'horizon-fog-blend': 0.8, 'fog-ground-blend': 0.55, 'atmosphere-blend': 0 });
    } catch { /* optional */ }

    const existing = (map.getStyle().layers ?? []).find((l) => l.type === 'fill-extrusion');
    const height = ['coalesce', ['get', 'render_height'], 8];
    const bColor = ['interpolate', ['linear'], height, 0, '#17243f', 25, '#1f3157', 80, '#2b4577'];
    if (existing) {
      paint(existing.id, 'fill-extrusion-color', bColor);
      paint(existing.id, 'fill-extrusion-height', height);
      paint(existing.id, 'fill-extrusion-base', ['coalesce', ['get', 'render_min_height'], 0]);
      paint(existing.id, 'fill-extrusion-opacity', 0.94);
      if (existing.id !== 'building') paint('building', 'fill-opacity', 0);
    } else if (map.getSource('openmaptiles')) {
      const before = (map.getStyle().layers ?? []).find((l) => l.type === 'symbol')?.id;
      const layer = {
        id: 'orbit-buildings', type: 'fill-extrusion' as const, source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-extrusion-color': bColor as never,
          'fill-extrusion-height': height as never,
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0] as never,
          'fill-extrusion-opacity': 0.94,
          'fill-extrusion-vertical-gradient': true,
        },
      };
      if (before) map.addLayer(layer, before); else map.addLayer(layer);
      paint('building', 'fill-opacity', 0);
    }
  }

  function layers() {
    const empty = fc([]);
    for (const id of ['all-events', 'orbit-traj', 'orbit-route', 'orbit-halos', 'orbit-beams']) {
      map.addSource(id, { type: 'geojson', data: empty });
    }
    // meters → pixels at this latitude, so discs keep their ground size while zooming
    const meters = (m: number, k: unknown = 1) => ['interpolate', ['exponential', 2], ['zoom'], 12, ['*', k, m / 14.35], 20, ['*', k, m / 0.05606]];
    map.addLayer({
      id: 'all-events', type: 'circle', source: 'all-events',
      paint: {
        'circle-color': '#9CC4FF',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, ['case', ['>', ['get', 'n'], 0], 5.5, 2.6], 17, ['case', ['>', ['get', 'n'], 0], 10, 4.6]],
        'circle-opacity': 0.35,
        'circle-stroke-color': '#D6E6FF',
        'circle-stroke-width': ['case', ['>', ['get', 'n'], 0], 2.5, 0],
        'circle-stroke-opacity': 0.9,
        'circle-pitch-alignment': 'map',
      },
    });
    map.addLayer({
      id: 'orbit-traj-glow', type: 'line', source: 'orbit-traj', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': GOLD, 'line-width': 12, 'line-blur': 10, 'line-opacity': 0.35 },
    });
    map.addLayer({
      id: 'orbit-traj', type: 'line', source: 'orbit-traj', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#FFE0A0', 'line-width': 2.2, 'line-opacity': 0.95 },
    });
    map.addLayer({
      id: 'orbit-route', type: 'line', source: 'orbit-route', layout: { 'line-cap': 'butt' },
      paint: { 'line-color': '#FFFFFF', 'line-width': 2.5, 'line-opacity': 0.8, 'line-dasharray': [1.6, 1.6] },
    });
    map.addLayer({
      id: 'orbit-halos', type: 'circle', source: 'orbit-halos',
      paint: {
        'circle-color': ['get', 'c'], 'circle-blur': 0.85, 'circle-pitch-alignment': 'map',
        'circle-radius': meters(34, ['get', 's']) as never,
        'circle-opacity': ['get', 'o'],
      },
    });
    for (const kind of ['week', 'tonight'] as const) {
      map.addLayer({
        id: `orbit-beams-${kind}`, type: 'fill-extrusion', source: 'orbit-beams', filter: ['==', ['get', 'kind'], kind],
        paint: {
          'fill-extrusion-color': ['get', 'c'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85, 'fill-extrusion-vertical-gradient': false,
        },
      });
    }
    map.addLayer(probe);
  }

  map.on('load', () => {
    if (dead) return;
    try { night(); layers(); } catch (err) { console.error('orbit map: style', err); }
    ready = true;
    container.style.opacity = '1';
    const s0 = store.getState();
    sync(s0);
    if (s0.phase === 'thinking') {
      stopIdle();
      map.easeTo({ center: OVERVIEW, zoom: 14.6, pitch: 60, duration: 900, padding: PAD_WIDE, essential: true });
    }
    idleRaf = requestAnimationFrame(spin);
  });
  map.on('error', (e) => { console.warn('orbit map:', e?.error?.message ?? e); });

  return () => {
    dead = true;
    unsub();
    stopIdle();
    cancelAnimationFrame(raf);
    cancelAnimationFrame(idleRaf);
    markers.destroy();
    map.remove();
  };
}
