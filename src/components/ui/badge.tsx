import * as React from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'outline' | 'secondary' | 'success' | 'warning' | 'destructive' | 'skip';
}) {
  const variants: Record<string, string> = {
    default: 'bg-primary/10 text-primary-ink border-transparent',
    outline: 'border-border text-muted-foreground',
    secondary: 'bg-secondary text-secondary-foreground border-transparent',
    success: 'bg-success/10 text-success-ink border-transparent',
    warning: 'bg-warning/10 text-warning-ink border-transparent',
    destructive: 'bg-destructive/10 text-destructive-ink border-transparent',
    skip: 'bg-skip-soft text-skip-ink border-transparent',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}