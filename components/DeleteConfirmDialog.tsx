"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
import { useRef } from "react";

interface Props {
  pageTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting?: boolean;
}

export default function DeleteConfirmDialog({ pageTitle, onConfirm, onCancel, deleting }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onCancel();
  };

  return (
    <div className="delete-dialog-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="delete-dialog" role="alertdialog" aria-modal="true" aria-label="Confirm deletion">
        <div className="delete-dialog-icon">
          <AlertTriangle size={28} />
        </div>
        <h2 className="delete-dialog-title">Delete page?</h2>
        <p className="delete-dialog-body">
          <strong>"{pageTitle}"</strong> and all its sub-pages will be permanently deleted. This
          cannot be undone.
        </p>
        <div className="delete-dialog-actions">
          <button className="delete-cancel-btn" onClick={onCancel} disabled={deleting}>
            <X size={15} />
            Cancel
          </button>
          <button className="delete-confirm-btn" onClick={onConfirm} disabled={deleting}>
            <Trash2 size={15} />
            {deleting ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
