import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface DialogProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}

export function Dialog({ open, title, children, onClose, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className={`dialog ${className ?? ''}`}
      aria-labelledby={`dialog-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <div className="dialog__header">
        <h2 id={`dialog-${title.replace(/\s+/g, '-').toLowerCase()}`}>{title}</h2>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="dialog__body">{children}</div>
    </dialog>
  );
}
