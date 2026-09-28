import { cn } from '@/lib/utils';
import { Button } from './button';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-card/40 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary-ink ring-1 ring-primary/10">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function EmptyInline({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('px-4 py-3 text-sm text-muted-foreground', className)}>{children}</p>
  );
}