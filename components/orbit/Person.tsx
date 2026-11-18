'use client';
// A person as a design-system avatar: initials on their own color.
import { Avatar, AvatarFallback } from '@/components/system/avatar';
import { cn } from '@/lib/utils';

type Props = { initials: string; color: string; name?: string; size?: 'sm' | 'default' | 'lg'; className?: string };

export default function Person({ initials, color, name, size = 'default', className }: Props) {
  return (
    <Avatar size={size} className={className} title={name}>
      <AvatarFallback className={cn('font-bold text-night', size === 'sm' ? 'text-[10px]' : 'text-[12px]')} style={{ background: color }}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
