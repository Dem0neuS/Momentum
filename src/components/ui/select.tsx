import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  icon?: string;
}

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { options?: SelectOption[] }
>(({ className, options, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        'h-10 w-full appearance-none rounded-xl border border-input bg-transparent px-3 pr-9 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {options
        ? options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.icon ? `${o.icon} ${o.label}` : o.label}
            </option>
          ))
        : children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  </div>
));
Select.displayName = 'Select';