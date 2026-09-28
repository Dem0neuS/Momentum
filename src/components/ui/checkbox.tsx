import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  className,
  color,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onCheckedChange(!checked);
      }}
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-transparent text-on-brand shadow-sm' : 'border-input bg-transparent hover:bg-accent',
        className,
      )}
      style={checked ? { backgroundColor: color ?? 'var(--brand-500)' } : undefined}
    >
      {checked && (
        <Check
          className="h-4 w-4"
          style={color ? { color: '#fff' } : undefined}
        />
      )}
    </button>
  );
}