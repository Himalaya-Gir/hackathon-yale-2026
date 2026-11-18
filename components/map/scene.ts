// The imperative MapLibre scene (PLAN.md §9, package B). One map, created once; the store drives it.
import { circle } from '@turf/circle';
import { point } from '@turf/helpers';
import { Map as MlMap, MercatorCoordinate, Popup, setWorkerUrl, type CustomLayerInterface, type GeoJSONSource } from 'maplibre-gl';
import { startPoint } from '@/lib/schedule';
import { useOrbit } from '@/lib/store';
import { fmtDay, now, nyParts } from '@/lib/time';
import type { Pick as OrbitPick, Profile, YaleEvent } from '@/lib/types';
import { MarkerLayer, type MarkerFriend } from './markers';
import { addNavigation } from './navigation';

type State = ReturnType<typeof useOrbit.getState>;
type GeoData = Parameters<GeoJSONSource['setData']>[0];

const GOLD = '#FFC857', GOLD_HOT = '#FFF3CC';
const SKY = '#63AAFF', SKY_HOT = '#E7F2FF';
const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const HOME_VIEW = { center: [-72.9265, 41.3115] as [number, number], zoom: 15.6, pitch: 60, bearing: -20 };
const OVERVIEW: [number, number] = [-72.9262, 41.3146];
const PAD = { left: 340, right: 400, top: 60, bottom: 120 };
const PAD_WIDE = { left: 340, right: 400, top: 170, bottom: 90 };
const HERE_ID = 'grokathon-yale-2026';
const BEAM_M = 9;
const BEAM_M_SELECTED = 13;

