import * as React from 'react';
import { Popover } from './popover';
import { cn } from '@/lib/utils';

export interface MenuItem {
  label?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  hint?: string;
}

export function Menu({
  trigger,
  items,
  align = 'end',
  side = 'bottom',
  className,
  panelClassName,
}: {
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  panelClassName?: string;
}) {
  return (
    <Popover
      trigger={trigger}
      align={align}
      side={side}
      className={className}
      panelClassName={cn('min-w-[200px] p-1.5', panelClassName)}
    >
      {(close) => (
        <div className="flex flex-col">
          {items.map((item, i) =>
            item.separator ? (
              <div key={`sep-${i}`} className="my-1 h-px bg-border/60" />
            ) : (
              <button
                key={`item-${i}`}
                disabled={item.disabled}
                className={cn(
                  'flex min-h-tap w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60',
                  item.danger
                    ? 'text-destructive-ink hover:bg-destructive/10'
                    : 'text-foreground hover:bg-accent',
                )}
                onClick={() => {
                  close();
                  item.onClick?.();
                }}
              >
                {item.icon && <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{item.icon}</span>}
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </Popover>
  );
}