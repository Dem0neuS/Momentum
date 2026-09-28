import * as React from 'react';
import { cn } from '@/lib/utils';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm font-medium leading-none text-foreground/90', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  const generatedId = React.useId();
  const child = React.Children.only(children) as React.ReactElement<{
    id?: string;
    role?: string;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
  }>;
  const isGroup = typeof child.type === 'string' && ['div', 'fieldset'].includes(child.type);
  const controlId = child.props.id ?? `field-${generatedId}`;
  const labelId = `label-${generatedId}`;
  const hintId = hint ? `hint-${generatedId}` : undefined;
  const describedBy = [child.props['aria-describedby'], hintId].filter(Boolean).join(' ') || undefined;
  const control = isGroup
    ? React.cloneElement(child, {
        role: child.props.role ?? 'group',
        'aria-labelledby': labelId,
        'aria-describedby': describedBy,
      })
    : React.cloneElement(child, { id: controlId, 'aria-describedby': describedBy });

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label id={labelId} htmlFor={isGroup ? undefined : controlId}>
        {label}
      </Label>
      {control}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}