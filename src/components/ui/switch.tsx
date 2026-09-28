import { cn } from '@/lib/utils';

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50 before:absolute before:left-0 before:top-1/2 before:h-6 before:w-11 before:-translate-y-1/2 before:rounded-full before:transition-colors',
        checked ? 'before:bg-brand' : 'before:bg-muted',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-on-brand shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}