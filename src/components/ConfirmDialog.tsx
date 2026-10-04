import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

type ConfirmDialogProps = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
};

/** Confirmation for destructive actions. Cancel is focused first so Enter doesn't delete by accident. */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onCancel} role="alertdialog">
      <div className="text-sm text-slate-600 dark:text-slate-300">{message}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={() => void confirm()} disabled={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
