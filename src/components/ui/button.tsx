import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** Минимальный Slot для asChild-паттерна */
export function Slot({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) {
  if (React.isValidElement(children)) {
    const child = children as React.ReactElement<Record<string, unknown>>;
    const merged = cn(String(child.props.className ?? ''), className);
    return React.cloneElement(child, { ...props, className: merged });
  }
  return null;
}

const buttonVariants = cva(
  'inline-flex min-h-tap items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-micro ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 select-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-card hover:bg-primary/90',
        gradient: 'bg-gradient-brand text-on-brand shadow-card hover:brightness-95',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-surface text-foreground hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground shadow-card hover:bg-destructive/90',
        success: 'bg-success text-success-foreground shadow-card hover:opacity-90',
        skip: 'bg-skip-soft text-skip-ink hover:bg-skip/25',
        link: 'text-primary-ink underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-field px-4 py-2',
        sm: 'h-11 rounded-md px-3 text-xs sm:h-8 sm:rounded-sm',
        lg: 'h-12 rounded-lg px-6',
        icon: 'h-11 w-11 sm:h-9 sm:w-9',
        'icon-sm': 'h-11 w-11 rounded-md sm:h-8 sm:w-8 sm:rounded-sm',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))} {...props}>
          {props.children}
        </Slot>
      );
    }
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };