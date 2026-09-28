import { Button } from './button';
import { Dialog, type DialogProps } from './dialog';

export interface ConfirmDialogProps
  extends Omit<DialogProps, 'title' | 'children' | 'footer'> {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  danger,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      ariaLabel={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">{message}</p>
    </Dialog>
  );
}