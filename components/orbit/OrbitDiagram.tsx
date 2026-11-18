'use client';
// You at the center, time as rings, each proposal a photo planet with its friends as moons.
import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { motion } from 'motion/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/system/tooltip';
import { fmtTime } from '@/lib/time';
import type { Friend, Mode, Pick as OrbitPick, YaleEvent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { LABEL, MISSION_F, RINGS, TONIGHT, WEEK, YALE, YALE_TINT, missionLabel, placeShort } from './model';

export type Planet = { pick: OrbitPick; event: YaleEvent; ring: number; angle: number; size: number };

const MOON_SPEED = 14; // degrees per second
const SPEEDS: Record<Mode, number[]> = { week: RINGS.week.map((r) => r.speed), tonight: RINGS.tonight.map((r) => r.speed) };

/** Planets drift along their ring; written to CSS variables so React does not re-render every frame. */
function useDrift(ref: RefObject<HTMLDivElement | null>, speeds: number[], paused: boolean) {
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const angles = speeds.map(() => 0);
    let moon = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (!pausedRef.current) {
        speeds.forEach((s, i) => { angles[i] += s * dt; el.style.setProperty(`--d${i}`, `${angles[i].toFixed(3)}deg`); });
        moon += MOON_SPEED * dt;
        el.style.setProperty('--dm', `${moon.toFixed(3)}deg`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref, speeds]);
}

/** Upper half-circle, left to right, to set a label along a ring. */
const arc = (r: number) => `M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0`;

type Props = {
  mode: Mode;
  goal: string;
  planets: Planet[];
  friends: Friend[];
  going: string[];
  selected: string | null;
  lit: string | null;
  focusRing: number | null;
  thinking: boolean;
  runKey: string;
  ringLabel(i: number): string;
  onEnter(id: string): void;
  onLeave(): void;
  onSelect(id: string): void;
  onMission(): void;
  center: ReactNode;
};

/** Sentence case for the ring texts: no spaced capitals. */
const sentence = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();

export default function OrbitDiagram(p: Props) {
  const rings = RINGS[p.mode];
  const tonight = p.mode === 'tonight';
  const accent = tonight ? TONIGHT : WEEK;
  const ref = useRef<HTMLDivElement>(null);
  useDrift(ref, SPEEDS[p.mode], p.lit !== null);

  return (
    <div ref={ref} className="relative shrink-0" style={{ width: 'var(--S)', height: 'var(--S)' }}>
      <svg viewBox="-500 -500 1000 1000" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id="orbit-halo">
            <stop offset="0%" stopColor={YALE_TINT} stopOpacity="0.16" />
            <stop offset="45%" stopColor={YALE_TINT} stopOpacity="0.06" />
            <stop offset="100%" stopColor={YALE} stopOpacity="0" />
          </radialGradient>
          {rings.map((r, i) => <path key={i} id={`orbit-arc-${p.mode}-${i}`} d={arc(r.f * 500 + 9)} />)}
          <path id="orbit-arc-mission" d={arc(MISSION_F * 500 + 8)} />
        </defs>
        <circle r={500 * MISSION_F} fill="url(#orbit-halo)" />
        <g key={p.runKey} transform="rotate(-90)">
          <motion.circle r={500 * MISSION_F} fill="none" stroke="rgba(23,26,32,0.12)" strokeWidth={1} vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: [0.2, 0.7, 0.2, 1] }} />
          {rings.map((r, i) => {
            const on = p.focusRing === i && !p.thinking;
            return (
              <motion.circle key={r.label} r={500 * r.f} fill="none" strokeWidth={1} vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1, stroke: on ? accent : 'rgba(23,26,32,0.16)', strokeOpacity: on ? 0.7 : 1 }}
                transition={{ pathLength: { duration: 1.4, delay: 0.15 + i * 0.18, ease: [0.2, 0.7, 0.2, 1] }, stroke: { duration: 0.3 } }} />
            );
          })}
        </g>
        {/* Instrument dial ticks on the outer ring */}
        <g opacity={0.9}>
          {Array.from({ length: 72 }, (_, i) => {
            const a = (i * 5 * Math.PI) / 180;
            const r1 = 500 * MISSION_F;
            const r2 = r1 - (i % 6 === 0 ? 14 : 6);
            return <line key={i} x1={(Math.cos(a) * r1).toFixed(2)} y1={(Math.sin(a) * r1).toFixed(2)} x2={(Math.cos(a) * r2).toFixed(2)} y2={(Math.sin(a) * r2).toFixed(2)} stroke="rgba(23,26,32,0.14)" strokeWidth={1} vectorEffect="non-scaling-stroke" />;
          })}
        </g>
        {rings.map((r, i) => (
          <motion.text key={`${p.runKey}-${r.label}`} fontSize={30} letterSpacing={0} fontWeight={600} stroke="#ffffff" strokeWidth={7} paintOrder="stroke"
            initial={{ opacity: 0 }} animate={{ opacity: 1, fill: p.focusRing === i && !p.thinking ? accent : 'rgba(23,26,32,0.45)' }} transition={{ delay: 0.4 + i * 0.18 }}>
            <textPath href={`#orbit-arc-${p.mode}-${i}`} startOffset="50%" textAnchor="middle">{sentence(p.ringLabel(i))}</textPath>
          </motion.text>
        ))}
      </svg>

      {p.thinking && (
        <motion.div className="absolute rounded-full" style={{ inset: `${(1 - MISSION_F) * 50}%`, background: `conic-gradient(from 0deg, transparent 0deg, transparent 290deg, ${tonight ? 'rgba(232,147,42,0.28)' : 'rgba(40,109,192,0.28)'} 360deg)` }}
          animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} />
      )}

      {/* Mission label along the outer ring: a tap opens the mission menu */}
      <svg viewBox="-500 -500 1000 1000" className="pointer-events-none absolute inset-0 size-full overflow-visible">
        <text role="button" tabIndex={0} aria-label={`Mission: ${p.goal}. Change mission`} onClick={p.onMission}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.onMission(); } }}
          className="pointer-events-auto cursor-pointer outline-none transition-opacity hover:opacity-80" fontSize={30} fontWeight={700} letterSpacing={0} fill={YALE} stroke="#ffffff" strokeWidth={8} paintOrder="stroke">
          <textPath href="#orbit-arc-mission" startOffset="50%" textAnchor="middle">{sentence(missionLabel(p.goal))}</textPath>
        </text>
      </svg>

      {p.planets.map((pl, n) => {
        const r = rings[pl.ring] ?? rings[rings.length - 1];
        const lit = p.lit === pl.event.id;
        const isSel = p.selected === pl.event.id;
        const isGoing = p.going.includes(pl.event.id);
        const moons = p.friends.filter((f) => f.status === 'friend' && f.goingTo.includes(pl.event.id)).slice(0, 4);
        const pos = {
          '--a': `${pl.angle}deg`,
          left: `calc(50% + ${r.f * 50}% * cos(calc(var(--a) + var(--d${pl.ring}, 0deg))))`,
          top: `calc(50% + ${r.f * 50}% * sin(calc(var(--a) + var(--d${pl.ring}, 0deg))))`,
          width: pl.size,
          height: pl.size,
          marginLeft: -pl.size / 2,
          marginTop: -pl.size / 2,
          zIndex: lit ? 40 : isSel ? 25 : 10,
        } as CSSProperties;
        return (
          <div key={`${p.runKey}-${pl.event.id}`} className="pointer-events-auto absolute" style={pos}>
            <Tooltip open={lit}>
              <TooltipTrigger asChild>
                <motion.button type="button" aria-label={`${pl.event.title}, ${fmtTime(pl.event.start)}`} aria-pressed={isSel}
                  onMouseEnter={() => p.onEnter(pl.event.id)} onMouseLeave={p.onLeave} onFocus={() => p.onEnter(pl.event.id)} onBlur={p.onLeave}
                  onClick={() => p.onSelect(pl.event.id)}
                  className="relative block size-full rounded-full outline-none"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: lit ? 1.1 : 1, opacity: 1, filter: lit || isSel ? 'saturate(1.05)' : 'saturate(0.8)' }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22, delay: n * 0.08, filter: { duration: 0.2 } }}>
                  <span className="absolute inset-0 overflow-hidden rounded-full transition-shadow duration-200"
                    style={{ boxShadow: `0 0 0 ${isSel ? 3 : 2}px #fff, 0 0 0 ${isSel ? 5 : 3}px ${accent}${isSel || lit ? '' : '88'}, 0 8px 20px rgba(23,26,32,${lit || isSel ? 0.28 : 0.16})` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pl.event.photoUrl} alt="" draggable={false} className="size-full object-cover" />
                    {tonight && <span className="absolute inset-0 mix-blend-color" style={{ background: TONIGHT, opacity: 0.35 }} />}
                  </span>
                  {isSel && <span className="absolute -inset-[9px] rounded-full border border-dashed" style={{ borderColor: `${accent}aa` }} />}
                  {isGoing && <span className="absolute -right-0.5 -top-0.5 grid size-[18px] place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: YALE, boxShadow: '0 0 0 2px #fff' }} aria-hidden>✓</span>}
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={14} className={cn(LABEL, 'bg-foreground px-3 py-1.5 text-[11px] text-background')}>
                <span>{fmtTime(pl.event.start)} · {placeShort(pl.event)}</span>
              </TooltipContent>
            </Tooltip>
            {moons.map((f, i) => {
              const R = pl.size / 2 + 13;
              return (
                <motion.span key={f.id} title={f.name} aria-hidden
                  className="pointer-events-none absolute grid size-5 place-items-center rounded-full text-[9px] font-bold text-[#171A20]"
                  style={{ background: f.color, boxShadow: '0 0 0 2px #fff',
                    left: `calc(50% - 10px + ${R}px * cos(calc(${-40 + i * 52}deg + var(--dm, 0deg))))`,
                    top: `calc(50% - 10px + ${R}px * sin(calc(${-40 + i * 52}deg + var(--dm, 0deg))))` }}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 20, delay: n * 0.08 + 0.25 + i * 0.08 }}>
                  {f.initials}
                </motion.span>
              );
            })}
          </div>
        );
      })}

      {p.center}
    </div>
  );
}
