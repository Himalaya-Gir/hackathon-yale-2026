'use client';
// The interface over the map (PLAN.md §8.1). The container never takes the pointer;
// only the glass panels do, so the campus stays draggable.
import { Route } from 'lucide-react';
import { useOrbit } from '@/lib/store';
import GoalBar from './GoalBar';
import InviteDialog from './InviteDialog';
import Onboarding from './Onboarding';
import ProfilePanel from './ProfilePanel';
import TopBar from './TopBar';
import WeekRail from './WeekRail';

function TrajectoryBanner() {
  const trajectory = useOrbit((s) => s.trajectory);
  const mode = useOrbit((s) => s.mode);
  if (!trajectory || mode !== 'week') return null;
  return (
    <div
      className="pointer-events-none absolute top-20 z-10 flex justify-center"
      style={{ left: 'calc(16px + 320px + 16px)', right: 'calc(16px + 380px + 16px)' }}
    >
      <div key={trajectory} className="glass slide-down pointer-events-auto mx-auto flex w-full min-w-0 max-w-[560px] items-start gap-4 p-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#00356B] text-white">
          <Route size={16} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-5">Your trajectory</div>
          <p className="mt-1 text-base leading-snug">{trajectory}</p>
        </div>
      </div>
    </div>
  );
}

export default function Shell() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[6000] overflow-hidden text-ink">
      <GoalBar />
      <div className="pointer-events-none absolute bottom-4 left-4 top-20 z-10 flex w-80 min-h-0 flex-col">
        <ProfilePanel />
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 top-20 z-10 w-[380px]">
        <div className="h-full min-h-0">
          <WeekRail />
        </div>
      </div>
      <TrajectoryBanner />
      <div className="pointer-events-none absolute inset-x-4 top-4 z-20">
        <TopBar />
      </div>
      <InviteDialog />
      <Onboarding />
    </div>
  );
}
