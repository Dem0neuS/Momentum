import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StreakBadge({
  count,
  color = 'var(--warning)',
  className,
}: {
  count: number;
  color?: string;
  className?: string;
}) {
  if (count <= 0) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}>
        <Flame className="h-3.5 w-3.5 opacity-40" />
        0
      </span>
    );
  }
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs font-semibold', className)}
      title="Текущая серия"
    >
      <Flame className="h-3.5 w-3.5" style={{ color }} />
      <motion.span
        key={count}
        initial={{ scale: 1.5 }}
        animate={{ scale: 1 }}
        style={{ color: 'var(--warning-ink)' }}
        transition={{ type: 'spring', stiffness: 400, damping: 14 }}
      >
        {count}
      </motion.span>
    </span>
  );
}