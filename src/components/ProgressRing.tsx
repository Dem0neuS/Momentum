import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function ProgressRing({
  size = 46,
  stroke = 4.5,
  progress = 0,
  color = '#8B5CF6',
  trackColor,
  children,
  className,
  glow,
}: {
  size?: number;
  stroke?: number;
  progress?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
  className?: string;
  glow?: boolean;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - p);

  return (
    <div className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor ?? 'hsl(var(--muted))'}
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: 'spring', stiffness: 240, damping: 24 }}
          style={glow ? { filter: `drop-shadow(0 0 4px ${color}88)` } : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}