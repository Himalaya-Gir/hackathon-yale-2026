// Map navigation, the familiar way: zoom and compass buttons, a "back to campus" button,
// a building search and a scale. Built on MapLibre's own controls; only the home button and
// the search are custom, and both are plain DOM.
import { Marker, NavigationControl, ScaleControl, type IControl, type Map as MlMap } from 'maplibre-gl';

type View = { center: [number, number]; zoom: number; pitch: number; bearing: number };
type Building = { name: string; lat: number; lng: number; addr?: string };
type Padding = { left: number; right: number; top: number; bottom: number };

// The controls sit at the right edge of the free strip between the two panels
// (left 16 + 320, right 16 + 380), below the trajectory banner.
export const NAV_CSS = `
.maplibregl-ctrl-top-right{position:absolute;z-index:4;top:196px;right:412px;display:flex;flex-direction:column;align-items:flex-end;gap:8px;pointer-events:none}
.maplibregl-ctrl-top-right>*{pointer-events:auto}
.maplibregl-ctrl-top-right .maplibregl-ctrl{margin:0;float:none;clear:none}
.maplibregl-ctrl-group{background:rgba(10,16,28,.82);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.1);
  border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.45);display:flex;flex-direction:column}
.maplibregl-ctrl-group button{width:36px;height:36px;display:grid;place-items:center;background:transparent;border:0;padding:0;cursor:pointer;color:#dfe8f7}
.maplibregl-ctrl-group button+button{border-top:1px solid rgba(255,255,255,.08)}
.maplibregl-ctrl-group button:hover,.maplibregl-ctrl button:not(:disabled):hover{background:rgba(255,255,255,.08)}
.maplibregl-ctrl-group button:active{background:rgba(255,255,255,.14)}
.maplibregl-ctrl-group button:focus-visible{outline:2px solid #FFC857;outline-offset:-2px}
.maplibregl-ctrl-group button:disabled{opacity:.35;cursor:default}
.maplibregl-ctrl-icon{display:block;width:20px;height:20px;background-repeat:no-repeat;background-position:center;filter:invert(1) brightness(.92)}
.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 29 29'%3E%3Cpath d='M14.5 8.5c-.75 0-1.5.75-1.5 1.5v3h-3c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h3v3c0 .75.75 1.5 1.5 1.5S16 19.75 16 19v-3h3c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-3v-3c0-.75-.75-1.5-1.5-1.5z'/%3E%3C/svg%3E")}
.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 29 29'%3E%3Cpath d='M10 13c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h9c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-9z'/%3E%3C/svg%3E")}
.maplibregl-ctrl-compass .maplibregl-ctrl-icon{filter:none;background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 29 29'%3E%3Cpath fill='%23FFC857' d='M10.5 14l4-8 4 8h-8z'/%3E%3Cpath fill='%23dfe8f7' d='M10.5 16l4 8 4-8h-8z'/%3E%3C/svg%3E")}
.orbit-nav-home svg,.orbit-nav-find svg{width:18px;height:18px;stroke:#dfe8f7;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.orbit-find{position:relative}
.orbit-find-box{position:absolute;right:44px;top:0;width:260px;display:none;font-family:var(--font-geist-sans),ui-sans-serif,system-ui,sans-serif}
.orbit-find.is-open .orbit-find-box{display:block}
.orbit-find-box input{width:100%;height:36px;padding:0 12px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(10,16,28,.92);
  color:#eef3fb;font-size:14px;outline:none;box-shadow:0 8px 24px rgba(0,0,0,.45)}
.orbit-find-box input:focus{border-color:rgba(255,200,87,.7);box-shadow:0 0 0 4px rgba(255,200,87,.12)}
.orbit-find-box input::placeholder{color:#8393ad}
.orbit-find-list{margin:6px 0 0;padding:4px;list-style:none;border-radius:12px;background:rgba(10,16,28,.94);border:1px solid rgba(255,255,255,.1);
  box-shadow:0 8px 24px rgba(0,0,0,.45);max-height:260px;overflow:auto}
.orbit-find-list:empty{display:none}
.orbit-find-list li{padding:7px 10px;border-radius:8px;cursor:pointer;color:#eef3fb;font-size:14px;line-height:18px}
.orbit-find-list li small{display:block;color:#8393ad;font-size:12px}
.orbit-find-list li:hover,.orbit-find-list li.is-on{background:rgba(255,255,255,.09)}
.maplibregl-ctrl-scale{background:rgba(10,16,28,.72);border:1px solid rgba(223,232,247,.45);border-top:0;color:#c6d2e6;font-size:11px;
  padding:0 6px;border-radius:0 0 6px 6px;font-family:var(--font-geist-sans),ui-sans-serif,system-ui,sans-serif}
.orbit-found{display:flex;flex-direction:column;align-items:center;pointer-events:none;font-family:var(--font-geist-sans),ui-sans-serif,system-ui,sans-serif}
.orbit-found b{padding:4px 10px;border-radius:999px;background:rgba(10,16,28,.9);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:13px;font-weight:600;white-space:nowrap}
.orbit-found i{width:2px;height:22px;background:linear-gradient(#fff,rgba(255,255,255,.2))}
.orbit-found span{width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.25),0 0 18px 4px rgba(255,255,255,.5)}
.maplibregl-popup{position:absolute;top:0;left:0;display:flex;will-change:transform;pointer-events:none;z-index:3}
.maplibregl-popup-anchor-bottom{flex-direction:column-reverse}
.maplibregl-popup-tip{display:none}
.maplibregl-popup-content{background:rgba(10,16,28,.92);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:6px 10px;color:#eef3fb;
  font:13px/18px var(--font-geist-sans),ui-sans-serif,system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.5);max-width:240px}
.maplibregl-popup-content small{display:block;color:#8ea0bf;font-size:12px}
`;

