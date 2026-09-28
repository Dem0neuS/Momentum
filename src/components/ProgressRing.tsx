import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function ProgressRing({
  size = 46,
  stroke = 4.5,
  progress = 0,
  color = 'var(--brand-500)',
  trackColor = 'var(--surface-2)',
  gradient = false,
  children,
  className,
  glow,
  label = 'Прогресс',
  valueText,
}: {
  size?: number;
  stroke?: number;
  progress?: number;
  color?: string;
  trackColor?: string;
  gradient?: boolean;
  children?: React.ReactNode;
  className?: string;
  glow?: boolean;
  label?: string;
  valueText?: string;
}) {
  const rawId = React.useId();
  const gradientId = `progress-gradient-${rawId.replace(/:/g, '')}`;
  const p = Math.max(0, Math.min(1, progress));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - p);
  const paint = gradient ? `url(#${gradientId})` : color;

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
      aria-valuetext={valueText}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        {gradient && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--brand-gradient-start)" />
              <stop offset="100%" stopColor="var(--brand-gradient-end)" />
            </linearGradient>
          </defs>
        )}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={paint}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: 'spring', stiffness: 240, damping: 24 }}
          style={glow ? { filter: 'drop-shadow(0 0 3px var(--brand-500))' } : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
