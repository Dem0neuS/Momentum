import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  ariaLabel?: string;
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

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('aria-hidden') && element.getClientRects().length > 0,
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  ariaLabel,
  children,
  footer,
  className,
  size = 'md',
  closeOnOverlay = true,
  hideClose,
}: DialogProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const dialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = requestAnimationFrame(() => {
      const preferred = dialogRef.current?.querySelector<HTMLElement>('[autofocus]');
      const firstFocusable = getFocusable(dialogRef.current)[0];
      (preferred ?? firstFocusable ?? dialogRef.current)?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
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
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
            onClick={closeOnOverlay ? onClose : undefined}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={!title ? ariaLabel : undefined}
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onClose();
                return;
              }
              if (event.key !== 'Tab') return;

              const focusable = getFocusable(dialogRef.current);
              if (focusable.length === 0) {
                event.preventDefault();
                dialogRef.current?.focus();
                return;
              }

              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              const active = document.activeElement;
              if (event.shiftKey && (active === first || active === dialogRef.current)) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
              }
            }}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={cn(
              'relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-xl border border-border/70 bg-card shadow-pop sm:rounded-xl',
              sizes[size],
              className,
            )}
          >
            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-3 border-b border-border/50 p-4 pb-3 sm:p-5 sm:pb-3">
                <div className="min-w-0">
                  {title && <h2 id={titleId} className="text-lg font-semibold leading-tight">{title}</h2>}
                  {description && (
                    <p id={descriptionId} className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                  )}
                </div>
                {!hideClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:h-9 sm:w-9"
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