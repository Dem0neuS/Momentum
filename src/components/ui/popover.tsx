import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useClickOutside } from '@/lib/hooks';

export interface PopoverProps {
  /** Один интерактивный элемент — обычно <button>. */
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
  /** Доступное имя всплывающего окна. */
  label?: string;
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
  label,
}: PopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  // При включённом «меньше движения» окно появляется мгновенно.
  const reduceMotion = useReducedMotion();

  // Узел обёртки: он же узел для отслеживания клика вне.
  const panelRef = React.useRef<HTMLDivElement>(null);
  /** Откуда пришёл фокус — вернём его на триггер при закрытии по Esc. */
  const restoreFocus = React.useRef(false);

  const setOpen = (v: boolean) => {
    if (disabled && v) return;
    if (v === open) return;
    setInternalOpen(v);
    onOpenChange?.(v);
    if (!v && restoreFocus.current) {
      restoreFocus.current = false;
      // Фокус возвращаем безусловно: флаг выставляет только обработчик Esc,
      // и в этот момент фокус был внутри окна — после размонтирования панели
      // ему некуда деться, иначе он падает в body. Проверять «а не внутри ли
      // панели фокус» здесь нельзя: при закрытии по Esc он как раз внутри,
      // и такая проверка пропустила бы возврат. Закрытие кликом мимо сюда не
      // доходит вовсе, так как флаг остаётся невыставленным.
      //
      // Вызов синхронный: setInternalOpen выше батчится, панель размонтируется
      // позже, уже после того как фокус переехал на триггер.
      ref.current?.querySelector<HTMLElement>('button,a,input,select,textarea')?.focus();
    }
  };

  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

  // Esc закрывает окно и возвращает фокус на кнопку.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      restoreFocus.current = true;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, disabled]);

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

  const motionProps = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, scale: 0.96, y: -4 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.97, y: -4 },
        transition: { duration: 0.12 },
      };

  // Триггер уже кнопка у вызывающего кода, поэтому ARIA и обработчик
  // добавляем копированием элемента: вложить кнопку в кнопку нельзя.
  //
  // Обработчик живёт именно на триггере, а не на обёртке. У многих
  // потребителей на кнопке свой onClick со stopPropagation() — например,
  // чтобы клик по меню не сворачивал строку категории. Если бы переключение
  // висело на обёртке, такой stopPropagation обрывал бы всплытие и окно
  // никогда не открывалось.
  const triggerNode = React.isValidElement(trigger)
    ? React.cloneElement(trigger as React.ReactElement<Record<string, unknown>>, {
        'aria-expanded': open,
        'aria-haspopup': 'dialog',
        ...(label ? { 'aria-label': (trigger.props as Record<string, unknown>)['aria-label'] ?? label } : {}),
        onClick: (e: React.MouseEvent) => {
          (trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
          e.stopPropagation();
          setOpen(!open);
        },
      })
    : trigger;

  return (
    <div
      ref={(node) => {
        ref.current = node;
      }}
      className={cn('relative inline-block', className)}
    >
      <div className={cn('inline-flex', triggerClassName)}>{triggerNode}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            {...motionProps}
            ref={panelRef}
            role="dialog"
            aria-label={label}
            className={cn(
              'absolute z-40 min-w-[180px] rounded-lg border border-border/70 bg-popover text-popover-foreground shadow-pop',
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
