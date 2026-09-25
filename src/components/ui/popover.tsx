import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useClickOutside } from '@/lib/hooks';

export interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
  panelClassName?: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  disabled?: boolean;
  triggerClassName?: string;
}

export function Popover({
  trigger,
  children,
  side = 'bottom',
  align = 'start',
  className,
  panelClassName,
  open: controlledOpen,
  onOpenChange,
  disabled,
  triggerClassName,
}: PopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (disabled && v) return;
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

  const sideClasses: Record<string, string> = {
    bottom: 'top-full mt-2',
    top: 'bottom-full mb-2',
    left: 'right-full mr-2 top-0',
    right: 'left-full ml-2 top-0',
  };
  const alignClasses: Record<string, string> = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  };

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <div
        className={cn('inline-flex', triggerClassName)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        {trigger}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.12 }}
            className={cn(
              'absolute z-40 min-w-[180px] rounded-xl border border-border/70 bg-popover text-popover-foreground shadow-soft-lg',
              sideClasses[side],
              alignClasses[align],
              panelClassName,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {typeof children === 'function' ? children(() => setOpen(false)) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}