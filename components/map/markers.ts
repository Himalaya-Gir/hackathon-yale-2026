// HTML markers that sit on top of the beams (PLAN.md §9, package B, step 4).
// Plain DOM, positioned by the scene on every map render: no React, no maplibre Marker
// (a maplibre Marker cannot follow the animated top of an extrusion).

export type MarkerFriend = { initials: string; color: string };
export type MarkerData = {
  eventId: string;
  kind: 'week' | 'tonight';
  color: string;        // beam color
  rank: number;         // 1-based
  label: string;        // "Thu 5:30"
  photoUrl: string;
  title: string;
  friends: MarkerFriend[];
  dim: boolean;         // week pick shown behind tonight picks
  selected: boolean;
  hot: boolean;         // hovered
};

export const MARKER_CSS = `
.orbit-markers{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.orbit-mk{position:absolute;left:0;top:0;pointer-events:none;will-change:transform,opacity}
.orbit-mk-in{transform:translate(-50%,-100%);padding-bottom:6px;display:flex;flex-direction:column;align-items:center;gap:3px;
  pointer-events:auto;cursor:pointer;transition:scale .18s ease-out,opacity .25s ease-out;transform-origin:50% 100%;
  font-family:var(--font-geist-sans),ui-sans-serif,system-ui,sans-serif}
.orbit-mk-in:hover,.orbit-mk-in.is-hot{scale:1.08}
.orbit-mk-in.is-sel{scale:1.22}
.orbit-mk-in.is-dim{scale:.72;opacity:.5}
.orbit-mk-ph{position:relative;width:44px;height:44px;border-radius:50%;border:2.5px solid var(--c);background:#0d1626;
  box-shadow:0 0 0 1px rgba(7,11,20,.6),0 0 18px 2px color-mix(in srgb,var(--c) 55%,transparent),0 6px 14px rgba(0,0,0,.55)}
.orbit-mk-in.is-sel .orbit-mk-ph{box-shadow:0 0 0 1px rgba(7,11,20,.6),0 0 28px 8px color-mix(in srgb,var(--c) 75%,transparent),0 6px 14px rgba(0,0,0,.55)}
.orbit-mk-ph img{display:block;width:100%;height:100%;border-radius:50%;object-fit:cover}
.orbit-mk-rk{position:absolute;left:-7px;top:-7px;min-width:19px;height:19px;padding:0 4px;border-radius:10px;background:var(--c);
  color:#0a1020;font-size:12px;font-weight:700;line-height:19px;text-align:center;box-shadow:0 0 0 2px #070b14}
.orbit-mk-fr{position:absolute;right:-12px;bottom:-5px;display:flex;flex-direction:row}
.orbit-mk-fr span{width:20px;height:20px;border-radius:50%;margin-left:-6px;box-shadow:0 0 0 1.5px #070b14;
  font-size:9px;font-weight:700;line-height:20px;text-align:center;color:#0a1020;letter-spacing:-.02em}
.orbit-mk-fr span.more{background:#1b2740;color:#e8eefb}
.orbit-mk-fr span.me{background:#fff;color:#00356b}
.orbit-mk-lb{white-space:nowrap;padding:2px 8px;border-radius:10px;background:rgba(10,16,28,.82);border:1px solid rgba(255,255,255,.1);
  color:#eef3ff;font-size:13px;font-weight:600;line-height:17px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.orbit-here{position:absolute;left:0;top:0;pointer-events:none;will-change:transform}
.orbit-here-in{transform:translate(-50%,-50%);position:relative;width:14px;height:14px}
.orbit-here-dot{position:absolute;inset:0;border-radius:50%;background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.25),0 0 14px 3px rgba(255,255,255,.6)}
.orbit-here-ring{position:absolute;inset:-3px;border-radius:50%;border:2px solid rgba(255,255,255,.8);animation:orbit-pulse 2.2s ease-out infinite}
.orbit-here-lb{position:absolute;left:50%;top:22px;transform:translateX(-50%);white-space:nowrap;padding:2px 8px;border-radius:10px;
  background:rgba(10,16,28,.82);border:1px solid rgba(255,255,255,.14);color:#fff;font-size:12px;font-weight:600;line-height:16px;
  font-family:var(--font-geist-sans),ui-sans-serif,system-ui,sans-serif}
@keyframes orbit-pulse{0%{transform:scale(1);opacity:.9}100%{transform:scale(4.2);opacity:0}}
.maplibregl-ctrl-attrib{font-size:10px!important;background:rgba(10,16,28,.6)!important;color:#8fa3c8!important}
.maplibregl-ctrl-attrib a{color:#8fa3c8!important}
`;

