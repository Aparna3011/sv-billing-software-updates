import React from "react";
import Modal from "./Modal";

export default function ConfirmationModal({
  isOpen,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
}) {
  return (
    <Modal open={isOpen} title={title} onClose={onCancel}>
      <div className="space-y-6">
        <p className="text-sm text-slate-600 leading-relaxed">
          {message}
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-5 py-2 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="px-8 py-2 rounded-lg bg-red-600 text-white font-bold shadow-md hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? "Deleting..." : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}