const ICON_HOME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/></svg>';
const ICON_FIND = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>';

function button(cls: string, label: string, html: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.title = label;
  b.setAttribute('aria-label', label);
  b.innerHTML = html;
  b.addEventListener('click', onClick);
  return b;
}

/** One button: fly back to the campus view the app opens on. */
class HomeControl implements IControl {
  private el: HTMLDivElement | null = null;
  constructor(private view: View, private padding: Padding) {}
  onAdd(map: MlMap) {
    const el = document.createElement('div');
    el.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    el.appendChild(button('orbit-nav-home', 'Back to campus', ICON_HOME, () => {
      map.flyTo({ ...this.view, padding: this.padding, duration: 1400, essential: true });
    }));
    this.el = el;
    return el;
  }
  onRemove() { this.el?.remove(); this.el = null; }
}

/** A magnifier that opens a building search; picking a result flies there and drops a pin. */
class FindControl implements IControl {
  private el: HTMLDivElement | null = null;
  private pin: Marker | null = null;
  private buildings: Building[] = [];
  private onDoc = (e: MouseEvent) => { if (this.el && !this.el.contains(e.target as Node)) this.close(); };
  constructor(private padding: Padding) {}

  onAdd(map: MlMap) {
    const el = document.createElement('div');
    el.className = 'maplibregl-ctrl orbit-find';
    const group = document.createElement('div');
    group.className = 'maplibregl-ctrl-group';
    const box = document.createElement('div');
    box.className = 'orbit-find-box';
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Find a building';
    input.setAttribute('aria-label', 'Find a building');
    input.autocomplete = 'off';
    const list = document.createElement('ul');
    list.className = 'orbit-find-list';
    list.setAttribute('role', 'listbox');
    box.append(input, list);
    group.appendChild(button('orbit-nav-find', 'Find a building', ICON_FIND, () => {
      if (el.classList.contains('is-open')) this.close();
      else { el.classList.add('is-open'); input.focus(); input.select(); render(); }
    }));
    el.append(box, group);

    let hits: Building[] = [];
    let on = 0;
    const go = (b: Building) => {
      this.close();
      input.value = b.name;
      this.pin?.remove();
      const pin = document.createElement('div');
      pin.className = 'orbit-found';
      const label = document.createElement('b');
      label.textContent = b.name;
      pin.append(label, document.createElement('i'), document.createElement('span'));
      this.pin = new Marker({ element: pin, anchor: 'bottom' }).setLngLat([b.lng, b.lat]).addTo(map);
      map.flyTo({ center: [b.lng, b.lat], zoom: 17.4, pitch: 60, duration: 1600, padding: this.padding, essential: true });
    };
    const render = () => {
      const q = input.value.trim().toLowerCase();
      hits = q
        ? this.buildings
          .map((b) => ({ b, i: b.name.toLowerCase().indexOf(q), a: (b.addr ?? '').toLowerCase().indexOf(q) }))
          .filter((x) => x.i >= 0 || x.a >= 0)
          .sort((x, y) => (x.i < 0 ? 99 : x.i) - (y.i < 0 ? 99 : y.i) || x.b.name.localeCompare(y.b.name))
          .slice(0, 7).map((x) => x.b)
        : [];
      on = 0;
      list.replaceChildren(...hits.map((b, i) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.textContent = b.name;
        if (b.addr && !b.addr.startsWith(b.name)) { const s = document.createElement('small'); s.textContent = b.addr; li.appendChild(s); }
        if (i === on) li.classList.add('is-on');
        li.addEventListener('mousedown', (e) => { e.preventDefault(); go(b); });
        return li;
      }));
    };
    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // keep the map's arrow keys and the app's shortcuts out of the text field
      if (e.key === 'Escape') { this.close(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!hits.length) return;
        on = (on + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
        [...list.children].forEach((c, i) => c.classList.toggle('is-on', i === on));
      }
      if (e.key === 'Enter' && hits[on]) { e.preventDefault(); go(hits[on]); }
    });
    document.addEventListener('mousedown', this.onDoc, true);

    fetch('/data/buildings.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Building[]) => {
        const seen = new Set<string>();
        this.buildings = (Array.isArray(rows) ? rows : []).filter((b) => b && typeof b.name === 'string'
          && Number.isFinite(b.lat) && Number.isFinite(b.lng) && !seen.has(b.name) && (seen.add(b.name), true));
      })
      .catch(() => { /* search stays empty */ });

    this.el = el;
    return el;
  }

  private close() { this.el?.classList.remove('is-open'); }

  onRemove() {
    document.removeEventListener('mousedown', this.onDoc, true);
    this.pin?.remove();
    this.el?.remove();
    this.el = null;
  }
}

/** Adds every navigation control to the map. Call once, right after the map is created. */
export function addNavigation(map: MlMap, view: View, padding: Padding) {
  map.addControl(new FindControl(padding), 'top-right');
  map.addControl(new HomeControl(view, padding), 'top-right');
  map.addControl(new NavigationControl({ visualizePitch: true, showCompass: true, showZoom: true }), 'top-right');
  map.addControl(new ScaleControl({ maxWidth: 90, unit: 'imperial' }), 'top-right');
  // Keyboard: arrows pan, shift + arrows rotate and tilt, + and - zoom (on once the map has focus).
  map.keyboard.enable();
  // Right-drag or ctrl-drag rotates and tilts, like Google Maps.
  map.dragRotate.enable();
  map.touchZoomRotate.enableRotation();
}