type Entry = { el: HTMLDivElement; inner: HTMLDivElement; sig: string };

export class MarkerLayer {
  readonly root: HTMLDivElement;
  private entries = new Map<string, Entry>();
  private here: HTMLDivElement | null = null;

  constructor(
    parent: HTMLElement,
    private onSelect: (eventId: string) => void,
    private onHover: (eventId: string | null) => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'orbit-markers';
    parent.appendChild(this.root);
  }

  /** Creates or refreshes the marker for a beam key. */
  upsert(key: string, d: MarkerData) {
    const sig = JSON.stringify(d);
    let e = this.entries.get(key);
    if (e && e.sig === sig) return;
    if (!e) {
      const el = document.createElement('div');
      el.className = 'orbit-mk';
      el.style.opacity = '0';
      const inner = document.createElement('div');
      el.appendChild(inner);
      inner.addEventListener('click', (ev) => { ev.stopPropagation(); this.onSelect(inner.dataset.event ?? ''); });
      inner.addEventListener('mouseenter', () => this.onHover(inner.dataset.event ?? null));
      inner.addEventListener('mouseleave', () => this.onHover(null));
      this.root.appendChild(el);
      e = { el, inner, sig: '' };
      this.entries.set(key, e);
    }
    e.sig = sig;
    const { inner } = e;
    inner.dataset.event = d.eventId;
    inner.title = d.title;
    inner.className = `orbit-mk-in${d.selected ? ' is-sel' : ''}${d.hot ? ' is-hot' : ''}${d.dim ? ' is-dim' : ''}`;
    inner.style.setProperty('--c', d.color);
    inner.replaceChildren();

    const ph = document.createElement('div');
    ph.className = 'orbit-mk-ph';
    if (d.photoUrl) {
      const img = document.createElement('img');
      img.src = d.photoUrl; img.alt = ''; img.width = 44; img.height = 44; img.draggable = false;
      img.onerror = () => img.remove(); // never show a broken-image icon
      ph.appendChild(img);
    }
    const rk = document.createElement('div');
    rk.className = 'orbit-mk-rk';
    rk.textContent = String(d.rank);
    ph.appendChild(rk);
    if (d.friends.length) {
      const fr = document.createElement('div');
      fr.className = 'orbit-mk-fr';
      for (const f of d.friends.slice(0, 3)) {
        const s = document.createElement('span');
        if (f.color === 'me') s.className = 'me'; else s.style.background = f.color;
        s.textContent = f.initials;
        fr.appendChild(s);
      }
      if (d.friends.length > 3) {
        const s = document.createElement('span');
        s.className = 'more';
        s.textContent = `+${d.friends.length - 3}`;
        fr.appendChild(s);
      }
      ph.appendChild(fr);
    }
    inner.appendChild(ph);
    if (!d.dim) {
      const lb = document.createElement('div');
      lb.className = 'orbit-mk-lb';
      lb.textContent = d.label;
      inner.appendChild(lb);
    }
  }

  remove(key: string) {
    const e = this.entries.get(key);
    if (!e) return;
    e.el.remove();
    this.entries.delete(key);
  }

  /** Screen position in CSS pixels; `visible=false` hides the marker (behind the camera). */
  place(key: string, x: number, y: number, opacity: number, visible: boolean) {
    const e = this.entries.get(key);
    if (!e) return;
    if (!visible) { e.el.style.display = 'none'; return; }
    e.el.style.display = '';
    e.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    e.el.style.opacity = opacity.toFixed(2);
    e.el.style.zIndex = String(e.sig.includes('"selected":true') ? 5000 : Math.max(1, Math.round(y)));
  }

  placeHere(x: number, y: number, visible: boolean) {
    if (!this.here) {
      const el = document.createElement('div');
      el.className = 'orbit-here';
      el.innerHTML = '<div class="orbit-here-in"><div class="orbit-here-ring"></div><div class="orbit-here-dot"></div><div class="orbit-here-lb">You are here</div></div>';
      this.root.appendChild(el);
      this.here = el;
    }
    this.here.style.display = visible ? '' : 'none';
    this.here.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  }

  hideHere() { if (this.here) this.here.style.display = 'none'; }

  destroy() { this.root.remove(); this.entries.clear(); this.here = null; }
}
