'use client';
// TEMPORARY (package 0). Package B replaces this with the MapLibre 3D map (PLAN.md §9, package B).
export default function CampusMap() {
  return (
    <div
      className="absolute inset-0"
      style={{ background: 'radial-gradient(120% 90% at 50% 40%, #0f1b33 0%, #070b14 70%)' }}
      aria-label="Campus map placeholder"
    />
  );
}
