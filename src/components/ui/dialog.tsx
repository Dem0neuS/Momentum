import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKeydown } from '@/lib/hooks';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlay?: boolean;
  hideClose?: boolean;
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = 'md',
  closeOnOverlay = true,
  hideClose,
}: DialogProps) {
  useKeydown(
    (e) => {
      if (e.key === 'Escape' && open) onClose();
    },
    [open],
  );

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-navy/50 backdrop-blur-sm"
            onClick={closeOnOverlay ? onClose : undefined}
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={cn(
              'relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-border/60 bg-card shadow-soft-lg sm:rounded-2xl',
              sizes[size],
              className,
            )}
          >
            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-3 border-b border-border/50 p-4 pb-3 sm:p-5 sm:pb-3">
                <div className="min-w-0">
                  {title && <h2 className="text-lg font-semibold leading-tight">{title}</h2>}
                  {description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                  )}
                </div>
                {!hideClose && (
                  <button
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Закрыть"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
            {footer && (
              <div className="border-t border-border/50 p-4 sm:p-5">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}