type Beam = {
  key: string; eventId: string; kind: 'week' | 'tonight';
  lng: number; lat: number; color: string; hot: string; halo: string; haloScale: number;
  from: number; to: number; cur: number; t0: number; dur: number; full: number;
  state: 0 | 1 | 2; // 0 normal, 1 hovered, 2 selected
  dim: boolean;
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

function rgba(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const alpha = Math.max(0, Math.min(1, a));
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(3)})`;
}

/** Disc of `meters` radius, 24 steps, from @turf/circle. */
function disc(lng: number, lat: number, meters: number): number[][] {
  const ring = circle(point([lng, lat]), meters, { steps: 24, units: 'meters' }).geometry.coordinates[0];
  return ring.map((c) => [c[0], c[1]]);
}

const fc = (features: unknown[]) => ({ type: 'FeatureCollection', features }) as unknown as GeoData;
function okPos<T extends { lat: number; lng: number }>(e: T | undefined | null): e is T {
  return !!e && Number.isFinite(e.lat) && Number.isFinite(e.lng);
}

function initialsOf(name: string | undefined): string {
  return (name ?? 'Me').split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

/** "Thu 5:30" / "Tonight 7:30" — minutes always shown, no am/pm. */
function shortWhen(iso: string): string {
  const day = fmtDay(iso);
  const p = nyParts(new Date(iso));
  if (!Number.isFinite(p.hh)) return day;
  const h = p.hh % 12 || 12;
  return `${day} ${h}:${String(p.mm).padStart(2, '0')}`;
}

/** Last class that ends within 90 minutes before the event, otherwise home. */
function originFor(ev: YaleEvent, profile: Profile | null): [number, number] | null {
  if (!profile) return null;
  const from = startPoint(ev, profile);
  return Number.isFinite(from.lat) && Number.isFinite(from.lng) ? [from.lng, from.lat] : null;
}

export function createScene(container: HTMLDivElement): () => void {
  ensureWorker();
  const map = new MlMap({
    container, style: STYLE_URL, ...HOME_VIEW,
    maxPitch: 72, minZoom: 12.5, maxZoom: 19,
    bearingSnap: 0, renderWorldCopies: false,
    canvasContextAttributes: { antialias: true },
    attributionControl: { compact: true },
    fadeDuration: 0,
  });
  // The dark style asks for a wood sprite that this host does not ship. Supply a blank image
  // before the style needs it, so the console stays quiet.
  const blank = { width: 1, height: 1, data: new Uint8Array(4) };
  map.setMissingStyleImageResolver((id) => { if (!map.hasImage(id)) map.addImage(id, blank); });
  try { addNavigation(map, HOME_VIEW, PAD); } catch (err) { console.warn('orbit map: navigation', err); }
  const store = useOrbit;
  const markers = new MarkerLayer(
    container,
    (id) => { if (id) store.getState().select(id); },
    (id) => store.getState().hover(id),
  );
  const beams = new Map<string, Beam>();
  let ready = false, dead = false, raf = 0;
  let matrix: ArrayLike<number> | null = null;
  let here: [number, number] | null = null;
  let trajPts: number[][] = [], trajShown = 0, trajLast = 0, trajSig = '';
  let riseAt = 0;
  let phaseSeen: State['phase'] = store.getState().phase;
  let eventsRef: YaleEvent[] | null = null;
  let byId = new Map<string, YaleEvent>();
  let loggedError = false;

  // Idle rotation: 2°/s, stopped by the first mousedown, wheel, or touch.
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
    for (const n of ['mousedown', 'wheel', 'touchstart'] as const) window.removeEventListener(n, stopIdle, true);
  };
  for (const n of ['mousedown', 'wheel', 'touchstart'] as const) window.addEventListener(n, stopIdle, { capture: true, passive: true });

  function project(lng: number, lat: number, alt: number): { x: number; y: number; ok: boolean } {
    const m = matrix;
    if (!m) {
      const p = map.project([lng, lat]);
      return { x: p.x, y: p.y, ok: true };
    }
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
    id: 'orbit-probe', type: 'custom', renderingMode: '3d',
    render: (_gl, opts) => { if (dead) return; matrix = opts.defaultProjectionData.mainMatrix; placeMarkers(); },
  };

  const src = (id: string) => map.getSource(id) as GeoJSONSource | undefined;

  function draw() {
    if (!ready || dead) return;
    const polys: unknown[] = [], halos: unknown[] = [];
    for (const b of beams.values()) {
      if (b.cur < 0.4) continue;
      const r = b.state === 2 ? BEAM_M_SELECTED : BEAM_M;
      const rise = Math.min(1, b.to === 0 ? b.cur / Math.max(1, b.from) : b.cur / Math.max(1, b.to));
      const glow = (b.state === 2 ? 0.9 : b.state === 1 ? 0.7 : 0.5) * (b.dim ? 0.45 : 1);
      polys.push({
        type: 'Feature', properties: { kind: b.kind, h: b.cur, c: b.state ? b.hot : b.color },
        geometry: { type: 'Polygon', coordinates: [disc(b.lng, b.lat, r)] },
      });
      halos.push({
        type: 'Feature',
        properties: { c: rgba(b.halo, rise * glow), s: b.state === 2 ? Math.max(b.haloScale, 1.45) : b.haloScale },
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
    if (trajShown < target) { trajShown = Math.min(target, trajShown + dt / 280); busy = true; }
    else if (trajShown > target) trajShown = target;
    draw();
    if (busy) raf = requestAnimationFrame(frame); else trajLast = 0;
  }
  const kick = () => { if (!raf && !dead) raf = requestAnimationFrame(frame); };

  function sync(s: State) {
    if (!ready || dead) return;
    if (s.events !== eventsRef) { eventsRef = s.events; byId = new Map(s.events.map((e) => [e.id, e])); }
    const t = performance.now();
    if (s.phase === 'thinking' && phaseSeen !== 'thinking') riseAt = t + 900;
    phaseSeen = s.phase;
    const tonight = s.mode === 'tonight';
    const tonightIds = new Set(tonight ? s.tonightPicks.map((p) => p.eventId) : []);
    const me: MarkerFriend | null = s.profile ? { initials: initialsOf(s.profile.name), color: 'me' } : { initials: 'ME', color: 'me' };
    const friendsOf = (id: string): MarkerFriend[] => {
      const list: MarkerFriend[] = s.going.includes(id) && me ? [me] : [];
      for (const f of s.friends) if (f.status === 'friend' && f.goingTo?.includes(id)) list.push({ initials: f.initials, color: f.color });
      return list;
    };
    const wanted = new Set<string>();
    const want = (p: OrbitPick, i: number, kind: 'week' | 'tonight') => {
      const ev = byId.get(p.eventId);
      if (!okPos(ev)) return;
      const key = `${kind}:${ev.id}`;
      if (wanted.has(key)) return;
      wanted.add(key);
      const score = Number.isFinite(p.score) ? Math.max(0, Math.min(100, p.score)) : 60;
      const full = 40 + score * 1.6;
      const dim = kind === 'week' && tonight;
      const to = dim ? full / 2 : full;
      const state: Beam['state'] = s.selectedEventId === ev.id ? 2 : s.hoveredEventId === ev.id ? 1 : 0;
      const color = kind === 'week' ? GOLD : SKY;
      const both = kind === 'tonight' && p.lane === 'both';
      let b = beams.get(key);
      if (!b) {
        b = {
          key, eventId: ev.id, kind, lng: ev.lng, lat: ev.lat, color, hot: color, halo: color, haloScale: 1,
          from: 0, to, cur: 0, t0: Math.max(t, riseAt), dur: 600, full, state, dim,
        };
        beams.set(key, b);
      } else if (b.to !== to) {
        const wasGone = b.to === 0;
        b.from = b.cur; b.to = to; b.t0 = wasGone ? Math.max(t, riseAt) : t; b.dur = 600;
      }
      b.lng = ev.lng; b.lat = ev.lat; b.full = full; b.state = state; b.dim = dim;
      b.color = color;
      b.hot = kind === 'week' ? GOLD_HOT : SKY_HOT;
      b.halo = both ? GOLD : color;
      b.haloScale = state === 2 ? 1.6 : both ? 1.35 : 1;
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

    const pts = s.weekPicks.map((p) => byId.get(p.eventId)).filter(okPos) as YaleEvent[];
    const seen = new Set<string>();
    trajPts = pts.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
      .sort((a, b) => a.start.localeCompare(b.start)).map((e) => [e.lng, e.lat]);
    const nextSig = trajPts.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';') + (trajPts.length ? ';' : '');
    if (nextSig !== trajSig) {
      if (!(trajSig && nextSig.startsWith(trajSig))) trajShown = 0;
      trajSig = nextSig;
    }
    if (trajPts.length < 2) trajShown = 0;

    const tRef = now().getTime();
    const t0 = tRef - 18 * 3600_000, t1 = tRef + 7 * 86400_000;
    const dots: unknown[] = [];
    for (const e of s.events) {
      if (!okPos(e) || wanted.has(`week:${e.id}`) || wanted.has(`tonight:${e.id}`)) continue;
      const at = new Date(e.start).getTime();
      if (!(at >= t0 && at <= t1)) continue;
      const n = s.friends.filter((f) => f.status === 'friend' && f.goingTo?.includes(e.id)).length;
      dots.push({ type: 'Feature', properties: { id: e.id, n }, geometry: { type: 'Point', coordinates: [e.lng, e.lat] } });
    }
    void src('orbit-dots')?.setData(fc(dots));

    const sel = s.selectedEventId ? byId.get(s.selectedEventId) : undefined;
    const from = okPos(sel) ? originFor(sel, s.profile) : null;
    void src('orbit-route')?.setData(fc(from && okPos(sel) ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [from, [sel.lng, sel.lat]] } }] : []));

    const venue = byId.get(HERE_ID);
    const home = s.profile?.home;
    here = okPos(venue) ? [venue.lng, venue.lat] : okPos(home) ? [home.lng, home.lat] : null;

    try {
      map.setPaintProperty('orbit-beams-week', 'fill-extrusion-opacity', tonight ? 0.3 : 0.85);
      map.setPaintProperty('orbit-beams-tonight', 'fill-extrusion-opacity', 0.85);
      map.setPaintProperty('orbit-traj-glow', 'line-opacity', tonight ? 0 : 0.7);
      map.setPaintProperty('orbit-traj', 'line-opacity', tonight ? 0 : 1);
    } catch { /* style not ready */ }
    kick();
  }

  function camera(s: State, p: State) {
    if (!ready) return;
    if (s.phase === 'thinking' && p.phase !== 'thinking') {
      map.easeTo({ center: OVERVIEW, zoom: 14.6, pitch: 60, duration: 900, padding: PAD_WIDE, essential: true });
    }
    if (s.selectedEventId && s.selectedEventId !== p.selectedEventId) {
      const ev = byId.get(s.selectedEventId) ?? s.events.find((e) => e.id === s.selectedEventId);
      if (okPos(ev)) map.flyTo({ center: [ev.lng, ev.lat], zoom: 17.2, pitch: 65, duration: 1800, padding: PAD, essential: true });
    }
  }

  const unsub = store.subscribe((s, p) => {
    if (dead) return;
    if (s.events !== p.events || s.weekPicks !== p.weekPicks || s.tonightPicks !== p.tonightPicks || s.mode !== p.mode
      || s.phase !== p.phase || s.selectedEventId !== p.selectedEventId || s.hoveredEventId !== p.hoveredEventId
      || s.friends !== p.friends || s.going !== p.going || s.profile !== p.profile) sync(s);
    camera(s, p);
  });

  function paint(layer: string, prop: string, value: unknown) {
    try { if (map.getLayer(layer)) map.setPaintProperty(layer, prop as never, value as never); } catch { /* this style build differs */ }
  }

  function night() {
    for (const l of map.getStyle().layers ?? []) {
      const id = l.id;
      if (l.type === 'background') paint(id, 'background-color', '#070b14');
      else if (id === 'water') paint(id, 'fill-color', '#0c141e');
      else if (id === 'waterway') paint(id, 'line-color', '#0c141e');
      else if (l.type === 'fill' && /park|wood|landcover|landuse/.test(id)) paint(id, 'fill-color', '#101820');
      else if (l.type === 'line' && /casing/.test(id)) paint(id, 'line-color', 'rgba(48,62,84,0.45)');
      else if (l.type === 'line' && /highway_path/.test(id)) paint(id, 'line-color', '#162033');
      else if (l.type === 'line' && /highway|road/.test(id)) paint(id, 'line-color', '#141c2c');
      else if (l.type === 'line' && /rail/.test(id)) paint(id, 'line-color', '#141c2a');
      else if (l.type === 'symbol' && /highway_name/.test(id)) { paint(id, 'text-color', '#5d7096'); paint(id, 'text-halo-color', 'rgba(7,11,20,0.9)'); }
      else if (l.type === 'symbol' && /place|water_name/.test(id)) { paint(id, 'text-color', '#7286ad'); paint(id, 'text-halo-color', 'rgba(7,11,20,0.9)'); }
    }
    try { if (map.getLayer('landcover_wood')) map.setPaintProperty('landcover_wood', 'fill-pattern', null as never); } catch { /* this style's wood sprite is missing */ }
    try { map.setLight({ anchor: 'viewport', color: '#b7c6da', intensity: 0.32, position: [1.3, 210, 36] }); } catch { /* optional */ }
    try {
      map.setSky({ 'sky-color': '#070b14', 'horizon-color': '#121c30', 'fog-color': '#070b14', 'sky-horizon-blend': 0.8, 'horizon-fog-blend': 0.8, 'fog-ground-blend': 0.55, 'atmosphere-blend': 0 });
    } catch { /* optional */ }

    const heightExpr = ['case', ['>', ['to-number', ['coalesce', ['get', 'render_height'], 0]], 0], ['to-number', ['get', 'render_height']], 10] as never;
    const bColor = ['interpolate', ['linear'], ['to-number', ['coalesce', ['get', 'render_height'], 8]], 0, '#1a2330', 18, '#2c3c4e', 55, '#45586e'] as never;
    const existing = (map.getStyle().layers ?? []).find((l) => l.type === 'fill-extrusion' && l.id !== 'orbit-beams-week' && l.id !== 'orbit-beams-tonight');
    if (existing) {
      paint(existing.id, 'fill-extrusion-color', bColor);
      paint(existing.id, 'fill-extrusion-opacity', 0.94);
      try { if (map.getLayer('building')) map.setLayoutProperty('building', 'visibility', 'none'); } catch { /* flat footprint */ }
    } else if (map.getSource('openmaptiles')) {
      try { if (map.getLayer('building')) map.setLayoutProperty('building', 'visibility', 'none'); } catch { /* flat footprint */ }
      map.addLayer({
        id: 'orbit-buildings', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14,
        paint: {
          'fill-extrusion-color': bColor,
          'fill-extrusion-height': heightExpr,
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.94,
          'fill-extrusion-vertical-gradient': true,
        },
      });
    }
  }

  function layers() {
    const empty = fc([]);
    for (const id of ['orbit-dots', 'orbit-traj', 'orbit-route', 'orbit-halos', 'orbit-beams']) {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: empty });
    }
    map.addLayer({
      id: 'orbit-dots', type: 'circle', source: 'orbit-dots',
      paint: {
        'circle-color': '#B7D4FF',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, ['case', ['>', ['get', 'n'], 0], 5.5, 3.2], 17, ['case', ['>', ['get', 'n'], 0], 9, 5]],
        'circle-opacity': 0.35,
        'circle-stroke-color': '#E4EFFF',
        'circle-stroke-width': ['case', ['>', ['get', 'n'], 0], 1.75, 0],
        'circle-stroke-opacity': 0.9,
        'circle-pitch-alignment': 'viewport',
      },
    });
    map.addLayer({
      id: 'orbit-traj-glow', type: 'line', source: 'orbit-traj', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': GOLD, 'line-width': 18, 'line-blur': 5, 'line-opacity': 0.7 },
    });
    map.addLayer({
      id: 'orbit-traj', type: 'line', source: 'orbit-traj', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#FFE7B8', 'line-width': 3.4, 'line-opacity': 1 },
    });
    map.addLayer({
      id: 'orbit-route', type: 'line', source: 'orbit-route', layout: { 'line-cap': 'butt' },
      paint: { 'line-color': '#F7F9FF', 'line-width': 2.5, 'line-opacity': 0.85, 'line-dasharray': [1.4, 1.5] },
    });
    map.addLayer({
      id: 'orbit-halos', type: 'circle', source: 'orbit-halos',
      paint: {
        'circle-color': ['get', 'c'], 'circle-blur': 0.75, 'circle-opacity': 1, 'circle-pitch-alignment': 'map',
        // zoom has to be the top-level interpolate input; the stop values carry the per-beam scale.
        'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 13, ['*', ['get', 's'], 16], 18, ['*', ['get', 's'], 70]] as never,
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
    if (!map.getLayer('orbit-probe')) map.addLayer(probe);
  }

  // Hover an unpicked event dot: its title and time, like a place name on a map.
  const tip = new Popup({ closeButton: false, closeOnClick: false, offset: 10, anchor: 'bottom' });
  function tips() {
    map.on('mousemove', 'orbit-dots', (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      const ev = id ? byId.get(id) : undefined;
      if (!okPos(ev)) return;
      map.getCanvas().style.cursor = 'default';
      const box = document.createElement('div');
      box.textContent = ev.title;
      const when = document.createElement('small');
      when.textContent = shortWhen(ev.start);
      box.appendChild(when);
      tip.setLngLat([ev.lng, ev.lat]).setDOMContent(box).addTo(map);
    });
    map.on('mouseleave', 'orbit-dots', () => { map.getCanvas().style.cursor = ''; tip.remove(); });
  }

  const ro = new ResizeObserver(() => { if (!dead) map.resize(); });
  ro.observe(container);

  map.on('load', () => {
    if (dead) return;
    try { night(); layers(); tips(); } catch (err) { console.error('orbit map: style', err); }
    ready = true;
    map.resize();
    container.style.opacity = '1';
    sync(store.getState());
    idleRaf = requestAnimationFrame(spin);
  });
  map.on('error', (e) => {
    if (loggedError || ready) return;
    loggedError = true;
    console.warn('orbit map:', e.error?.message ?? e.error);
  });

  return () => {
    dead = true;
    unsub();
    stopIdle();
    ro.disconnect();
    cancelAnimationFrame(raf);
    cancelAnimationFrame(idleRaf);
    markers.destroy();
    tip.remove();
    map.remove();
  };
}
