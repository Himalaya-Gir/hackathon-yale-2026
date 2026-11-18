'use client';
// The campus map, with Orbit's interface over it. Onboarding stays in front until the demo starts.
import dynamic from 'next/dynamic';
import Orbit from '@/components/orbit/Orbit';
import Onboarding from '@/components/ui/Onboarding';

const CampusMap = dynamic(() => import('@/components/map/CampusMap'), { ssr: false });

export default function Home() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 isolate z-0"><CampusMap /></div>
      <Orbit />
      <Onboarding />
    </div>
  );
}
