'use client';
// People are never photos (PLAN.md §3): initials in a colored circle.

type Props = { initials: string; color: string; size?: number; ring?: boolean; title?: string; className?: string };

export default function Avatar({ initials, color, size = 28, ring = false, title, className = '' }: Props) {
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-grid shrink-0 select-none place-items-center rounded-full font-semibold leading-none text-night ${ring ? 'ring-2 ring-[#0c1322]' : ''} ${className}`}
      style={{ width: size, height: size, background: color, fontSize: Math.max(11, Math.round(size * 0.38)) }}
    >
      {initials}
    </span>
  );
}

type StackPerson = { key: string; initials: string; color: string; name: string };

/** Overlapping circles, at most `max`, then "+N". */
export function AvatarStack({ people, max = 3, size = 28 }: { people: StackPerson[]; max?: number; size?: number }) {
  if (!people.length) return null;
  const shown = people.slice(0, max);
  const more = people.length - shown.length;
  return (
    <span className="flex shrink-0 items-center">
      {shown.map((p, i) => (
        <Avatar key={p.key} initials={p.initials} color={p.color} size={size} ring title={p.name} className={i ? '-ml-2' : ''} />
      ))}
      {more > 0 && (
        <span
          className="-ml-2 inline-grid shrink-0 place-items-center rounded-full bg-[#1b2740] font-semibold leading-none text-ink ring-2 ring-[#0c1322]"
          style={{ width: size, height: size, fontSize: 11 }}
        >
          +{more}
        </span>
      )}
    </span>
  );
}
