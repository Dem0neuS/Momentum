import { motion } from 'framer-motion';

export function Progress({
  value,
  className,
  color,
  label,
}: {
  value: number;
  className?: string;
  color?: string;
  /** Доступное имя: без него скринридер не знает, что заполняется полоска. */
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-muted ${className ?? ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="h-full rounded-full"
        style={color ? { background: color } : undefined}
        animate={{ width: `${clamped}%` }}
        transition={{ type: 'spring', stiffness: 200, damping: 26 }}
      />
    </div>
  );
}