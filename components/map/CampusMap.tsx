'use client';
// Package B (PLAN.md §9). The map is created once, after load, and removed on unmount.
// React strict mode runs this effect, the cleanup (map.remove()), then the effect again.
import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createScene } from './scene';
import { MARKER_CSS } from './markers';

export default function CampusMap() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let destroy: (() => void) | null = null;
    try { destroy = createScene(el); }
    catch (err) { console.error('orbit map: init', err); el.style.opacity = '1'; }
    return () => { destroy?.(); };
  }, []);

  return (
    <div className="absolute inset-0 h-screen w-screen" style={{ background: '#070b14' }}>
      <style>{MARKER_CSS}</style>
      <div
        ref={ref}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, transition: 'opacity 700ms ease-out' }}
        aria-label="Map of Yale campus"
      />
    </div>
  );
}
