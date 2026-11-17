'use client';
// After package 0, only the lead edits this file (PLAN.md §7.1).
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import Shell from '@/components/ui/Shell';
import { useOrbit } from '@/lib/store';

const CampusMap = dynamic(() => import('@/components/map/CampusMap'), { ssr: false });

export default function Home() {
  const load = useOrbit((s) => s.load);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-night text-ink">
      <CampusMap />
      <Shell />
    </div>
  );
}
